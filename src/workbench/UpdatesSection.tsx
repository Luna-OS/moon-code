import type { ReactNode } from "react";
import { CheckIcon, DownloadIcon, ReloadIcon, SparkIcon } from "../theme/icons";
import { timeAgo } from "../lib/format";
import type { UpdateStatus } from "../lib/types";

/**
 * Settings → Updates: which Moon Code runs, whether GitHub has a newer one, and the one button that
 * gets it – check, download in the background, restart into it.
 */
export function UpdatesSection({
  status,
  autoCheck,
  onAutoCheck,
  onCheck,
  onDownload,
  onInstall,
}: {
  status: UpdateStatus | null;
  autoCheck: boolean;
  onAutoCheck: (on: boolean) => void;
  onCheck: () => void;
  onDownload: () => void;
  onInstall: () => void;
}) {
  const s = status;
  let line: string;
  let action: ReactNode = null;
  const btn = "mc-btn mc-btn-sm";

  switch (s?.state) {
    case "checking":
      line = "Looking on GitHub…";
      break;
    case "available":
      line = `Moon Code ${s.version} is out.`;
      action = (
        <button type="button" className={`${btn} mc-btn-primary`} onClick={onDownload}>
          <DownloadIcon size={13} /> Download {s.version}
        </button>
      );
      break;
    case "downloading":
      line = `Downloading ${s.version ?? "the update"}… ${s.percent ?? 0} %`;
      break;
    case "ready":
      line = `Moon Code ${s.version} is ready.`;
      action = (
        <button type="button" className={`${btn} mc-btn-primary`} onClick={onInstall}>
          <SparkIcon size={13} /> Restart and update
        </button>
      );
      break;
    case "none":
      line = "You have the newest Moon Code.";
      break;
    case "error":
      line = `Couldn't check: ${s.error ?? "unknown error"}`;
      break;
    case "unsupported":
      line = s.error ?? "Updates work in the installed app.";
      break;
    default:
      line = "Moon Code looks for new versions on GitHub.";
  }
  if (!action && s?.state !== "unsupported") {
    action = (
      <button
        type="button"
        className={`${btn} mc-btn-ghost`}
        onClick={onCheck}
        disabled={s?.state === "checking" || s?.state === "downloading"}
      >
        <ReloadIcon size={12} /> Check for updates
      </button>
    );
  }

  return (
    <section className="flex flex-col gap-2" aria-label="Updates">
      <div className="mc-label m-0">Updates</div>
      <div className="mc-inset flex flex-col gap-2 p-3">
        <div className="flex items-center gap-3">
          <img src="./moon-code-logo.svg" alt="" width={36} height={36} />
          <div className="min-w-0 flex-1">
            <div className="text-[0.8125rem] font-semibold">
              Moon Code {s?.current ?? ""}
              {s?.state === "none" && (
                <span
                  className="ml-1.5 inline-flex align-middle"
                  style={{ color: "var(--mc-success)" }}
                >
                  <CheckIcon size={13} />
                </span>
              )}
            </div>
            <div
              className="text-[0.75rem]"
              style={{
                color:
                  s?.state === "error"
                    ? "var(--mc-danger)"
                    : s?.state === "available" || s?.state === "ready"
                      ? "var(--mc-accent)"
                      : "var(--mc-text-muted)",
              }}
              aria-live="polite"
            >
              {line}
            </div>
          </div>
          {action}
        </div>
        {s?.state === "downloading" && (
          <div
            className="mc-meter"
            role="progressbar"
            aria-valuenow={s.percent ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Download"
          >
            <span style={{ width: `${s.percent ?? 0}%` }} />
          </div>
        )}
        {s?.notes &&
          (s.state === "available" || s.state === "downloading" || s.state === "ready") && (
            <p className="m-0 whitespace-pre-wrap text-[0.75rem] text-[var(--mc-text-muted)]">
              {s.notes}
            </p>
          )}
        <label className="flex items-center gap-2 text-[0.75rem] text-[var(--mc-text-muted)]">
          <input
            type="checkbox"
            className="mc-switch"
            checked={autoCheck}
            onChange={(e) => onAutoCheck(e.target.checked)}
          />
          Look for updates when Moon Code starts
          {s?.checkedAt ? (
            <span className="ml-auto text-[var(--mc-text-faint)]">
              checked {timeAgo(s.checkedAt)}
            </span>
          ) : null}
        </label>
      </div>
    </section>
  );
}
