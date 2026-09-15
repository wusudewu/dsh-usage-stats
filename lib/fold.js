/**
 * dsh-usage-stats — Pure session-log folding helpers.
 *
 * No dependencies, no side effects, no top-level state.
 *
 * v0.2 changes:
 * - Hourly trend buckets are now keyed by hourFloor(ts) — a numeric epoch
 *   hour — instead of a non-standard "YYYY-MM-DD HH:00" string. Bucketing no
 *   longer depends on engine-dependent Date parsing, and DST fall-back hours
 *   no longer collide into one bucket. hourStr() survives as a pure
 *   display-label builder.
 * - estimateContent is NaN-hardened: non-string text/name/arguments fields
 *   are measured via JSON stringification instead of producing
 *   undefined.length → NaN that would poison the whole context total.
 * - buildRollingDailyTrend accepts { fillFrom, fillTo } to emit a dense
 *   per-hour series (zero-filled) bounded by the fill range.
 */

export function isTokenDelta(chunk) {
  if (typeof chunk !== 'object' || chunk === null) return false;
  // Real streamed chunk types are the *-delta variants (see dsh-llm's
  // BlockAssembler); 'text'/'reasoning' are assembled BLOCK types and never
  // appear on a chunk. Mistaking them means the first-token time never fires,
  // zeroing TTFT/decode stats on every step.
  return chunk.type === 'text-delta' || chunk.type === 'reasoning-delta';
}

