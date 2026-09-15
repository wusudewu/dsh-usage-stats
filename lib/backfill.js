/**
 * dsh-usage-stats — Idempotent incremental session processing.
 *
 * The ledger keeps, per session, the folded products (stats / tokenUsage /
 * contextBreakdown / modelUsage) plus a cursor into its event log. On each
 * pass only sessions that actually grew are re-folded with the existing
 * folding helpers (whose (turn, step) per-step replacement semantics make
 * re-processing idempotent); frozen persisted sessions are never re-read, so
 * the O(n²) full-log replay of the old implementation disappears. The global
 * aggregate is then rebuilt from per-session products, which keeps repeated
 * runs byte-identical.
 *
 * The pass also reports whether the ledger was mutated (ledgerChanged) and a
 * cheap response signature (session ids/titles, live event counts) so the
 * caller can cache the built response and skip rebuild/save on idle polls.
 */
import { foldSessionStats, foldTokenUsage, foldContextBreakdown, foldModelUsage, mapWithConcurrency } from './fold.js';

/**
 * Ledger retention policy. Trend stamps older than 400 days are dropped —
 * the heatmap calendar only renders 52 weeks (364 days), so anything older
 * is invisible in the UI. A hard cap per model additionally bounds growth
 * from pathological event streams.
 */
export const RETENTION_MS = 400 * 24 * 60 * 60 * 1000; // 400 days
export const MAX_TIMESTAMPS_PER_MODEL = 10000;

/**
 * Prune stale trend timestamps from the ledger so it cannot grow
 * unbounded. Only timestamps (the raw material for daily/hourly/rolling
 * aggregation) are trimmed; per-session totals stay intact, so summary
 * KPIs are unaffected.
 *
 * @returns {boolean} true when any timestamp was removed.
 */
export function pruneLedger(ledger, now = Date.now()) {
  const cutoff = now - RETENTION_MS;
  let pruned = false;
  for (const id of Object.keys(ledger.sessions ?? {})) {
    const perModel = ledger.sessions[id]?.modelUsage;
    if (!Array.isArray(perModel)) continue;
    for (const item of perModel) {
      if (!Array.isArray(item.timestamps) || item.timestamps.length === 0) continue;
      const kept = item.timestamps.filter((stamp) => stamp.time >= cutoff);
      if (kept.length < item.timestamps.length) {
        item.timestamps = kept;
        pruned = true;
      }
      if (item.timestamps.length > MAX_TIMESTAMPS_PER_MODEL) {
        item.timestamps = item.timestamps.slice(-MAX_TIMESTAMPS_PER_MODEL);
        pruned = true;
      }
    }
  }
  return pruned;
}

/**
 * Per-session consecutive read-failure counter, for warn throttling: the
 * first failure logs at warn level but a permanently corrupt log must not
 * re-spam the host log on every 5-minute poll — later consecutive failures
 * degrade to debug. The counter resets whenever the log reads fine.
 */
const readFailures = new Map();

/** Fold one session's events into the four products stored per session. */
export function foldSession(events, header) {
  return {
    stats: foldSessionStats(events),
    tokenUsage: foldTokenUsage(events),
    contextBreakdown: foldContextBreakdown(events),
    modelUsage: foldModelUsage(events),
  };
}

/**
 * Incremental processing pass over live + persisted sessions.
 *
 * - live sessions: re-fold only when their in-memory event log has grown past
 *   the saved cursor (an empty log is still folded once so the session shows
 *   up in the output with all-zero stats).
 * - persisted sessions: read + fold only on first touch (no cursor yet);
 *   afterwards they are frozen and never re-read.
 * - sessions that no longer exist are pruned from cursors/sessions so stale
 *   data can never leak back into the aggregate.
 *
 * Mutates `ledger` in place and returns the session lists the caller needs
 * to rebuild the response, plus:
 * - `ledgerChanged`: true when the ledger was mutated (fold, first-touch
 *   read, or stale-entry removal) — the caller persists only then;
 * - `signature`: cheap fingerprint of the session universe (ids, titles,
 *   live event counts) — when it matches the previous pass, the built
 *   response is still current and can be served from cache.
 *
 * Idempotent: running it twice on unchanged inputs leaves the ledger
 * identical and reports ledgerChanged=false.
 *
 * @returns {Promise<{ sessionList, liveSessions, ledgerChanged, signature }>}
 */
