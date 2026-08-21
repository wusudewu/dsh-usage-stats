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
 */
import { foldSessionStats, foldTokenUsage, foldContextBreakdown, foldModelUsage, mapWithConcurrency } from './fold.js';

/** Fold one session's events into the four products stored per session. */
export function foldSession(events, header) {
  return {
    stats: foldSessionStats(events),
    tokenUsage: foldTokenUsage(events),
    contextBreakdown: foldContextBreakdown(events),
    modelUsage: foldModelUsage(events),
  };
}

/** Time of the last event in a log, or null for an empty log. */
export function lastEventTime(events) {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i] && typeof events[i].time === 'number') return events[i].time;
  }
  return null;
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
 * to rebuild the response. Idempotent: running it twice on unchanged inputs
 * leaves the ledger identical.
 *
 * @returns {Promise<{ sessionList, liveSessions }>}
 */
export async function processSessions({ sessionQuery, sessionsService, ledger, concurrency = 4 }) {
  const sessionList = await sessionQuery.listSessions();
  const liveSessions = sessionsService?.list() ?? [];
  const liveById = new Map(liveSessions.map((session) => [session.id, session]));
  // Every session that still exists — frozen persisted ones included — stays
  // in the ledger; only sessions absent from BOTH lists get pruned.
  const known = new Set(sessionList.map((record) => record.header.id));
  for (const session of liveSessions) known.add(session.id);

  // Live sessions: only grow past the cursor triggers a re-fold.
  for (const session of liveSessions) {
    const events = Array.isArray(session.events) ? session.events : [];
    const cursor = ledger.cursors[session.id];
    if (cursor && cursor.lastProcessedIndex >= events.length - 1) continue;
    ledger.sessions[session.id] = foldSession(events, session.header);
    ledger.cursors[session.id] = {
      lastProcessedIndex: events.length - 1,
      lastProcessedEventTime: lastEventTime(events),
    };
  }

  // Persisted sessions: first touch only; frozen logs are never re-read.
  const persistedRecords = sessionList
    .filter((record) => !record.live && !liveById.has(record.header.id) && !ledger.cursors[record.header.id]);
  const results = await mapWithConcurrency(persistedRecords, concurrency, async (record) => {
    try {
      const loaded = await sessionQuery.readSession(record.header.id);
      return { id: record.header.id, events: loaded.events, header: loaded.session };
    } catch {
      return { id: record.header.id, error: true };
    }
  });
  for (const item of results) {
    if (item === undefined || item.error) continue; // unreadable log → ignore
    known.add(item.id);
    ledger.sessions[item.id] = foldSession(item.events, item.header);
    ledger.cursors[item.id] = {
      lastProcessedIndex: item.events.length - 1,
      lastProcessedEventTime: lastEventTime(item.events),
    };
  }

  // Prune sessions the host no longer lists, so deleted sessions never count.
  for (const id of Object.keys(ledger.sessions)) {
    if (!known.has(id)) delete ledger.sessions[id];
  }
  for (const id of Object.keys(ledger.cursors)) {
    if (!known.has(id)) delete ledger.cursors[id];
  }

  return { sessionList, liveSessions };
}
