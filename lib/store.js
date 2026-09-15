/**
 * dsh-usage-stats — Persistent incremental ledger.
 *
 * Synchronous read/write with an atomic tmp-file + rename commit so a crash
 * never leaves a half-written ledger. Every load degrades silently to an
 * empty ledger (first run or corrupt file), which the caller then treats as a
 * full backfill.
 *
 * Ledger shape (version 2):
 * {
 *   version: 2,
 *   cursors:  { [sessionId]: { lastProcessedIndex } },
 *   sessions: { [sessionId]: { stats, tokenUsage, contextBreakdown, modelUsage } }
 * }
 *
 * Version 1 additionally carried summary / modelUsage / dailyTrend /
 * hourlyTrend aggregate mirrors. They were written on every save but never
 * read back (the response aggregates are always rebuilt from the per-session
 * products), so v2 drops them — roughly halving the file and every
 * load/save cost. A v1 file still loads: normalizeLedger strips the mirrors
 * and the next save writes v2.
 *
 * Storage path: $DSH_USAGE_STATS_LEDGER when set to a non-empty value (lets
 * multiple host profiles keep separate ledgers), otherwise
 * ~/.dsh/usage-stats-ledger.json.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const LEDGER_VERSION = 2;
export const LEDGER_FILE = 'usage-stats-ledger.json';
export const LEDGER_PATH_ENV = 'DSH_USAGE_STATS_LEDGER';

/** Absolute path of the ledger file (env override wins). */
export function ledgerPath() {
  const fromEnv = process.env[LEDGER_PATH_ENV];
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') return fromEnv;
  return path.join(os.homedir(), '.dsh', LEDGER_FILE);
}

/** A fresh, empty ledger. */
export function createEmptyLedger() {
  return {
    version: LEDGER_VERSION,
    cursors: {},
    sessions: {},
  };
}

/**
 * Load the ledger (synchronously). Never throws: a missing or unreadable file
 * falls back to an empty ledger, letting the caller run a full backfill.
 * Version 1 files are accepted and normalized to version 2.
 */
export function loadStore(file = ledgerPath()) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && (parsed.version === LEDGER_VERSION || parsed.version === 1)) {
      return normalizeLedger(parsed);
    }
  } catch {
    // first run or corrupt file → empty ledger
  }
  return createEmptyLedger();
}

/**
 * Persist the ledger atomically (tmp file + rename). Compact JSON.
 * Synchronous. The tmp name carries the pid so two host processes sharing
 * one ledger path never write the same tmp file mid-commit; a failed write
 * removes its own tmp before rethrowing.
 */
export function saveStore(ledger, file = ledgerPath()) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(ledger), 'utf8');
    fs.renameSync(tmp, file);
  } catch (error) {
    try { fs.rmSync(tmp, { force: true }); } catch { /* best effort */ }
    throw error;
  }
}

/**
 * Tolerate partial/old ledgers: keep only the version-2 fields, fill in any
 * missing collections, and silently drop v1's aggregate mirrors.
 */
function normalizeLedger(parsed) {
  return {
    version: LEDGER_VERSION,
    cursors: parsed.cursors && typeof parsed.cursors === 'object' ? parsed.cursors : {},
    sessions: parsed.sessions && typeof parsed.sessions === 'object' ? parsed.sessions : {},
  };
}
