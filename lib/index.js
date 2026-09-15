/**
 * dsh-usage-stats — Host-side Cordis plugin that aggregates usage statistics
 * across all sessions and exposes them through an API endpoint.
 *
 * v0.2 changes:
 * - The bulk response no longer ships raw per-model timestamps (the client
 *   never consumed them; they were the dominant payload component). The
 *   ledger keeps them internally for trend aggregation, and the
 *   /api/usage-stats/session endpoint still returns them for API consumers.
 * - v0.1.3: per-session rows in the bulk payload are slimmed to
 *   id/title/createdAt/live/persisted/turns/steps/llmMs/toolMs/totalTokens,
 *   plus summary.maxSessionLlmMs. Full per-session folds stay in the ledger
 *   and at /api/usage-stats/session?id=...
 * - Idle polls are cheap: when neither the ledger nor the session universe
 *   changed, the previously built response is served from cache, disk is not
 *   rewritten, and a weak ETag lets clients get a 304 with an empty body.
 * - A failed ledger save no longer fails the whole request: the freshly
 *   computed statistics are still served, and the error is logged.
 * - The rolling 24h trend is a dense hourly series for the last 720 hours
 *   (zero-filled), so gaps no longer distort the line chart.
 *
 * @module dsh-usage-stats
 */

import { loadStore, saveStore } from './store.js';
import { processSessions, pruneLedger } from './backfill.js';
import {
  foldSessionStats,
  foldTokenUsage,
  foldContextBreakdown,
  foldModelUsage,
  buildTimeSeries,
  buildRollingDailyTrend,
  dateStr,
  hourFloor,
} from './fold.js';

/** Cordis plugin name. */
export const name = 'usage-stats';

/** Required services. */
export const inject = ['webServer', 'sessionQuery'];

/** Dense rolling-trend window served to the client: 720 hourly points (30d). */
const ROLLING_WINDOW_HOURS = 720;

