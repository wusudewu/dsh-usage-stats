/**
 * dsh-usage-stats — Unit tests for the pure folding helpers.
 *
 * Run with: node --test test/
 * Uses Node's built-in test runner (Node 18+), no dependencies.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isTokenDelta,
  usageOutputTokens,
  foldSessionStats,
  foldTokenUsage,
  bucketsFrom,
  bucketsEqual,
  foldContextBreakdown,
  isSurfaceEvent,
  foldModelUsage,
  buildTimeSeries,
  buildRollingDailyTrend,
  dateStr,
  hourStr,
  hourFloor,
} from '../lib/fold.js';

const HOUR = 3600000;
const baseTime = Date.UTC(2026, 0, 15, 12); // 2026-01-15 12:00 UTC

// ─── isTokenDelta ─────────────────────────────────────────────

test('isTokenDelta: only *-delta chunk types count as token deltas', () => {
  assert.equal(isTokenDelta({ type: 'text-delta' }), true);
  assert.equal(isTokenDelta({ type: 'reasoning-delta' }), true);
  assert.equal(isTokenDelta({ type: 'text' }), false, 'assembled block types must not count');
  assert.equal(isTokenDelta({ type: 'reasoning' }), false);
  assert.equal(isTokenDelta({ type: 'usage' }), false);
  assert.equal(isTokenDelta(null), false);
  assert.equal(isTokenDelta(undefined), false);
  assert.equal(isTokenDelta('text-delta'), false, 'non-object chunks are not deltas');
});

// ─── usageOutputTokens ────────────────────────────────────────

test('usageOutputTokens: extracts valid non-negative outputTokens', () => {
  assert.equal(usageOutputTokens({ outputTokens: 42 }), 42);
  assert.equal(usageOutputTokens({ outputTokens: 0 }), 0);
  assert.equal(usageOutputTokens({ outputTokens: -1 }), null);
  assert.equal(usageOutputTokens({ outputTokens: NaN }), null);
  assert.equal(usageOutputTokens({ outputTokens: '42' }), null, 'non-number rejected');
  assert.equal(usageOutputTokens({}), null);
  assert.equal(usageOutputTokens(null), null);
});

// ─── foldSessionStats ─────────────────────────────────────────

function stepStart(turn, step, time) {
  return { type: 'step/start', time, data: { turn, step } };
}
function chunk(turn, step, time, type = 'text-delta') {
  return { type: 'assistant/chunk', time, data: { turn, step, chunk: { type } } };
}
function message(turn, step, time, usage) {
  return { type: 'assistant/message', time, data: { turn, step, usage } };
}
function stepEnd(turn, step, time) {
  return { type: 'step/end', time, data: { turn, step } };
}
function turnEnd(time) {
  return { type: 'turn/end', time, data: {} };
}
function toolCall(callId, time) {
  return { type: 'tool/call', time, data: { callId } };
}
function toolResult(callId, time) {
  return { type: 'tool/result', time, data: { message: { source: { callId } } } };
}

test('foldSessionStats: counts turns and steps', () => {
  const events = [
    stepStart(0, 0, baseTime),
    chunk(0, 0, baseTime + 100),
    message(0, 0, baseTime + 500, { outputTokens: 10 }),
    stepEnd(0, 0, baseTime + 600),
    stepStart(1, 0, baseTime + 1000),
    chunk(1, 0, baseTime + 1100),
    message(1, 0, baseTime + 1500, { outputTokens: 20 }),
    stepEnd(1, 0, baseTime + 1600),
  ];
  const stats = foldSessionStats(events);
  assert.equal(stats.turns, 2);
  assert.equal(stats.steps, 2);
});

test('foldSessionStats: multiple steps in same turn count as one turn', () => {
  const events = [
    stepStart(0, 0, baseTime),
    stepEnd(0, 0, baseTime + 100),
    stepStart(0, 1, baseTime + 200),
    stepEnd(0, 1, baseTime + 300),
  ];
  const stats = foldSessionStats(events);
  assert.equal(stats.turns, 1);
  assert.equal(stats.steps, 2);
});

test('foldSessionStats: computes LLM time, TTFT, decode ms/tokens', () => {
  const events = [
    stepStart(0, 0, baseTime),
    chunk(0, 0, baseTime + 200), // first token at +200
    message(0, 0, baseTime + 1000, { outputTokens: 100 }),
    stepEnd(0, 0, baseTime + 1100),
  ];
  const stats = foldSessionStats(events);
  assert.equal(stats.llmMs, 1000);
  assert.equal(stats.ttftMs, 200);
  assert.equal(stats.ttftSteps, 1);
  assert.equal(stats.decodeMs, 800); // 1000 - 200
  assert.equal(stats.decodeTokens, 100);
});

test('foldSessionStats: no TTFT when no token delta before message', () => {
  const events = [
    stepStart(0, 0, baseTime),
    message(0, 0, baseTime + 1000, { outputTokens: 50 }),
    stepEnd(0, 0, baseTime + 1100),
  ];
  const stats = foldSessionStats(events);
  assert.equal(stats.llmMs, 1000);
  assert.equal(stats.ttftMs, 0);
  assert.equal(stats.ttftSteps, 0);
  assert.equal(stats.decodeMs, 0);
  assert.equal(stats.decodeTokens, 0);
});

test('foldSessionStats: chunk from another step does not set first-token', () => {
  const events = [
    stepStart(0, 0, baseTime),
    chunk(9, 9, baseTime + 200), // wrong turn/step → ignored
    message(0, 0, baseTime + 1000, { outputTokens: 50 }),
    stepEnd(0, 0, baseTime + 1100),
  ];
  const stats = foldSessionStats(events);
  assert.equal(stats.ttftSteps, 0);
});

test('foldSessionStats: tool time from call to result', () => {
  const events = [
    stepStart(0, 0, baseTime),
    toolCall('c1', baseTime + 100),
    toolResult('c1', baseTime + 300),
    stepEnd(0, 0, baseTime + 400),
  ];
  const stats = foldSessionStats(events);
  assert.equal(stats.toolMs, 200);
});

test('foldSessionStats: unmatched tool/result ignored', () => {
  const events = [
    stepStart(0, 0, baseTime),
    toolResult('ghost', baseTime + 300),
    stepEnd(0, 0, baseTime + 400),
  ];
  const stats = foldSessionStats(events);
  assert.equal(stats.toolMs, 0);
});

test('foldSessionStats: empty log is all zeros', () => {
  const stats = foldSessionStats([]);
  assert.deepEqual(stats, {
    turns: 0, steps: 0, llmMs: 0, toolMs: 0, ttftMs: 0, ttftSteps: 0, decodeMs: 0, decodeTokens: 0,
  });
});

// ─── bucketsFrom / bucketsEqual ───────────────────────────────

test('bucketsFrom: fills missing fields with 0', () => {
  assert.deepEqual(bucketsFrom({ inputTokens: 5 }), {
    uncachedInputTokens: 5, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0,
  });
  assert.deepEqual(bucketsFrom({}), {
    uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0,
  });
});

test('bucketsEqual: compares all four fields', () => {
  assert.equal(bucketsEqual({ a: 1 }, { a: 1 }), true); // structural equality on window keys
  assert.equal(bucketsEqual(
    { uncachedInputTokens: 1, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 4 },
    { uncachedInputTokens: 1, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 4 },
  ), true);
  assert.equal(bucketsEqual(
    { uncachedInputTokens: 1, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 4 },
    { uncachedInputTokens: 9, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 4 },
  ), false);
});

// ─── foldTokenUsage ───────────────────────────────────────────

test('foldTokenUsage: accumulates distinct steps', () => {
  const events = [
    { type: 'assistant/message', time: baseTime, data: { turn: 0, step: 0, usage: { inputTokens: 100, outputTokens: 20 } } },
    { type: 'assistant/message', time: baseTime + 100, data: { turn: 0, step: 1, usage: { outputTokens: 30 } } },
  ];
  const totals = foldTokenUsage(events);
  assert.deepEqual(totals, {
    uncachedInputTokens: 100, outputTokens: 50, cacheReadTokens: 0, cacheWriteTokens: 0,
  });
});

test('foldTokenUsage: later sample for same step REPLACES earlier (no double count)', () => {
  const events = [
    { type: 'assistant/message', time: baseTime, data: { turn: 0, step: 0, usage: { inputTokens: 100, outputTokens: 20 } } },
    // Same step re-reported with larger numbers — must replace, not add
    { type: 'assistant/message', time: baseTime + 100, data: { turn: 0, step: 0, usage: { inputTokens: 200, outputTokens: 40 } } },
  ];
  const totals = foldTokenUsage(events);
  assert.equal(totals.uncachedInputTokens, 200);
  assert.equal(totals.outputTokens, 40);
});

test('foldTokenUsage: duplicate identical sample skipped', () => {
  const events = [
    { type: 'assistant/message', time: baseTime, data: { turn: 0, step: 0, usage: { outputTokens: 20 } } },
    { type: 'assistant/message', time: baseTime + 100, data: { turn: 0, step: 0, usage: { outputTokens: 20 } } },
  ];
  const totals = foldTokenUsage(events);
  assert.equal(totals.outputTokens, 20);
});

test('foldTokenUsage: usage chunk without data.chunk does not crash (bug #1 fix)', () => {
  const events = [
    { type: 'assistant/chunk', time: baseTime, data: { turn: 0, step: 0 } }, // no chunk field
    { type: 'assistant/message', time: baseTime + 100, data: { turn: 0, step: 0, usage: { outputTokens: 20 } } },
  ];
  const totals = foldTokenUsage(events);
  assert.equal(totals.outputTokens, 20);
});

// ─── foldContextBreakdown ─────────────────────────────────────

function surfaceMessage(type, time, surfaceOp, message) {
  return { type, time, surfaceOp, data: type === 'user/message' ? message : { message } };
}

test('foldContextBreakdown: estimates message tokens by char count', () => {
  const events = [
    surfaceMessage('user/message', baseTime, 'append', { content: [{ type: 'text', text: 'hello world' }] }),
  ];
  const { messageTokens } = foldContextBreakdown(events);
  // 11 chars / 4 → 3 (ceil) + 4 overhead + 4 message = 11
  assert.equal(messageTokens, 11);
});

test('foldContextBreakdown: system and tools from request/header', () => {
  const events = [
    { type: 'request/header', time: baseTime, data: { header: { system: 'You are a helpful assistant', tools: [{ name: 't1' }] } } },
  ];
  const { systemTokens, toolsTokens } = foldContextBreakdown(events);
  assert.ok(systemTokens > 0);
  assert.ok(toolsTokens > 0);
});

test('foldContextBreakdown: compaction claim adjusts tokens (bug #2 fix)', () => {
  const events = [
    // compaction shadows range [0,3] with 100 tokens
    { type: 'compaction/summary', time: baseTime, data: { shadowedRange: { start: 0, end: 3 }, shadowedTokenCount: 100 } },
    // a non-surface event in between must NOT clear the claim
    { type: 'assistant/chunk', time: baseTime + 50, data: { turn: 0, step: 0, chunk: { type: 'text-delta' } } },
    // the replacement surface event with the same range
    surfaceMessage('user/message', baseTime + 100, { start: 0, end: 3 }, { content: [{ type: 'text', text: 'short' }] }),
  ];
  const { messageTokens } = foldContextBreakdown(events);
  // replacement estimated tokens: 'short' = 5 chars → ceil(5/4)=2 +4 overhead =6, +4 message = 10; minus claimed 100
  assert.equal(messageTokens, 10 - 100);
});

test('foldContextBreakdown: isSurfaceEvent only for message events with surfaceOp', () => {
  assert.equal(isSurfaceEvent({ type: 'user/message', surfaceOp: 'append', data: {} }), true);
  assert.equal(isSurfaceEvent({ type: 'assistant/message', surfaceOp: 'append', data: {} }), true);
  assert.equal(isSurfaceEvent({ type: 'tool/result', surfaceOp: 'append', data: {} }), true);
  assert.equal(isSurfaceEvent({ type: 'tool/call', surfaceOp: 'append', data: {} }), false);
  assert.equal(isSurfaceEvent({ type: 'user/message', data: {} }), false, 'missing surfaceOp');
});

// ─── foldModelUsage ───────────────────────────────────────────

test('foldModelUsage: aggregates per model with request/header', () => {
  const events = [
    { type: 'request/header', time: baseTime, data: { header: { config: { model: 'm1' } } } },
    { type: 'assistant/message', time: baseTime + 100, data: { turn: 0, step: 0, usage: { inputTokens: 10, outputTokens: 5 } } },
    { type: 'assistant/message', time: baseTime + 200, data: { turn: 0, step: 1, usage: { inputTokens: 20, outputTokens: 8 } } },
  ];
  const result = foldModelUsage(events);
  assert.equal(result.length, 1);
  assert.equal(result[0].model, 'm1');
  assert.equal(result[0].uncachedInputTokens, 30);
  assert.equal(result[0].outputTokens, 13);
  assert.equal(result[0].count, 2);
  assert.equal(result[0].timestamps.length, 2);
});

test('foldModelUsage: same step replacement does not double count', () => {
  const events = [
    { type: 'request/header', time: baseTime, data: { header: { config: { model: 'm1' } } } },
    { type: 'assistant/chunk', time: baseTime + 100, data: { turn: 0, step: 0, chunk: { type: 'usage', usage: { outputTokens: 5 } } } },
    { type: 'assistant/message', time: baseTime + 200, data: { turn: 0, step: 0, usage: { outputTokens: 12 } } },
  ];
  const result = foldModelUsage(events);
  assert.equal(result[0].outputTokens, 12); // replaced, not 5+12
  assert.equal(result[0].count, 1);
  assert.equal(result[0].timestamps.length, 1);
});

test('foldModelUsage: no model header → usage skipped', () => {
  const events = [
    { type: 'assistant/message', time: baseTime, data: { turn: 0, step: 0, usage: { outputTokens: 5 } } },
  ];
  const result = foldModelUsage(events);
  assert.deepEqual(result, []);
});

test('foldModelUsage: usage chunk without chunk field does not crash', () => {
  const events = [
    { type: 'request/header', time: baseTime, data: { header: { config: { model: 'm1' } } } },
    { type: 'assistant/chunk', time: baseTime + 100, data: { turn: 0, step: 0 } }, // no chunk
    { type: 'assistant/message', time: baseTime + 200, data: { turn: 0, step: 0, usage: { outputTokens: 7 } } },
  ];
  const result = foldModelUsage(events);
  assert.equal(result[0].outputTokens, 7);
});

// ─── buildTimeSeries ──────────────────────────────────────────

test('buildTimeSeries: produces sorted labels and per-model series', () => {
  const trend = {
    '2026-01-16': { m2: { uncachedInputTokens: 2, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 } },
    '2026-01-15': { m1: { uncachedInputTokens: 1, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 } },
  };
  const ts = buildTimeSeries(trend);
  assert.deepEqual(ts.labels, ['2026-01-15', '2026-01-16']);
  assert.deepEqual(ts.models, ['m1', 'm2']);
  assert.equal(ts.series[0].m1.uncachedInputTokens, 1);
  assert.equal(ts.series[0].m2.uncachedInputTokens, 0, 'missing model zero-filled');
});

// ─── buildRollingDailyTrend ───────────────────────────────────

function hourBucket(hourOffset) {
  // v0.2 buckets are keyed by hourFloor() epoch-hours (numeric), not the old
  // "YYYY-MM-DD HH:00" display strings.
  return String(hourFloor(baseTime + hourOffset * HOUR));
}

const mk = (uncachedInputTokens, outputTokens = 0, cacheReadTokens = 0, cacheWriteTokens = 0) =>
  ({ uncachedInputTokens, outputTokens, cacheReadTokens, cacheWriteTokens });

test('buildRollingDailyTrend: empty input → empty result', () => {
  assert.deepEqual(buildRollingDailyTrend({}), { labels: [], models: [], series: [] });
});

test('buildRollingDailyTrend: each point sums the last 24h (sliding window)', () => {
  // hour 0: 100 tokens ; hour 1: 50 tokens ; hour 23: 30 tokens ; hour 48: 200 tokens
  const trend = {};
  trend[hourBucket(0)] = { m1: mk(100) };
  trend[hourBucket(1)] = { m1: mk(50) };
  trend[hourBucket(23)] = { m1: mk(30) };
  trend[hourBucket(48)] = { m1: mk(200) };

  const result = buildRollingDailyTrend(trend);
  assert.equal(result.labels.length, 4);
  assert.deepEqual(result.models, ['m1']);

  // point 0 sees only hour 0
  assert.equal(result.series[0].m1.uncachedInputTokens, 100);
  // point 1 sees hours 0..1
  assert.equal(result.series[1].m1.uncachedInputTokens, 150);
  // point 2 (hour 23) sees hours 0,1,23 — all within 24h of hour 23
  assert.equal(result.series[2].m1.uncachedInputTokens, 180);
  // point 3 (hour 48) — hours 0 and 1 have fallen out (>24h), only hour 23 (+48=24h exactly? no, 48-23=25h → out)
  assert.equal(result.series[3].m1.uncachedInputTokens, 200);
});

test('buildRollingDailyTrend: boundary — exactly 24h old stays in window', () => {
  const trend = {};
  trend[hourBucket(0)] = { m1: mk(100) };
  trend[hourBucket(23)] = { m1: mk(30) };
  const result = buildRollingDailyTrend(trend);
  // hour 23 - hour 0 = 23h < 24h → stays in window
  assert.equal(result.series[1].m1.uncachedInputTokens, 130);
});

test('buildRollingDailyTrend: multiple models summed independently', () => {
  const trend = {};
  trend[hourBucket(0)] = { m1: mk(10), m2: mk(20) };
  trend[hourBucket(1)] = { m1: mk(5), m2: mk(3) };
  const result = buildRollingDailyTrend(trend);
  assert.equal(result.series[1].m1.uncachedInputTokens, 15);
  assert.equal(result.series[1].m2.uncachedInputTokens, 23);
});

test('buildRollingDailyTrend: snapshot copies do not alias window state', () => {
  const trend = {};
  trend[hourBucket(0)] = { m1: mk(100) };
  trend[hourBucket(1)] = { m1: mk(50) };
  const result = buildRollingDailyTrend(trend);
  // Mutating a returned point must not affect other points
  result.series[0].m1.uncachedInputTokens = 9999;
  assert.equal(result.series[1].m1.uncachedInputTokens, 150);
});

// ─── dateStr / hourStr ────────────────────────────────────────

test('dateStr / hourStr format timestamps in local time', () => {
  // Construct in LOCAL time: dateStr/hourStr format via local getters (by design)
  const d = new Date(2026, 0, 5, 14, 30);
  assert.equal(dateStr(d.getTime()), '2026-01-05');
  assert.equal(hourStr(d.getTime()), '2026-01-05 14:00');
});

test('pruneLedger retention (from backfill)', async () => {
  const { pruneLedger, RETENTION_MS } = await import('../lib/backfill.js');
  const now = Date.now();
  const oldStamp = { time: now - RETENTION_MS - 1000, uncachedInputTokens: 1, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  const freshStamp = { time: now - 1000, uncachedInputTokens: 2, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  const ledger = {
    sessions: {
      s1: { modelUsage: [{ model: 'm1', timestamps: [oldStamp, freshStamp] }] },
    },
  };
  pruneLedger(ledger, now);
  assert.equal(ledger.sessions.s1.modelUsage[0].timestamps.length, 1);
  assert.equal(ledger.sessions.s1.modelUsage[0].timestamps[0].time, freshStamp.time);
});