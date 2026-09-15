/**
 * dsh-usage-stats — Unit tests for the incremental backfill pass.
 *
 * Run with: node --test test/
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { processSessions } from '../lib/backfill.js';
import { createEmptyLedger } from '../lib/store.js';

// ─── helpers ──────────────────────────────────────────────────

function persistedRecord(id, title = 't-' + id) {
  return { header: { id, title }, live: false, persisted: true };
}

function makeQuery({ list, logs = {}, onRead }) {
  return {
    async listSessions() { return list.map((r) => ({ ...r })); },
    async readSession(id) {
      if (onRead) onRead(id);
      const log = logs[id];
      if (!log) throw new Error('missing log: ' + id);
      return { events: log.events ?? [], session: log.header ?? { id } };
    },
  };
}

const usageEvents = [
  { type: 'request/header', time: 1000, data: { header: { config: { model: 'm1' } } } },
  { type: 'assistant/message', time: 2000, data: { turn: 0, step: 0, usage: { inputTokens: 10, outputTokens: 5 } } },
];

// ─── processSessions ──────────────────────────────────────────

test('processSessions: first pass folds live and persisted sessions', async () => {
  const ledger = createEmptyLedger();
  const sessionQuery = makeQuery({
    list: [persistedRecord('p1')],
    logs: { p1: { events: usageEvents, header: { id: 'p1', title: 'p1', createdAt: 1 } } },
  });
  const live = [{ id: 'l1', header: { title: 'l1' }, events: [] }];
  const out = await processSessions({
    sessionQuery,
    sessionsService: { list: () => live },
    ledger,
    concurrency: 2,
    logger: null,
  });
  assert.equal(out.ledgerChanged, true);
  assert.ok(ledger.sessions.p1, 'persisted session folded');
  assert.ok(ledger.sessions.l1, 'empty live session still folded once');
  assert.equal(ledger.cursors.p1.lastProcessedIndex, usageEvents.length - 1);
  assert.deepEqual(Object.keys(ledger.cursors).sort(), ['l1', 'p1']);
});

test('processSessions: idempotent second pass reports ledgerChanged=false', async () => {
  const ledger = createEmptyLedger();
  const sessionQuery = makeQuery({
    list: [persistedRecord('p1')],
    logs: { p1: { events: usageEvents, header: { id: 'p1', title: 'p1', createdAt: 1 } } },
  });
  await processSessions({ sessionQuery, sessionsService: null, ledger, logger: null });
  const snapshot = JSON.stringify(ledger);
  const out = await processSessions({ sessionQuery, sessionsService: null, ledger, logger: null });
  assert.equal(out.ledgerChanged, false);
  assert.equal(JSON.stringify(ledger), snapshot, 'ledger byte-identical on an unchanged pass');
});

test('processSessions: live growth re-folds, frozen persisted logs are never re-read', async () => {
  const ledger = createEmptyLedger();
  let reads = 0;
  const sessionQuery = makeQuery({
    list: [persistedRecord('p1')],
    logs: { p1: { events: usageEvents, header: { id: 'p1', title: 'p1', createdAt: 1 } } },
    onRead: () => { reads++; },
  });
  const live = [{ id: 'l1', header: { title: 'l1' }, events: [] }];
  const svc = { list: () => live };
  await processSessions({ sessionQuery, sessionsService: svc, ledger, logger: null });
  assert.equal(reads, 1);

  // Grow the live session; persisted read count must stay at one.
  live[0].events = usageEvents.slice();
  const out = await processSessions({ sessionQuery, sessionsService: svc, ledger, logger: null });
  assert.equal(out.ledgerChanged, true);
  assert.equal(reads, 1, 'frozen persisted session is never re-read');
  assert.equal(ledger.sessions.l1.tokenUsage.outputTokens, 5, 'live re-fold picked up new events');
});

test('processSessions: sessions absent from both lists are pruned from sessions+cursors', async () => {
  const ledger = createEmptyLedger();
  ledger.sessions.gone = { stats: null };
  ledger.cursors.gone = { lastProcessedIndex: 0 };
  const out = await processSessions({
    sessionQuery: makeQuery({ list: [persistedRecord('p1')], logs: { p1: { events: usageEvents, header: { id: 'p1' } } } }),
    sessionsService: null,
    ledger,
    logger: null,
  });
  assert.equal(out.ledgerChanged, true);
  assert.deepEqual(Object.keys(ledger.sessions), ['p1']);
  assert.deepEqual(Object.keys(ledger.cursors), ['p1']);
});

test('processSessions: A4 safety valve — wholesale-empty list never prunes a populated ledger', async () => {
  const ledger = createEmptyLedger();
  ledger.sessions.p1 = { stats: null, tokenUsage: null };
  ledger.cursors.p1 = { lastProcessedIndex: 5 };
  const out = await processSessions({
    sessionQuery: makeQuery({ list: [] }),
    sessionsService: { list: () => [] },
    ledger,
    logger: null,
  });
  assert.equal(out.ledgerChanged, false);
  assert.ok(ledger.sessions.p1, 'ledger survives one transiently-empty pass');
  assert.ok(ledger.cursors.p1);
});

test('processSessions: empty ledger + empty host state stays clean (valve does not stick)', async () => {
  const ledger = createEmptyLedger();
  const out = await processSessions({
    sessionQuery: makeQuery({ list: [] }),
    sessionsService: { list: () => [] },
    ledger,
    logger: null,
  });
  assert.equal(out.ledgerChanged, false);
  assert.deepEqual(ledger.sessions, {});
});

test('processSessions: B4 — unreadable log warns once, then only debug-level retries', async () => {
  const ledger = createEmptyLedger();
  const levels = [];
  const logger = {
    warn: (msg) => levels.push(['warn', msg]),
    debug: (msg) => levels.push(['debug', msg]),
  };
  const sessionQuery = makeQuery({ list: [persistedRecord('bad1')], logs: {} });
  await processSessions({ sessionQuery, sessionsService: null, ledger, logger });
  await processSessions({ sessionQuery, sessionsService: null, ledger, logger });
  await processSessions({ sessionQuery, sessionsService: null, ledger, logger });
  const warns = levels.filter((l) => l[0] === 'warn').length;
  const debugs = levels.filter((l) => l[0] === 'debug').length;
  assert.equal(warns, 1, 'only the first failure logs at warn level');
  assert.equal(debugs, 2, 'subsequent retries degrade to debug');
  assert.deepEqual(ledger.sessions, {}, 'failed session never reaches the ledger');
});