export function usageOutputTokens(usage) {
  if (typeof usage !== 'object' || usage === null) return null;
  const value = usage.outputTokens;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function foldSessionStats(events) {
  let turns = 0, steps = 0, llmMs = 0, toolMs = 0, ttftMs = 0, ttftSteps = 0, decodeMs = 0, decodeTokens = 0;
  let lastTurn = null, openStep = null;
  const pendingCalls = {};

  for (const event of events) {
    switch (event.type) {
      case 'step/start':
        openStep = { turn: event.data.turn, step: event.data.step, startTime: event.time, firstTokenTime: null };
        break;
      case 'assistant/chunk': {
        if (openStep === null || openStep.turn !== event.data.turn || openStep.step !== event.data.step) break;
        if (openStep.firstTokenTime !== null) break;
        if (!isTokenDelta(event.data.chunk)) break;
        openStep.firstTokenTime = event.time;
        break;
      }
      case 'assistant/message': {
        if (openStep === null || openStep.turn !== event.data.turn || openStep.step !== event.data.step) break;
        llmMs += Math.max(0, event.time - openStep.startTime);
        if (openStep.firstTokenTime !== null) {
          ttftMs += Math.max(0, openStep.firstTokenTime - openStep.startTime);
          ttftSteps += 1;
          const outputTokens = usageOutputTokens(event.data.usage);
          if (outputTokens !== null && outputTokens > 0) {
            decodeMs += Math.max(0, event.time - openStep.firstTokenTime);
            decodeTokens += outputTokens;
          }
        }
        openStep = null;
        break;
      }
      case 'tool/call':
        pendingCalls[event.data.callId] = event.time;
        break;
      case 'tool/result': {
        const callId = event.data.message.source?.callId;
        if (callId === undefined || !(callId in pendingCalls)) break;
        toolMs += Math.max(0, event.time - pendingCalls[callId]);
        delete pendingCalls[callId];
        break;
      }
      case 'step/end':
        turns = lastTurn === event.data.turn ? turns : turns + 1;
        steps += 1;
        lastTurn = event.data.turn;
        openStep = null;
        break;
      case 'turn/end':
        if (Object.keys(pendingCalls).length > 0) {
          Object.keys(pendingCalls).forEach((key) => delete pendingCalls[key]);
        }
        break;
    }
  }
  return { turns, steps, llmMs, toolMs, ttftMs, ttftSteps, decodeMs, decodeTokens };
}

export function foldTokenUsage(events) {
  const totals = { uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  let last = null;

  for (const event of events) {
    let turn, step, usage;
    if (event.type === 'assistant/chunk' && event.data.chunk?.type === 'usage') {
      turn = event.data.turn; step = event.data.step; usage = event.data.chunk.usage;
    } else if (event.type === 'assistant/message' && event.data.usage !== undefined) {
      turn = event.data.turn; step = event.data.step; usage = event.data.usage;
    } else continue;

    const buckets = bucketsFrom(usage);
    const previous = last !== null && last.turn === turn && last.step === step ? last.buckets : undefined;
    if (previous !== undefined && bucketsEqual(previous, buckets)) continue;

    totals.uncachedInputTokens = totals.uncachedInputTokens - (previous?.uncachedInputTokens ?? 0) + buckets.uncachedInputTokens;
    totals.outputTokens = totals.outputTokens - (previous?.outputTokens ?? 0) + buckets.outputTokens;
    totals.cacheReadTokens = totals.cacheReadTokens - (previous?.cacheReadTokens ?? 0) + buckets.cacheReadTokens;
    totals.cacheWriteTokens = totals.cacheWriteTokens - (previous?.cacheWriteTokens ?? 0) + buckets.cacheWriteTokens;
    last = { turn, step, buckets };
  }
  return totals;
}

export function bucketsFrom(usage) {
  return {
    uncachedInputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    cacheReadTokens: usage.cacheReadTokens ?? 0,
    cacheWriteTokens: usage.cacheWriteTokens ?? 0,
  };
}

export function bucketsEqual(left, right) {
  return left.uncachedInputTokens === right.uncachedInputTokens && left.outputTokens === right.outputTokens && left.cacheReadTokens === right.cacheReadTokens && left.cacheWriteTokens === right.cacheWriteTokens;
}

// ─── Context estimation ───────────────────────────────────────

/**
 * Length of a content value in chars, tolerating any shape. Strings count
 * their own length; null/undefined count 0; anything else is JSON-measured
 * (matching the old JSON.stringify fallback). Never throws, never NaN.
 */
function textLen(value) {
  if (typeof value === 'string') return value.length;
  if (value === null || value === undefined) return 0;
  try {
    const json = JSON.stringify(value);
    return typeof json === 'string' ? json.length : String(value).length;
  } catch {
    return String(value).length;
  }
}

export function foldContextBreakdown(events) {
  let systemTokens = 0, toolsTokens = 0, messageTokens = 0;
  const CHARS_PER_TOKEN = 4, BLOCK_OVERHEAD = 4;

  function estimateContent(blocks) {
    if (!Array.isArray(blocks)) return BLOCK_OVERHEAD + Math.ceil(textLen(blocks) / CHARS_PER_TOKEN);
    let tokens = 0;
    for (const block of blocks) {
      if (block === null || typeof block !== 'object') {
        tokens += BLOCK_OVERHEAD + Math.ceil(textLen(block) / CHARS_PER_TOKEN);
        continue;
      }
      switch (block.type) {
        case 'text': case 'reasoning':
          tokens += Math.ceil(textLen(block.text) / CHARS_PER_TOKEN) + BLOCK_OVERHEAD; break;
        case 'tool-call':
          tokens += Math.ceil(textLen(block.name) / CHARS_PER_TOKEN) + Math.ceil(textLen(block.arguments) / CHARS_PER_TOKEN) + BLOCK_OVERHEAD; break;
        case 'tool-result':
          tokens += estimateContent(block.content) + BLOCK_OVERHEAD; break;
        default:
          tokens += BLOCK_OVERHEAD + Math.ceil(textLen(block) / CHARS_PER_TOKEN);
      }
    }
    return tokens;
  }
  function estimateMessage(message) { return estimateContent(message?.content) + 4; }
  function estimateSystemTokens(header) { return header?.system ? Math.ceil(textLen(header.system) / CHARS_PER_TOKEN) + 4 : 0; }
  function estimateToolsTokens(header) { return header?.tools?.length ? Math.ceil(textLen(header.tools) / CHARS_PER_TOKEN) + BLOCK_OVERHEAD : 0; }

  let claim;
  for (const event of events) {
    if (event.type === 'request/header') {
      systemTokens = estimateSystemTokens(event.data.header);
      toolsTokens = estimateToolsTokens(event.data.header);
    }
    if (event.type === 'compaction/summary' || event.type === 'compaction/prune') {
      claim = { start: event.data.shadowedRange.start, end: event.data.shadowedRange.end, tokens: event.data.shadowedTokenCount };
      continue;
    }
    if (isSurfaceEvent(event)) {
      const message = deriveEventMessage(event);
      const tokens = message === null ? 0 : estimateMessage(message);
      const op = event.surfaceOp;
      if (op === 'append') messageTokens += tokens;
      else if (claim !== undefined) {
        if (claim.start === op.start && claim.end === op.end) messageTokens += tokens - claim.tokens;
        claim = undefined;
      }
    }
    // Non-surface events must NOT clear claim — compaction tokens
    // persist until the matching surface replacement event arrives.
  }
  return { systemTokens, toolsTokens, messageTokens };
}

export function isSurfaceEvent(event) {
  // Only the three message-producing event types join the model-visible
  // surface — tool/call is NOT surface-eligible (its call text is part of the
  // assistant message's content blocks) — and every surface event carries a
  // surfaceOp marker.
  return (event.type === 'user/message' || event.type === 'assistant/message' || event.type === 'tool/result')
    && event.surfaceOp !== undefined;
}

export function deriveEventMessage(event) {
  switch (event.type) {
    case 'user/message': return event.data;
    case 'assistant/message': {
      // An empty-content assistant/message exists only to host a
      // max-tokens step's usage; it must not add tokens to the context fold.
      // Missing/malformed content is treated the same way.
      const content = event.data.message?.content;
      return !content || content.length === 0 ? null : event.data.message;
    }
    case 'tool/result': return event.data.message;
    default: return null;
  }
}

export function foldModelUsage(events) {
  const modelMap = {}; // modelName -> { uncachedInputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, count, timestamps: [{time, ...}] }
  // modelName -> Map(stepKey -> { buckets, stamp }): the last usage sample
  // seen per (turn, step). A session log carries BOTH a streamed 'usage'
  // chunk and the final assistant/message usage for the same step; counting
  // both would double every per-model figure. Matching dsh-token-meter's
  // tokenUsage projection, a later sample for the same step REPLACES the
  // earlier one instead of adding on top.
  const perStep = new Map();
  let currentModel = null;
  let fallbackSeq = 0;

  const stepKeyOf = (event) => {
    const turn = event.data?.turn;
    const step = event.data?.step;
    return typeof turn === 'number' && typeof step === 'number' ? `${turn}:${step}` : null;
  };

  for (const event of events) {
    if (event.type === 'request/header') {
      const config = event.data.header?.config;
      if (config?.model) {
        currentModel = config.model;
      }
      continue;
    }

    let usage;
    if (event.type === 'assistant/message') usage = event.data.usage;
    else if (event.type === 'assistant/chunk' && event.data.chunk?.type === 'usage') usage = event.data.chunk.usage;
    else continue;
    if (usage === undefined || usage === null || !currentModel) continue;

    const buckets = {
      uncachedInputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      cacheReadTokens: usage.cacheReadTokens ?? 0,
      cacheWriteTokens: usage.cacheWriteTokens ?? 0,
    };

    let m = modelMap[currentModel];
    if (!m) {
      m = modelMap[currentModel] = {
        uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0,
        count: 0, timestamps: [],
      };
    }

    let steps = perStep.get(currentModel);
    if (!steps) {
      steps = new Map();
      perStep.set(currentModel, steps);
    }
    // Without numeric turn/step we cannot pair samples; count each event once.
    // Use a bounded fallback key so the sequence never grows unbounded on a
    // degenerate event stream.
    const stepKey = stepKeyOf(event) ?? `#fallback:${fallbackSeq < 1e6 ? fallbackSeq++ : 'excess'}`;
    const prior = steps.get(stepKey);

    if (prior !== undefined) {
      // Replace the earlier sample for the same step: swap out its buckets in
      // the totals and move its trend stamp to this event's time/value.
      m.uncachedInputTokens = m.uncachedInputTokens - prior.buckets.uncachedInputTokens + buckets.uncachedInputTokens;
      m.outputTokens = m.outputTokens - prior.buckets.outputTokens + buckets.outputTokens;
      m.cacheReadTokens = m.cacheReadTokens - prior.buckets.cacheReadTokens + buckets.cacheReadTokens;
      m.cacheWriteTokens = m.cacheWriteTokens - prior.buckets.cacheWriteTokens + buckets.cacheWriteTokens;
      prior.buckets = buckets;
      prior.stamp.time = event.time;
      prior.stamp.uncachedInputTokens = buckets.uncachedInputTokens;
      prior.stamp.outputTokens = buckets.outputTokens;
      prior.stamp.cacheReadTokens = buckets.cacheReadTokens;
      prior.stamp.cacheWriteTokens = buckets.cacheWriteTokens;
    } else {
      m.uncachedInputTokens += buckets.uncachedInputTokens;
      m.outputTokens += buckets.outputTokens;
      m.cacheReadTokens += buckets.cacheReadTokens;
      m.cacheWriteTokens += buckets.cacheWriteTokens;
      m.count += 1;
      const stamp = {
        time: event.time,
        uncachedInputTokens: buckets.uncachedInputTokens,
        outputTokens: buckets.outputTokens,
        cacheReadTokens: buckets.cacheReadTokens,
        cacheWriteTokens: buckets.cacheWriteTokens,
      };
      m.timestamps.push(stamp);
      steps.set(stepKey, { buckets, stamp });
    }
  }

  return Object.entries(modelMap).map(([model, data]) => ({ model, ...data }));
}

// ─── Concurrency helper ───────────────────────────────────────

export async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        results[index] = await fn(items[index], index);
      } catch (error) {
        results[index] = { error };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

// ─── Time series ──────────────────────────────────────────────

export function buildTimeSeries(trend) {
  const keys = Object.keys(trend).sort();
  const allModels = new Set();
  for (const key of keys) {
    for (const model of Object.keys(trend[key])) {
      allModels.add(model);
    }
  }
  const modelList = [...allModels].sort();
  return {
    labels: keys,
    models: modelList,
    series: keys.map((key) => {
      const entry = trend[key];
      const point = { date: key };
      for (const model of modelList) {
        const m = entry[model] || { uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
        point[model] = m;
      }
      return point;
    }),
  };
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Floor a timestamp to its hour boundary (UTC-stable: pure arithmetic). */
export function hourFloor(ts) {
  return Math.floor(ts / HOUR_MS) * HOUR_MS;
}

/** Local-time calendar-day label, e.g. "2026-01-05". Display + daily keys. */
export function dateStr(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Display-only hour label for a bucket key, e.g. "2026-01-05 14:00".
 * Never parsed back into a time — bucketing keys off hourFloor() epochs.
 */
export function hourStr(ts) {
  const d = new Date(ts);
  return `${dateStr(ts)} ${String(d.getHours()).padStart(2, '0')}:00`;
}

/**
 * Build a rolling 24-hour trend series from hourly bucketed data.
 *
 * @param hourlyTrend map of hourFloor(ts) epoch-hour → { [model]: buckets }.
 * @param opts optional { fillFrom, fillTo } epochs. When provided the output
 *   is a DENSE per-hour series from hourFloor(fillFrom) through
 *   max(hourFloor(fillTo), latest bucket hour), zero-filling hours without
 *   data. Without them the output stays sparse (one point per non-empty hour).
 * @returns {{ labels: string[], models: string[], series: object[] }} each
 *   point sums every bucket in the window [t - 24h, t]. O(n) accumulator.
 */
export function buildRollingDailyTrend(hourlyTrend, opts = {}) {
  const hours = Object.keys(hourlyTrend)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  const allModels = new Set();
  for (const hour of hours) {
    for (const model of Object.keys(hourlyTrend[hour])) allModels.add(model);
  }
  const modelList = [...allModels].sort();
  if (hours.length === 0 || modelList.length === 0) {
    return { labels: [], models: [], series: [] };
  }

  // Sliding window accumulator — O(n) instead of O(n²)
  const window = {};
  for (const model of modelList) {
    window[model] = { uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  }

  function shiftBucket(hourKey, sign) {
    const hourData = hourlyTrend[hourKey];
    for (const model of modelList) {
      const m = hourData[model];
      if (!m) continue;
      const w = window[model];
      w.uncachedInputTokens += sign * (m.uncachedInputTokens || 0);
      w.outputTokens += sign * (m.outputTokens || 0);
      w.cacheReadTokens += sign * (m.cacheReadTokens || 0);
      w.cacheWriteTokens += sign * (m.cacheWriteTokens || 0);
    }
  }

  // Monotone two-pointer: emit() walks times ascending, so buckets only ever
  // enter the window from the right and leave from the left.
  let left = 0;
  let right = 0;
  function advanceTo(time) {
    while (right < hours.length && hours[right] <= time) {
      shiftBucket(hours[right], 1);
      right++;
    }
    // Boundary matches the historical semantics: exactly 24h old stays in.
    while (left < right && hours[left] < time - DAY_MS) {
      shiftBucket(hours[left], -1);
      left++;
    }
  }

  const labels = [];
  const series = [];
  function emit(time) {
    advanceTo(time);
    const label = hourStr(time);
    labels.push(label);
    const point = { date: label };
    for (const model of modelList) {
      point[model] = { ...window[model] }; // copy: snapshots must not alias
    }
    series.push(point);
  }

  const fillFrom = typeof opts?.fillFrom === 'number' && Number.isFinite(opts.fillFrom) ? hourFloor(opts.fillFrom) : null;
  if (fillFrom !== null) {
    const requestedTo = typeof opts.fillTo === 'number' && Number.isFinite(opts.fillTo) ? hourFloor(opts.fillTo) : fillFrom;
    const end = Math.max(requestedTo, hours[hours.length - 1]);
    for (let t = fillFrom; t <= end; t += HOUR_MS) emit(t);
  } else {
    for (const hour of hours) emit(hour);
  }

  return { labels, models: modelList, series };
}