/** Process-lifetime nonce so ETags never collide across host restarts. */
const BOOT_NONCE = Math.random().toString(36).slice(2, 10);

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
      handler: async (req, res) => {
        try {
          const entry = await collectStats(ctx, sessionsService);
          const inm = req.headers?.['if-none-match'];
          if (typeof inm === 'string' && inm === entry.etag) {
            res.statusCode = 304;
            res.setHeader('etag', entry.etag);
            res.setHeader('cache-control', 'no-store');
            res.end();
            return;
          }
          sendJson(res, 200, entry.payload, { etag: entry.etag });
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

  // Register per-session stats endpoint (full detail incl. timestamps —
  // documented API for external consumers; the client panel does not use it)
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
}

function sendJson(res, status, value, headers = {}) {
  const body = JSON.stringify(value);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  for (const [key, val] of Object.entries(headers)) res.setHeader(key, val);
  res.end(body);
}

// ─── Data Collection ─────────────────────────────────────────

/** Bounded worker-pool concurrency for readSession across persisted sessions. */
const PERSISTED_READ_CONCURRENCY = 4;

// Serialize read-modify-write cycles so concurrent requests never race.
let ledgerQueue = Promise.resolve();

// Cached last build: { signature, entry: { payload, etag }, hourlyTrend,
// entryHour }. Serves idle polls without recomputing aggregates or touching
// disk. The dense rolling trend is re-emitted with a fresh clock whenever the
// hour rolls over, so a long idle stretch never freezes the chart's time axis.
let responseCache = null;
let cacheGeneration = 0;

async function collectStats(ctx, sessionsService) {
  const run = async () => {
    const now = Date.now();
    const ledger = loadStore();
    const { sessionList, liveSessions, ledgerChanged, signature } = await processSessions({
      sessionQuery: ctx.sessionQuery,
      sessionsService,
      ledger,
      concurrency: PERSISTED_READ_CONCURRENCY,
      logger: ctx.logger,
    });
    const pruned = pruneLedger(ledger, now);

    // Persist only when the ledger actually changed; a save failure must not
    // take down the (already computed) response.
    if (ledgerChanged || pruned) {
      try {
        saveStore(ledger);
      } catch (error) {
        ctx.logger?.warn?.('usage-stats: failed to save ledger', { error });
      }
    }

    const hour = hourFloor(now);
    // Nothing changed since the last build → serve the cached payload.
    if (responseCache && responseCache.signature === signature && !ledgerChanged && !pruned) {
      if (responseCache.entryHour === hour) return responseCache.entry;
      // Same data, new hour: re-emit the dense rolling tail from the cached
      // hourly buckets with a fresh clock — no session reads, no disk access.
      const rollingDailyTrend = buildRollingDailyTrend(responseCache.hourlyTrend, {
        fillFrom: hour - (ROLLING_WINDOW_HOURS - 1) * 3600000,
        fillTo: now,
      });
      cacheGeneration += 1;
      const payload = { ...responseCache.entry.payload, rollingDailyTrend, collectedAt: now };
      const entry = { payload, etag: `W/"${BOOT_NONCE}-${cacheGeneration}"` };
      responseCache = { signature: responseCache.signature, entry, hourlyTrend: responseCache.hourlyTrend, entryHour: hour };
      return entry;
    }

    const built = buildResponse(ledger, sessionList, liveSessions, now);
    cacheGeneration += 1;
    const entry = { payload: built.payload, etag: `W/"${BOOT_NONCE}-${cacheGeneration}"` };
    responseCache = { signature, entry, hourlyTrend: built.hourlyTrend, entryHour: hour };
    return entry;
  };
  const done = ledgerQueue.then(run, run);
  ledgerQueue = done.catch(() => {});
  return done;
}

/**
 * Rebuild the /api/usage-stats response from the ledger's per-session
 * products. Timestamps are aggregated into daily/hourly buckets here; the
 * per-session rows are slimmed to the fields the panel consumes. Returns the
 * payload plus the raw hourly buckets so the caller can re-emit the dense
 * rolling trend on a fresh clock without re-reading any sessions.
 */
function buildResponse(ledger, sessionList, liveSessions, now = Date.now()) {
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
  let maxSessionLlmMs = 0;
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
    const llmMs = prod.stats?.llmMs ?? 0;
    if (llmMs > maxSessionLlmMs) maxSessionLlmMs = llmMs;
    // Slim per-session row (v0.1.3): the client panel consumes only these
    // fields; the full folded documents stay in the ledger and remain
    // available per session at /api/usage-stats/session?id=...
    const tu = prod.tokenUsage;
    sessionDetails.push({
      id,
      title: live?.header?.title ?? record?.header?.title ?? '(untitled)',
      createdAt: live?.header?.createdAt ?? record?.header?.createdAt,
      live: !!live,
      persisted: !live && !!record,
      turns: prod.stats?.turns ?? 0,
      steps: prod.stats?.steps ?? 0,
      llmMs,
      toolMs: prod.stats?.toolMs ?? 0,
      totalTokens: (tu?.uncachedInputTokens ?? 0) + (tu?.outputTokens ?? 0) +
        (tu?.cacheReadTokens ?? 0) + (tu?.cacheWriteTokens ?? 0),
    });
  }

  sessionDetails.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  // Build daily trend response (calendar day, for heatmap)
  const dailyTrendResponse = buildTimeSeries(dailyTrend);

  // Build rolling 24h trend (dense hourly, zero-filled for the served window)
  const rollingDailyTrend = buildRollingDailyTrend(hourlyTrend, {
    fillFrom: hourFloor(now) - (ROLLING_WINDOW_HOURS - 1) * 3600000,
    fillTo: now,
  });

  // Build model distribution
  const modelDistribution = Object.entries(modelUsage)
    .map(([model, data]) => ({
      model,
      ...data,
    }))
    .sort((a, b) => (b.uncachedInputTokens + b.outputTokens + b.cacheReadTokens + b.cacheWriteTokens) -
      (a.uncachedInputTokens + a.outputTokens + a.cacheReadTokens + a.cacheWriteTokens));

  const payload = {
    summary: {
      ...summary,
      llmHours: summary.totalLlmMs / 3600000,
      toolHours: summary.totalToolMs / 3600000,
      totalTokens: summary.totalUncachedInputTokens + summary.totalOutputTokens +
        summary.totalCacheReadTokens + summary.totalCacheWriteTokens,
      maxSessionLlmMs,
    },
    modelUsage: modelDistribution,
    dailyTrend: dailyTrendResponse,
    rollingDailyTrend,
    sessions: sessionDetails,
    collectedAt: now,
  };
  // hourlyTrend is ledger-internal working data for the response cache's
  // hour-rollover re-emit; it never leaves the process.
  return { payload, hourlyTrend };
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

  const result = processSessionEvents(session.events, header);
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

function processSessionEvents(events, header) {
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

    if (!Array.isArray(timestamps)) continue;
    // Aggregate into daily trend (calendar day, for heatmap) and hourly
    // trend (epoch-floor hour, for the rolling 24h line chart).
    for (const stamp of timestamps) {
      const dailyBucket = ensureBucket(dailyTrend, dateStr(stamp.time), model);
      dailyBucket.uncachedInputTokens += stamp.uncachedInputTokens;
      dailyBucket.outputTokens += stamp.outputTokens;
      dailyBucket.cacheReadTokens += stamp.cacheReadTokens;
      dailyBucket.cacheWriteTokens += stamp.cacheWriteTokens;

      const hourlyBucket = ensureBucket(hourlyTrend, hourFloor(stamp.time), model);
      hourlyBucket.uncachedInputTokens += stamp.uncachedInputTokens;
      hourlyBucket.outputTokens += stamp.outputTokens;
      hourlyBucket.cacheReadTokens += stamp.cacheReadTokens;
      hourlyBucket.cacheWriteTokens += stamp.cacheWriteTokens;
    }
  }
}

/** Ensure a model bucket exists in a trend object and return it. */
function ensureBucket(trend, key, model) {
  if (!trend[key]) trend[key] = {};
  if (!trend[key][model]) {
    trend[key][model] = { uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  }
  return trend[key][model];
}
