// Formatting helpers shared across pages.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Parse a YYYY-MM-DD string as a UTC midnight Date.
 * CivicTrack stores day-precision dates in UTC so the demo behaves the
 * same in every timezone.
 */
export function parseUtcDate(value) {
  if (!value) return null;
  const d = typeof value === 'string' ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format a date (ISO string or Date) as "15 Oct 2025". */
export function formatDate(value) {
  const d = parseUtcDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Format a date with time, e.g. "15 Oct 2025, 14:05". */
export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${formatDate(d)}, ${d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

/** Today's calendar date at UTC midnight. */
export function todayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Whole days between two dates (b - a). */
export function daysBetween(a, b) {
  const da = parseUtcDate(a);
  const db = parseUtcDate(b);
  if (!da || !db) return null;
  return Math.round((db - da) / MS_PER_DAY);
}

/** "in 5 days" / "3 days ago" / "today" */
export function relativeDays(value) {
  const diff = daysBetween(todayUtc(), value);
  if (diff === null) return '—';
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  return diff > 0 ? `in ${diff} days` : `${Math.abs(diff)} days ago`;
}

/** Currency with compact grouping, e.g. "₹1.2 Cr" or "₹45 L". */
export function formatBudget(amount, currency = 'INR') {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '—';
  const n = Number(amount);
  const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : `${currency} `;
  if (n >= 1e7) return `${symbol}${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `${symbol}${(n / 1e5).toFixed(2)} L`;
  return `${symbol}${n.toLocaleString('en-IN')}`;
}

/** Truncate long text with an ellipsis. */
export function truncate(text, max = 120) {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Extract a readable message from an axios/api error. */
export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const data = error?.response?.data;
  if (data?.error?.message) return data.error.message;
  if (typeof data === 'string' && data.length < 300) return data;
  if (error?.message && !error.message.startsWith('Network')) return error.message;
  return fallback;
}

/** Initials for avatars. */
export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}
