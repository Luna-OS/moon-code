/** The Usage tab's arithmetic: when a window runs out at the current pace, and how to say it. */
import type { RateWindow } from "./types";

export const SESSION_MS = 5 * 3_600_000;
export const WEEK_MS = 7 * 24 * 3_600_000;

/**
 * When the window reaches 100 % if usage goes on as fast as since the window started – or null
 * when that is after the reset (or too early in the window to tell).
 */
export function runsOutAt(w: RateWindow | null | undefined, lengthMs: number, now = Date.now()) {
  if (!w || !w.resetsAt || w.resetsAt <= now) return null;
  if (w.utilization >= 1) return now;
  const elapsed = lengthMs - (w.resetsAt - now);
  // Too little of the window has passed for a pace that means anything.
  if (elapsed < lengthMs * 0.04 || w.utilization <= 0.05) return null;
  const at = now + ((1 - w.utilization) / w.utilization) * elapsed;
  return at < w.resetsAt ? at : null;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** "09:40" */
export const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** "today at 21:10", "tomorrow at 08:00", "on Friday at 02:00" */
export function when(ms: number, now = Date.now()): string {
  const d = new Date(ms);
  const today = new Date(now);
  const tomorrow = new Date(now + 24 * 3_600_000);
  if (sameDay(d, today)) return `today at ${clock(ms)}`;
  if (sameDay(d, tomorrow)) return `tomorrow at ${clock(ms)}`;
  return `on ${d.toLocaleDateString("en-GB", { weekday: "long" })} at ${clock(ms)}`;
}

/** "Resets at 09:40" within a day, "Resets Friday, 02:00" later. */
export function resetText(resetsAt: number | null | undefined, now = Date.now()): string {
  if (!resetsAt) return "";
  const d = new Date(resetsAt);
  if (resetsAt - now < 20 * 3_600_000) return `Resets at ${clock(resetsAt)}`;
  return `Resets ${d.toLocaleDateString("en-GB", { weekday: "long" })}, ${clock(resetsAt)}`;
}

/** The warning above the bars, or null when the plan lasts until its resets. */
export function paceWarning(
  session: RateWindow | null | undefined,
  week: RateWindow | null | undefined,
  now = Date.now(),
): string | null {
  const weekOut = runsOutAt(week, WEEK_MS, now);
  if (weekOut !== null && week?.resetsAt) {
    if (weekOut <= now)
      return "You've used this week's limit. It resets " + when(week.resetsAt, now) + ".";
    return `Heads up: at this pace you'll run out ${when(weekOut, now)}, before the weekly reset ${when(week.resetsAt, now)}.`;
  }
  const sessionOut = runsOutAt(session, SESSION_MS, now);
  if (sessionOut !== null && session?.resetsAt) {
    if (sessionOut <= now)
      return `You've used this session's limit. It resets at ${clock(session.resetsAt)}.`;
    return `Heads up: at this pace this session runs out at ${clock(sessionOut)}, before it resets at ${clock(session.resetsAt)}.`;
  }
  return null;
}

/** 4000 cents in EUR → "€40.00" */
export function money(cents: number, currency: string | null): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency ?? ""}`.trim();
  }
}

/** The bar's tone for a fraction used: calm, getting close, nearly out. */
export const levelTone = (f: number) => (f >= 0.9 ? "danger" : f >= 0.7 ? "warning" : undefined);

/** "pro" → "Pro" */
export const planName = (plan: string | null | undefined) =>
  plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : null;
