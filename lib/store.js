/**
 * dsh-usage-stats — Persistent aggregate ledger.
 *
 * Synchronous read/write with an atomic tmp-file + rename commit so a crash
 * never leaves a half-written ledger. Every load degrades silently to an
 * empty ledger (first run or corrupt file), which the caller then treats as a
 * full backfill.
 *
 * Ledger shape (version 1):
 * {
 *   version: 1,
 *   cursors:      { [sessionId]: { lastProcessedIndex, lastProcessedEventTime } },
 *   summary:      { ...rebuilt aggregate mirrors... },
 *   modelUsage:   { [model]: { uncachedInputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, count } },
 *   dailyTrend:   { [dateKey]: { [model]: { ...buckets... } } },
 *   hourlyTrend:  { [hourKey]: { [model]: { ...buckets... } } },
 *   sessions:     { [sessionId]: { stats, tokenUsage, contextBreakdown, modelUsage } }
 * }
 * The four aggregate mirrors are written on every save; they exist so the
 * ledger stays self-contained and human-inspectable.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const LEDGER_VERSION = 1;
export const LEDGER_FILE = 'usage-stats-ledger.json';

/** Absolute path of the ledger file. */
export function ledgerPath() {
  return path.join(os.homedir(), '.dsh', LEDGER_FILE);
}

/** A fresh, all-zero ledger. */
export function createEmptyLedger() {
  return {
    version: LEDGER_VERSION,
    cursors: {},
    summary: {
      sessionCount: 0, liveCount: 0, persistedCount: 0,
      totalTurns: 0, totalSteps: 0, totalLlmMs: 0, totalToolMs: 0,
      totalTtftMs: 0, totalTtftSteps: 0, totalDecodeMs: 0, totalDecodeTokens: 0,
      totalUncachedInputTokens: 0, totalOutputTokens: 0,
      totalCacheReadTokens: 0, totalCacheWriteTokens: 0,
      totalSystemTokens: 0, totalToolsTokens: 0, totalMessageTokens: 0,
    },
    modelUsage: {},
    dailyTrend: {},
    hourlyTrend: {},
    sessions: {},
  };
}

/**
 * Load the ledger (synchronously). Never throws: a missing or unreadable file
 * falls back to an empty ledger, letting the caller run a full backfill.
 */
export function loadStore(file = ledgerPath()) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && parsed.version === LEDGER_VERSION) {
      return normalizeLedger(parsed);
    }
  } catch {
    // first run or corrupt file → empty ledger
  }
  return createEmptyLedger();
}

/** Persist the ledger atomically (tmp file + rename). Synchronous. */
export function saveStore(ledger, file = ledgerPath()) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(ledger, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

/** Tolerate partial/old ledgers by filling in any missing collections. */
function normalizeLedger(parsed) {
  const base = createEmptyLedger();
  return {
    ...base,
    ...parsed,
    version: LEDGER_VERSION,
    cursors: parsed.cursors && typeof parsed.cursors === 'object' ? parsed.cursors : {},
    sessions: parsed.sessions && typeof parsed.sessions === 'object' ? parsed.sessions : {},
    modelUsage: parsed.modelUsage && typeof parsed.modelUsage === 'object' ? parsed.modelUsage : {},
    dailyTrend: parsed.dailyTrend && typeof parsed.dailyTrend === 'object' ? parsed.dailyTrend : {},
    hourlyTrend: parsed.hourlyTrend && typeof parsed.hourlyTrend === 'object' ? parsed.hourlyTrend : {},
    summary: parsed.summary && typeof parsed.summary === 'object' ? { ...base.summary, ...parsed.summary } : base.summary,
  };
}