export async function processSessions({ sessionQuery, sessionsService, ledger, concurrency = 4, logger }) {
  const sessionList = await sessionQuery.listSessions();
  const liveSessions = sessionsService?.list() ?? [];
  const liveById = new Map(liveSessions.map((session) => [session.id, session]));
  // Every session that still exists — frozen persisted ones included — stays
  // in the ledger; only sessions absent from BOTH lists get pruned.
  const known = new Set(sessionList.map((record) => record.header.id));
  for (const session of liveSessions) known.add(session.id);

  let ledgerChanged = false;
  const liveEventCounts = new Map();

  // Live sessions: only grow past the cursor triggers a re-fold.
  for (const session of liveSessions) {
    const events = Array.isArray(session.events) ? session.events : [];
    liveEventCounts.set(session.id, events.length);
    const cursor = ledger.cursors[session.id];
    if (cursor && cursor.lastProcessedIndex >= events.length - 1) continue;
    ledger.sessions[session.id] = foldSession(events, session.header);
    ledger.cursors[session.id] = { lastProcessedIndex: events.length - 1 };
    ledgerChanged = true;
  }

  // Persisted sessions: first touch only; frozen logs are never re-read.
  const persistedRecords = sessionList
    .filter((record) => !record.live && !liveById.has(record.header.id) && !ledger.cursors[record.header.id]);
  const results = await mapWithConcurrency(persistedRecords, concurrency, async (record) => {
    try {
      const loaded = await sessionQuery.readSession(record.header.id);
      readFailures.delete(record.header.id);
      return { id: record.header.id, events: loaded.events, header: loaded.session };
    } catch (error) {
      // Unreadable log → retried next pass. Log the first failure, then stay
      // quiet at warn level so a permanently corrupt session cannot spam the
      // host log on every poll cycle (B4 throttling).
      const fails = (readFailures.get(record.header.id) ?? 0) + 1;
      readFailures.set(record.header.id, fails);
      if (fails === 1) logger?.warn?.('usage-stats: failed to read session log', { sessionId: record.header.id, error });
      else logger?.debug?.('usage-stats: retrying unreadable session log', { sessionId: record.header.id, consecutiveFailures: fails });
      return { id: record.header.id, error: true };
    }
  });
  for (const item of results) {
    if (item?.error) continue; // unreadable log → ignore (retried next pass)
    known.add(item.id);
    ledger.sessions[item.id] = foldSession(item.events, item.header);
    ledger.cursors[item.id] = { lastProcessedIndex: item.events.length - 1 };
    ledgerChanged = true;
  }

  // Prune sessions the host no longer lists, so deleted sessions never count.
  // Safety valve (A4): a sessionList that is empty while the ledger holds
  // entries almost certainly means a transient host state (query layer not
  // ready / index rebuilding), not that every session was deleted at once.
  // Skip pruning for this pass and let the next poll re-confirm the deletion.
  if (sessionList.length === 0 && liveSessions.length === 0 && Object.keys(ledger.sessions).length > 0) {
    return { sessionList, liveSessions, ledgerChanged, signature: sessionSignature(sessionList, liveSessions, liveEventCounts) };
  }
  for (const id of Object.keys(ledger.sessions)) {
    if (!known.has(id)) {
      delete ledger.sessions[id];
      ledgerChanged = true;
    }
  }
  for (const id of Object.keys(ledger.cursors)) {
    if (!known.has(id)) {
      delete ledger.cursors[id];
      ledgerChanged = true;
    }
  }

  return { sessionList, liveSessions, ledgerChanged, signature: sessionSignature(sessionList, liveSessions, liveEventCounts) };
}

/**
 * Cheap fingerprint of everything that can change the *response* (not the
 * ledger): session ids + titles from the persisted list, and live session
 * ids + titles + event counts. A title rename with no new events flips the
 * signature but not the ledger, so the caller rebuilds the response without
 * touching disk.
 */
function sessionSignature(sessionList, liveSessions, liveEventCounts) {
  const parts = [`n:${sessionList.length}:${liveSessions.length}`];
  for (const record of sessionList) {
    parts.push(`${record.header.id}\u0000${record.header.title ?? ''}`);
  }
  for (const session of liveSessions) {
    parts.push(`L${session.id}\u0000${session.header?.title ?? ''}\u0000${liveEventCounts.get(session.id) ?? 0}`);
  }
  return parts.join('\u0001');
}
