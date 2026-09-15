/**
 * dsh-usage-stats — Unit tests for the persistent ledger store.
 *
 * Run with: node --test test/
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadStore, saveStore, createEmptyLedger, LEDGER_VERSION } from '../lib/store.js';

function tmpFile(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-us-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, 'ledger.json');
}

test('saveStore/loadStore round-trips the ledger', (t) => {
  const file = tmpFile(t);
  const ledger = createEmptyLedger();
  ledger.cursors.s1 = { lastProcessedIndex: 3 };
  ledger.sessions.s1 = { stats: { turns: 1 } };
  saveStore(ledger, file);
  assert.deepEqual(loadStore(file), ledger);
});

test('saveStore leaves no tmp file behind after success', (t) => {
  const file = tmpFile(t);
  saveStore(createEmptyLedger(), file);
  const leftovers = fs.readdirSync(path.dirname(file)).filter((n) => n.endsWith('.tmp'));
  assert.deepEqual(leftovers, []);
});

test('loadStore degrades to an empty ledger on missing file', (t) => {
  assert.deepEqual(loadStore(tmpFile(t)), createEmptyLedger());
});

test('loadStore degrades to an empty ledger on corrupt JSON', (t) => {
  const file = tmpFile(t);
  fs.writeFileSync(file, '{ not json');
  assert.deepEqual(loadStore(file), createEmptyLedger());
});

test('loadStore rejects unknown versions', (t) => {
  const file = tmpFile(t);
  fs.writeFileSync(file, JSON.stringify({ version: 99, cursors: {}, sessions: { x: 1 } }));
  assert.deepEqual(loadStore(file), createEmptyLedger());
});

test('loadStore normalizes a v1 ledger and drops aggregate mirrors', (t) => {
  const file = tmpFile(t);
  fs.writeFileSync(file, JSON.stringify({
    version: 1,
    cursors: { s1: { lastProcessedIndex: 2 } },
    sessions: { s1: { stats: null } },
    summary: { totalTokens: 123 },
    modelUsage: [{ model: 'm1' }],
    dailyTrend: {},
    hourlyTrend: {},
  }));
  const loaded = loadStore(file);
  assert.equal(loaded.version, LEDGER_VERSION);
  assert.deepEqual(Object.keys(loaded).sort(), ['cursors', 'sessions', 'version']);
  assert.deepEqual(Object.keys(loaded.sessions), ['s1']);
});

test('saveStore creates missing parent directories', (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-us-test-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const file = path.join(base, 'nested', 'deeper', 'ledger.json');
  saveStore(createEmptyLedger(), file);
  assert.ok(fs.existsSync(file));
});