/**
 * dsh-usage-stats — Thin network helpers with bounded retry.
 *
 * Pure functions, no side effects, no third-party dependencies. Retry policy
 * mirrors the transient-error taxonomy used by dsh-cost-meter's lib/net.js
 * (MIT): only connection-level / DNS / socket / undici faults are retried,
 * business errors and HTTP status codes are rethrown / returned as-is.
 */

/** Transient error codes that are safe to retry. */
export const TRANSIENT_CODES = [
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
  'EAI_AGAIN',
];

/**
 * Decide whether `error` is a transient network fault worth retrying.
 * - TimeoutError / AbortError are always retryable;
 * - an error carrying a concrete `code` follows the whitelist (any `UND_ERR_*`
 *   undici code is retryable, anything else with a code is not);
 * - a bare 'fetch failed' TypeError with no code (undici's wrapper shape) is
 *   treated as transient.
 */
export function isTransientFetchError(error) {
  if (!error || typeof error !== 'object') return false;
  const name = error.name;
  if (name === 'TimeoutError' || name === 'AbortError') return true;

  if (typeof error.code === 'string' && error.code !== '') {
    if (TRANSIENT_CODES.includes(error.code)) return true;
    if (error.code.startsWith('UND_ERR_')) return true;
    return false; // concrete code but not in the whitelist → business error
  }

  // No code: the undici 'fetch failed' wrapper around a lower-level fault.
  if (error instanceof TypeError && error.message === 'fetch failed') return true;
  if (typeof error.message === 'string' && error.message === 'fetch failed') return true;
  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build a fresh signal per attempt (never reuse an already-aborted one).
 * With `timeoutMs > 0` an inner AbortController enforces the deadline
 * (abort reason is a native TimeoutError, equivalent to AbortSignal.timeout)
 * and stays connected to the caller's optional `outer` signal; without a
 * timeout the caller's signal is passed through untouched.
 */
function buildSignal(outer, timeoutMs) {
  if (!(timeoutMs > 0)) return outer;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException('The operation timed out.', 'TimeoutError')),
    timeoutMs,
  );
  const onOuterAbort = () => controller.abort(
    outer && outer.reason !== undefined
      ? outer.reason
      : new DOMException('The operation was aborted.', 'AbortError'),
  );
  if (outer) {
    if (outer.aborted) controller.abort(outer.reason);
    else outer.addEventListener('abort', onOuterAbort, { once: true });
  }
  controller.signal.addEventListener('abort', () => {
    clearTimeout(timer);
    if (outer) outer.removeEventListener('abort', onOuterAbort);
  }, { once: true });
  return controller.signal;
}

/**
 * Refuse to fetch anything except an https URL whose host is not a
 * localhost, link-local, loopback, or private/reserved address.
 * Returns true when the URL is safe to fetch.
 */
function isSafeOutboundUrl(raw) {
  let u;
  try {
    u = raw instanceof URL ? raw : new URL(String(raw));
  } catch {
    return false;
  }
  if (!/^https:$/i.test(u.protocol)) return false;
  const h = u.hostname.replace(/^www\./, '').toLowerCase();
  if (!h || h === 'localhost') return false;
  if (/^(127\.0\.0\.1|0\.0\.0\.0|255\.255\.255\.255|::1|ip6-localhost)$/.test(h)) return false;
  if (h.endsWith('.internal') || h.endsWith('.local') || h.endsWith('.onion')) return false;
  if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(h)) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split('.').slice(0, 2).map(Number);
    if (a === 127 || a === 0 || a === 224 || a === 239 || a === 255) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
  }
  return true;
}

/**
 * fetch with bounded retry on transient faults only.
 *
 * @param {string|URL} url      passed to fetch()
 * @param {object} init         passed to fetch(); a custom `init.signal` is honoured
 * @param {object} [options]
 * @param {number} [options.attempts=4]   total attempts (>=1)
 * @param {number} [options.backoffMs=300] base backoff; delay is
 *   Math.min(1500, backoffMs * 2 ** (attempt - 2))
 * @param {number} [options.timeoutMs=0]  per-attempt deadline; 0 disables
 * @returns {Promise<Response>} resolves with the raw Response (HTTP status is
 *   NOT checked — callers decide on status codes); non-transient errors and a
 *   final transient error are rethrown unchanged.
 */
export async function fetchWithRetry(url, init = {}, { attempts = 4, backoffMs = 300, timeoutMs = 0 } = {}) {
  if (!isSafeOutboundUrl(url)) {
    throw new TypeError('Unsafe outbound URL refused');
  }
  const maxAttempts = Math.max(1, Number.isFinite(attempts) ? Math.floor(attempts) : 1);
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const signal = buildSignal(init && init.signal, timeoutMs);
    try {
      return await fetch(url, { ...init, signal });
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts || !isTransientFetchError(error)) throw error;
      const delay = Math.min(1500, backoffMs * 2 ** (attempt - 2));
      await sleep(delay);
    }
  }
  throw lastError; // unreachable: loop either returns or throws
}
