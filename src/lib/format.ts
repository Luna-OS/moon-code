/** Display helpers. */

/** "3 min ago", "2 h ago", "yesterday", "4 d ago", or a date. */
export function timeAgo(ms: number, now = Date.now()): string {
  if (!ms) return "";
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 30) return `${d} d ago`;
  return new Date(ms).toLocaleDateString();
}

/** "in 2 h 24 min", "in 4 d 3 h" until a reset; "" when unknown. */
export function timeUntil(ms: number | null, now = Date.now()): string {
  if (!ms) return "";
  const m = Math.max(0, Math.round((ms - now) / 60_000));
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `in ${h} h ${m % 60} min` : `in ${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `in ${d} d ${h % 24} h` : `in ${d} d`;
}

/** 0.483 → "48 %" */
export const percent = (f: number) => `${Math.round(f * 100)} %`;

/** 18420 → "18.4k" */
export function tokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/** 0.0412 → "$0.04" */
export const dollars = (n: number) => `$${n < 0.01 && n > 0 ? n.toFixed(4) : n.toFixed(2)}`;
