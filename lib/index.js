/**
 * dsh-usage-stats — Host-side Cordis plugin that aggregates usage statistics
 * across all sessions and exposes them through an API endpoint.
 *
 * @module dsh-usage-stats
 */

import { parseZaiUsage } from './coding-plans.js';
import { loadStore, saveStore } from './store.js';
import { processSessions } from './backfill.js';
import {
  isTokenDelta,
  usageOutputTokens,
  foldSessionStats,
  foldTokenUsage,
  bucketsFrom,
  bucketsEqual,
  foldContextBreakdown,
  isSurfaceEvent,
  deriveEventMessage,
  foldModelUsage,
  mapWithConcurrency,
  buildTimeSeries,
  dateStr,
  hourStr,
} from './fold.js';

/** Cordis plugin name. */
export const name = 'usage-stats';

/** Required services. */
export const inject = ['webServer', 'sessionQuery'];

/**
 * Apply the usage-stats plugin: register the API route that serves aggregated
 * usage statistics across all sessions.
 *
 * @param ctx - Cordis plugin context with injected services.
 */
export function apply(ctx) {
  let sessionsService;

  // Optional sessions service for live session data
  ctx.inject(['sessions'], (sessionsCtx) => {
    sessionsService = sessionsCtx.sessions;
    ctx.effect(() => () => {
      if (sessionsService === sessionsCtx.sessions) sessionsService = void 0;
    }, 'usage-stats: sessions binding');
  });

  // Register the main stats API endpoint
  ctx.effect(() => {
    const disposer = ctx.webServer.register({
      kind: 'exact',
      path: '/api/usage-stats',
      handler: async (_req, res) => {
        try {
          const stats = await collectStats(ctx, sessionsService);
          sendJson(res, 200, stats);
        } catch (error) {
          sendJson(res, 500, {
            error: 'Failed to collect usage statistics',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      },
    });
    return disposer;
  }, 'usage-stats: route');

  // Register per-session stats endpoint
  ctx.effect(() => {
    const disposer = ctx.webServer.register({
      kind: 'exact',
      path: '/api/usage-stats/session',
      handler: async (req, res) => {
        try {
          const url = new URL(req.url ?? '/', 'http://x');
          const sessionId = url.searchParams.get('id');
          if (!sessionId) {
            sendJson(res, 400, { error: 'Session ID is required (query param: id)' });
            return;
          }
          const stats = await collectSessionStats(ctx, sessionsService, sessionId);
          if (!stats) {
            sendJson(res, 404, { error: 'Session not found' });
            return;
          }
          sendJson(res, 200, stats);
        } catch (error) {
          sendJson(res, 500, {
            error: 'Failed to collect session statistics',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      },
    });
    return disposer;
  }, 'usage-stats: session route');

  // Register coding-plan quota endpoint (Z.ai only)
  ctx.effect(() => {
    const disposer = ctx.webServer.register({
      kind: 'exact',
      path: '/api/usage-stats/plan',
      handler: async (_req, res) => {
        try {
          sendJson(res, 200, await collectPlanUsage());
        } catch {
          sendJson(res, 200, { available: false, reason: 'error' });
        }
      },
    });
    return disposer;
  }, 'usage-stats: plan route');
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  res.end(body);
}

// ─── Coding Plan Quota (Z.ai) ────────────────────────────────

/** Hosts the Z.ai quota endpoint is allowed to call out to. Anything else is refused. */
const PLAN_ALLOWED_HOSTS = new Set(['api.z.ai']);

/**
 * Refuse URLs that are not https and not a public host.
 * Block localhost, link-local, loopback, and private/reserved ranges.
 */
function isSafePlanUrl(raw) {
  let u;
  try {
    u = raw instanceof URL ? raw : new URL(String(raw));
  } catch {
    return false;
  }
  if (!/^https:$/i.test(u.protocol)) return false;
  const h = u.hostname.toLowerCase();
  if (!h || h === 'localhost') return false;
  if (/^(127\.0\.0\.1|0\.0\.0\.0|255\.255\.255\.255|::1|ip6-localhost)$/.test(h)) return false;
  if (h.endsWith('.internal') || h.endsWith('.local') || h.endsWith('.onion')) return false;
  if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(h)) return false;
  return true;
}

/**
 * Collect Z.ai coding-plan quota. Never throws and never logs credentials:
 * every failure degrades to a silent { available:false } payload.
 */
async function collectPlanUsage() {
  const apiKey = process.env.ZAI_API_KEY;
  if (typeof apiKey !== 'string' || apiKey === '') {
    return { available: false, reason: 'no_credential' };
  }

  // v4 first; 401 or any failure falls back to v3 (both use 4 attempts).
  const endpoints = [
    'https://api.z.ai/api/coding/paas/v4/dashboard/billing/coding_plan/usage',
    'https://api.z.ai/api/coding/paas/v3/dashboard/billing/coding_plan/usage',
  ];
  const headers = { authorization: 'Bearer ' + apiKey, accept: 'application/json' };
  for (const url of endpoints) {
    if (!isSafePlanUrl(url) || !PLAN_ALLOWED_HOSTS.has(new URL(url).hostname)) continue;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const res = await fetch(url, { headers });
        if (!res.ok) return { available: false, reason: 'error' };
        const text = await res.text();
        try {
          const parsed = parseZaiUsage(JSON.parse(text));
          return { available: true, plans: parsed.plans };
        } catch {
          return { available: false, reason: 'error' };
        }
      } catch {
        await new Promise((r) => setTimeout(r, Math.min(1500, 300 * 2 ** (attempt - 2))));
      }
    }
  }
  return { available: false, reason: 'error' };
}

// ─── Concurrency Helper ──────────────────────────────────────

/** Bounded worker-pool concurrency for readSession across persisted sessions. */
const PERSISTED_READ_CONCURRENCY = 4;
// ─── Data Collection ─────────────────────────────────────────

// Serialize read-modify-write cycles so concurrent requests never race.
let ledgerQueue = Promise.resolve();

async function collectStats(ctx, sessionsService) {
  const run = async () => {
    const ledger = loadStore();
    const { sessionList, liveSessions } = await processSessions({
      sessionQuery: ctx.sessionQuery,
      sessionsService,
      ledger,
      concurrency: PERSISTED_READ_CONCURRENCY,
    });
    const response = buildResponse(ledger, sessionList, liveSessions);
    saveStore(ledger);
    return response;
  };
  const done = ledgerQueue.then(run, run);
  ledgerQueue = done.catch(() => {});
  return done;
}

/**
 * Rebuild the /api/usage-stats response from the ledger's per-session
 * products, mirroring the aggregated fields back into the ledger so the
 * stored file stays self-contained. Output shape and field order match the
 * original full-scan implementation exactly.
 */
function buildResponse(ledger, sessionList, liveSessions) {
  const summary = {
    sessionCount: sessionList.length,
    liveCount: 0,
    persistedCount: 0,
    totalTurns: 0,
    totalSteps: 0,
    totalLlmMs: 0,
    totalToolMs: 0,
    totalTtftMs: 0,
    totalTtftSteps: 0,
    totalDecodeMs: 0,
    totalDecodeTokens: 0,
    totalUncachedInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    totalCacheWriteTokens: 0,
    totalSystemTokens: 0,
    totalToolsTokens: 0,
    totalMessageTokens: 0,
  };
  const modelUsage = {};
  const dailyTrend = {};
  const hourlyTrend = {};
  const sessionDetails = [];
  const recordsById = new Map(sessionList.map((record) => [record.header.id, record]));
  const liveById = new Map(liveSessions.map((session) => [session.id, session]));

  for (const record of sessionList) {
    if (record.live) summary.liveCount++;
    if (record.persisted) summary.persistedCount++;
  }

  for (const id of Object.keys(ledger.sessions)) {
    const prod = ledger.sessions[id];
    const record = recordsById.get(id);
    const live = liveById.get(id);
    if (!record && !live) continue; // stale entry not in this snapshot
    aggregateResult(summary, modelUsage, dailyTrend, hourlyTrend, prod);
    sessionDetails.push({
      id,
      title: live?.header?.title ?? record?.header?.title ?? '(untitled)',
      createdAt: live?.header?.createdAt ?? record?.header?.createdAt,
      live: !!live,
      persisted: !live && !!record,
      stats: prod.stats,
      tokenUsage: prod.tokenUsage,
      contextBreakdown: prod.contextBreakdown,
      modelUsage: prod.modelUsage,
    });
  }

  sessionDetails.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  // Build daily trend response
  const dailyTrendResponse = buildTimeSeries(dailyTrend);

  // Build hourly trend
  const hourlyTrendResponse = buildTimeSeries(hourlyTrend);

  // Build model distribution
  const modelDistribution = Object.entries(modelUsage)
    .map(([model, data]) => ({
      model,
      ...data,
    }))
    .sort((a, b) => (b.uncachedInputTokens + b.outputTokens + b.cacheReadTokens + b.cacheWriteTokens) -
      (a.uncachedInputTokens + a.outputTokens + a.cacheReadTokens + a.cacheWriteTokens));

  // Mirror the aggregates back into the ledger before it is saved.
  ledger.summary = summary;
  ledger.modelUsage = modelUsage;
  ledger.dailyTrend = dailyTrend;
  ledger.hourlyTrend = hourlyTrend;

  return {
    summary: {
      ...summary,
      llmHours: summary.totalLlmMs / 3600000,
      toolHours: summary.totalToolMs / 3600000,
      totalTokens: summary.totalUncachedInputTokens + summary.totalOutputTokens +
        summary.totalCacheReadTokens + summary.totalCacheWriteTokens,
    },
    modelUsage: modelDistribution,
    dailyTrend: dailyTrendResponse,
    hourlyTrend: hourlyTrendResponse,
    sessions: sessionDetails,
    collectedAt: Date.now(),
  };
}

async function collectSessionStats(ctx, sessionsService, sessionId) {
  const sessionQuery = ctx.sessionQuery;
  let session;
  let header;

  const liveSession = sessionsService?.get(sessionId);
  if (liveSession) {
    session = liveSession;
    header = liveSession.header;
  } else {
    try {
      const loaded = await sessionQuery.readSession(sessionId);
      session = { id: sessionId, events: loaded.events };
      header = loaded.session;
    } catch {
      return null;
    }
  }

  const result = processSessionEvents(sessionId, session.events, header);
  return {
    id: sessionId,
    title: header.title ?? '(untitled)',
    createdAt: header.createdAt,
    stats: result.stats,
    tokenUsage: result.tokenUsage,
    contextBreakdown: result.contextBreakdown,
    modelUsage: result.modelUsage,
  };
}

function processSessionEvents(sessionId, events, header) {
  const stats = foldSessionStats(events);
  const tokenUsage = foldTokenUsage(events);
  const contextBreakdown = foldContextBreakdown(events);
  const modelUsage = foldModelUsage(events);
  return { stats, tokenUsage, contextBreakdown, modelUsage };
}

function aggregateResult(summary, modelUsage, dailyTrend, hourlyTrend, result) {
  const { stats, tokenUsage, contextBreakdown, modelUsage: perModel } = result;

  if (stats) {
    summary.totalTurns += stats.turns;
    summary.totalSteps += stats.steps;
    summary.totalLlmMs += stats.llmMs;
    summary.totalToolMs += stats.toolMs;
    summary.totalTtftMs += stats.ttftMs;
    summary.totalTtftSteps += stats.ttftSteps;
    summary.totalDecodeMs += stats.decodeMs;
    summary.totalDecodeTokens += stats.decodeTokens;
  }

  if (tokenUsage) {
    summary.totalUncachedInputTokens += tokenUsage.uncachedInputTokens;
    summary.totalOutputTokens += tokenUsage.outputTokens;
    summary.totalCacheReadTokens += tokenUsage.cacheReadTokens;
    summary.totalCacheWriteTokens += tokenUsage.cacheWriteTokens;
  }

  if (contextBreakdown) {
    summary.totalSystemTokens += contextBreakdown.systemTokens;
    summary.totalToolsTokens += contextBreakdown.toolsTokens;
    summary.totalMessageTokens += contextBreakdown.messageTokens;
  }

  // Aggregate per-model usage
  for (const { model, uncachedInputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, count, timestamps } of perModel) {
    if (!modelUsage[model]) {
      modelUsage[model] = { uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, count: 0 };
    }
    modelUsage[model].uncachedInputTokens += uncachedInputTokens;
    modelUsage[model].outputTokens += outputTokens;
    modelUsage[model].cacheReadTokens += cacheReadTokens;
    modelUsage[model].cacheWriteTokens += cacheWriteTokens;
    modelUsage[model].count += count;

    // Aggregate into daily trend
    for (const { time, uncachedInputTokens: ui, outputTokens: ot, cacheReadTokens: cr, cacheWriteTokens: cw } of timestamps) {
      const dateKey = dateStr(time);
      if (!dailyTrend[dateKey]) dailyTrend[dateKey] = {};
      if (!dailyTrend[dateKey][model]) {
        dailyTrend[dateKey][model] = { uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
      }
      dailyTrend[dateKey][model].uncachedInputTokens += ui;
      dailyTrend[dateKey][model].outputTokens += ot;
      dailyTrend[dateKey][model].cacheReadTokens += cr;
      dailyTrend[dateKey][model].cacheWriteTokens += cw;

      // Hourly (for Coding Plan)
      const hourKey = hourStr(time);
      if (!hourlyTrend[hourKey]) hourlyTrend[hourKey] = {};
      if (!hourlyTrend[hourKey][model]) {
        hourlyTrend[hourKey][model] = { uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
      }
      hourlyTrend[hourKey][model].uncachedInputTokens += ui;
      hourlyTrend[hourKey][model].outputTokens += ot;
      hourlyTrend[hourKey][model].cacheReadTokens += cr;
      hourlyTrend[hourKey][model].cacheWriteTokens += cw;
    }
  }
}
