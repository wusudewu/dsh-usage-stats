/**
 * dsh-usage-stats — Coding-plan quota adapter (Z.ai / 智谱 GLM only).
 *
 * Minimal adapters in the spirit of dsh-cost-meter's lib/coding-plans.js:
 * each adapter only declares its official endpoint URL, the environment
 * variable that supplies the API key, and a pure response parser. This module
 * performs NO network requests and has no side effects.
 */

/** Official quota endpoints (v4 first; v3 kept as a fallback). */
export const CODING_PLAN_ENDPOINTS = {
  zaiV4: 'https://api.z.ai/api/coding/paas/v4/dashboard/billing/coding_plan/usage',
  zaiV3: 'https://api.z.ai/api/coding/paas/v3/dashboard/billing/coding_plan/usage',
};

/** Environment variable that must hold the Z.ai API key. */
export const ZAI_API_KEY_ENV = 'ZAI_API_KEY';

/**
 * Normalize a raw percent-ish value to a 0–100 number (rounding to 0.1).
 * Accepts both percentile (0–100) and utilization (0–1 fraction) semantics:
 *  - v <= 1            → treated as a fraction, scaled by 100
 *  - 1 < v <= 100      → treated as an already-percent value
 *  - anything else     → null
 */
export function normalizePercent(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < 0) return null;
  if (value <= 1) return Math.round(value * 1000) / 10;
  if (value <= 100) return Math.round(value * 10) / 10;
  return null;
}

/**
 * Normalize a reset timestamp to an ISO 8601 string; '' when unparseable.
 * Accepts ISO strings, date strings and numeric timestamps.
 */
export function normalizeResetAt(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString();
}

/**
 * Parse a Z.ai coding-plan usage response into a normalized shape:
 *   { plans: [{ name, percent (0–100 or null), resetsAt (ISO or '') }] }
 * Recognizes `percentile` or `utilization` per plan; a wholesale failure
 * (missing/foreign payload) degrades to an empty plan list, never throws.
 */
export function parseZaiUsage(data) {
  if (typeof data !== 'object' || data === null || !Array.isArray(data.plans)) {
    return { plans: [] };
  }
  const plans = [];
  for (const plan of data.plans) {
    if (typeof plan !== 'object' || plan === null) continue;
    const raw = plan.percentile !== undefined && plan.percentile !== null
      ? plan.percentile
      : (plan.utilization !== undefined && plan.utilization !== null ? plan.utilization : undefined);
    const percent = normalizePercent(typeof raw === 'string' ? Number(raw) : raw);
    const resetsAt = normalizeResetAt(
      plan.resetsAt !== undefined ? plan.resetsAt
        : (plan.reset_at !== undefined ? plan.reset_at
          : (plan.resetAt !== undefined ? plan.resetAt
            : (plan.expiresAt !== undefined ? plan.expiresAt : undefined))),
    );
    const name = typeof plan.name === 'string' ? plan.name : '';
    // Skip completely-empty entries (no name, no percent, no reset time).
    if (name === '' && percent === null && resetsAt === '') continue;
    plans.push({ name, percent, resetsAt });
  }
  return { plans };
}
