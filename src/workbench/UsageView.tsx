import { useEffect, useState } from "react";
import { AlertIcon, ExternalIcon, SparkIcon } from "../theme/icons";
import { timeAgo } from "../lib/format";
import { levelTone, money, paceWarning, planName, resetText } from "../lib/usage";
import type { ClaudeAccount, PlanUsage, RateLimit, RateWindow } from "../lib/types";

const USAGE_PAGE = "https://claude.ai/settings/usage";
const UPGRADE_PAGE = "https://claude.ai/upgrade";

/**
 * The Usage tab: how much of the plan is used – this session, this week, per model and the extra
 * usage – with a warning when the current pace runs out before a reset, as in the Claude app. It
 * updates by itself (App asks Claude Code's `/usage` every few seconds while the tab is open, and
 * every message to Claude brings new numbers too). Buying usage and changing the plan open on
 * claude.ai, in Moon Code's web tab.
 */
export function UsageView({
  account,
  usage,
  limits,
  updatedAt,
  visible,
  onOpenWeb,
  onSignIn,
}: {
  account: ClaudeAccount | null;
  usage: PlanUsage | null;
  /** The last known limits from Claude's messages, when `/usage` has no plan numbers. */
  limits: RateLimit | null;
  /** When the numbers last changed hands (ms), for "updated … ago". */
  updatedAt: number | null;
  visible: boolean;
  onOpenWeb: (url: string) => void;
  onSignIn: () => void;
}) {
  // Relative times ("resets at…", "updated just now") move on by themselves.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, [visible]);

  const session = usage?.session ?? limits?.fiveHour ?? null;
  const week = usage?.week ?? limits?.sevenDay ?? null;
  const warning = paceWarning(session, week, now);
  const plan = planName(usage?.plan ?? account?.plan);
  const signedIn = Boolean(account?.loggedIn);
  const extra = usage?.extra ?? null;

  return (
    <div
      className="absolute inset-0 z-[2] overflow-auto"
      style={{ visibility: visible ? "visible" : "hidden", background: "var(--mc-editor)" }}
      aria-hidden={!visible}
    >
      <div className="mx-auto flex max-w-[760px] flex-col gap-5 px-8 py-7">
        <header className="flex items-center gap-2">
          <h1 className="m-0 text-[1rem] font-semibold">Your usage</h1>
          {plan && <span className="mc-chip mc-chip-muted">{plan}</span>}
          <span className="flex-1" />
          {signedIn && (
            <span
              className="flex items-center gap-1.5 text-[0.75rem] text-[var(--mc-text-faint)]"
              aria-live="polite"
            >
              <span className="mc-live-dot" aria-hidden="true" />
              Live{updatedAt ? ` · updated ${timeAgo(updatedAt, now)}` : ""}
            </span>
          )}
        </header>

        {!signedIn ? (
          <div className="mc-inset flex flex-col items-start gap-3 p-5">
            <p className="m-0 text-[0.875rem]">Sign in to Claude to see your plan&apos;s usage.</p>
            <button type="button" className="mc-btn mc-btn-primary mc-btn-sm" onClick={onSignIn}>
              Sign in
            </button>
          </div>
        ) : (
          <>
            {warning && (
              <p
                className="m-0 flex items-start gap-2 text-[1.375rem] font-semibold leading-snug"
                role="status"
              >
                <span className="mt-1.5 shrink-0" style={{ color: "var(--mc-warning)" }}>
                  <AlertIcon size={20} />
                </span>
                {warning}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="mc-btn mc-btn-primary"
                onClick={() => onOpenWeb(UPGRADE_PAGE)}
              >
                <SparkIcon size={14} /> Upgrade plan
              </button>
              <button type="button" className="mc-btn" onClick={() => onOpenWeb(USAGE_PAGE)}>
                Buy more usage
              </button>
            </div>

            <section className="flex flex-col gap-4 border-t border-[var(--mc-border)] pt-5">
              {!session && !week && (
                <p className="m-0 text-[0.8125rem] text-[var(--mc-text-muted)]">
                  Getting your usage from Claude Code…
                </p>
              )}
              {session && <UsageRow label="Current session" window={session} now={now} />}
              {week && <UsageRow label="This week" window={week} now={now} />}
              {(usage?.models ?? []).map((m) => (
                <UsageRow key={m.name} label={`This week · ${m.name}`} window={m} now={now} />
              ))}
            </section>

            <section className="flex flex-col gap-2 border-t border-[var(--mc-border)] pt-5">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="m-0 text-[0.875rem] font-semibold">Extra usage</h2>
                  <p className="m-0 text-[0.75rem] text-[var(--mc-text-muted)]">
                    {extra
                      ? extra.enabled
                        ? "On: Claude keeps working past your plan's limit, up to your monthly cap."
                        : "Off: when you reach a limit, Claude waits for the reset."
                      : "Credits that keep Claude working past your plan's limit."}
                  </p>
                </div>
                <button
                  type="button"
                  className="mc-btn mc-btn-ghost mc-btn-sm"
                  onClick={() => onOpenWeb(USAGE_PAGE)}
                >
                  Manage
                </button>
              </div>
              {extra && extra.limit !== null && (
                <div className="flex items-center gap-4">
                  <span className="w-[200px] shrink-0 text-[0.8125rem]">
                    {money(extra.used ?? 0, extra.currency)} of {money(extra.limit, extra.currency)}{" "}
                    this month
                  </span>
                  <Bar fraction={extra.utilization ?? (extra.used ?? 0) / (extra.limit || 1)} />
                </div>
              )}
            </section>

            <p className="m-0 flex items-center gap-1.5 text-[0.6875rem] text-[var(--mc-text-faint)]">
              {usage
                ? "From Claude Code's /usage: it updates every 30 seconds while this tab is open, and with every message to Claude. Checking costs no usage."
                : "From your messages to Claude: it updates with every answer."}
              <button
                type="button"
                className="mc-link ml-1 inline-flex items-center gap-1"
                onClick={() => onOpenWeb(USAGE_PAGE)}
              >
                All details on claude.ai <ExternalIcon size={11} />
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function UsageRow({ label, window: w, now }: { label: string; window: RateWindow; now: number }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-[200px] shrink-0">
        <div className="text-[0.875rem]">{label}</div>
        <div className="text-[0.75rem] text-[var(--mc-text-faint)]">
          {resetText(w.resetsAt, now)}
        </div>
      </div>
      <Bar fraction={w.utilization} />
      <span className="w-[86px] shrink-0 text-right text-[0.8125rem] text-[var(--mc-text-muted)]">
        {Math.round(w.utilization * 100)} % used
      </span>
    </div>
  );
}

function Bar({ fraction }: { fraction: number }) {
  const f = Math.max(0, Math.min(1, fraction));
  return (
    <div
      className="mc-meter mc-meter-lg min-w-0 flex-1"
      data-tone={levelTone(f)}
      role="progressbar"
      aria-valuenow={Math.round(f * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${f * 100}%` }} />
    </div>
  );
}
