import { useCallback, useRef, useState, type ReactNode } from "react";
import { TITLE_BAR_HEIGHT } from "../theme/frame-colors";
import {
  SkillsIcon,
  AccountIcon,
  BranchIcon,
  ClaudeIcon,
  CloudIcon,
  FilesIcon,
  MoonIcon,
  ProjectsIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
  TerminalIcon,
} from "../theme/icons";
import { MoonPhase } from "../theme/MoonPhase";
import { Axolotl } from "../mascot/Axolotl";
import { modelLabel } from "../lib/claude";
import { percent, timeUntil, tokens } from "../lib/format";
import type { RateLimit } from "../lib/types";

/**
 * The 40px custom title bar of the frameless window: the logo, the name, the command center in the
 * middle (the open folder; a click opens quick open) and room for the native window buttons.
 */
export function TitleBar({
  folderName,
  onQuickOpen,
  onOpenFolder,
}: {
  folderName: string | null;
  onQuickOpen: () => void;
  onOpenFolder: () => void;
}) {
  return (
    <header
      className="mc-titlebar relative z-10 flex shrink-0 items-center gap-3 pl-3"
      style={{ height: TITLE_BAR_HEIGHT, paddingRight: 146 }}
    >
      <img src="./moon-code-logo.svg" alt="" width={22} height={22} draggable={false} />
      <span className="mc-title text-[0.9375rem] font-semibold tracking-tight">Moon Code</span>
      <button type="button" className="mc-btn mc-btn-sm ml-1" onClick={onOpenFolder}>
        Open folder…
      </button>
      <div className="flex min-w-0 flex-1 justify-center">
        <button
          type="button"
          className="mc-input flex w-full max-w-[440px] items-center gap-2 text-left"
          style={{ height: "1.65rem", cursor: "pointer" }}
          onClick={onQuickOpen}
          title="Go to file (Ctrl+P)"
        >
          <SearchIcon size={13} />
          <span className="min-w-0 flex-1 truncate text-[var(--mc-text-muted)]">
            {folderName ?? "Moon Code"}
          </span>
          <span className="mc-kbd">Ctrl P</span>
        </button>
      </div>
    </header>
  );
}

export type SideView = "explorer" | "search" | "projects" | "skills";

/** The column of view buttons on the far left (the activity bar, in Moon colours). */
export function ActivityBar({
  view,
  claudeOpen,
  claudeBusy,
  onView,
  onClaude,
  onAccount,
  accountOpen = false,
  cloudOpen = false,
  onCloud,
  onSettings,
  updateReady = false,
}: {
  view: SideView | null;
  claudeOpen: boolean;
  claudeBusy: boolean;
  onView: (v: SideView) => void;
  onClaude: () => void;
  onAccount: () => void;
  /** The account menu is open. */
  accountOpen?: boolean;
  /** The cloud tab is in front. */
  cloudOpen?: boolean;
  /** Opens (or brings forward) the cloud tab. */
  onCloud: () => void;
  onSettings: () => void;
  /** A new Moon Code is out: a dot on the settings button. */
  updateReady?: boolean;
}) {
  const item = (v: SideView, label: string, icon: ReactNode, keys: string) => (
    <button
      type="button"
      className="mc-activity"
      aria-pressed={view === v}
      aria-label={label}
      title={`${label} (${keys})`}
      onClick={() => onView(v)}
    >
      {icon}
    </button>
  );
  return (
    <nav className="mc-activitybar flex w-12 shrink-0 flex-col items-center" aria-label="Views">
      {item("explorer", "Explorer", <FilesIcon />, "Ctrl+Shift+E")}
      {item("search", "Search", <SearchIcon />, "Ctrl+Shift+F")}
      {item("projects", "Projects", <ProjectsIcon />, "Ctrl+Shift+O")}
      <button
        type="button"
        className="mc-activity"
        aria-pressed={cloudOpen}
        aria-label="Cloud"
        title="Claude Code on the web, in a tab"
        onClick={onCloud}
      >
        <CloudIcon size={22} />
      </button>
      {item("skills", "Skills", <SkillsIcon />, "what Claude can do on top")}
      <button
        type="button"
        className="mc-activity"
        aria-pressed={claudeOpen}
        aria-label="Claude"
        title="Claude (Ctrl+L)"
        onClick={onClaude}
        style={{ color: claudeOpen ? "var(--mc-claude)" : undefined }}
      >
        <ClaudeIcon />
        {claudeBusy && <span className="mc-activity-badge" />}
      </button>
      <div className="flex-1" />
      <button
        type="button"
        className="mc-activity"
        aria-label="Claude account"
        aria-haspopup="menu"
        aria-expanded={accountOpen}
        title="Claude account, usage and help"
        onMouseDown={(e) => accountOpen && e.stopPropagation()}
        onClick={onAccount}
      >
        <AccountIcon />
      </button>
      <button
        type="button"
        className="mc-activity"
        aria-label={updateReady ? "Settings – an update is ready" : "Settings"}
        title={updateReady ? "Settings – a new Moon Code is out" : "Settings"}
        onClick={onSettings}
      >
        <SettingsIcon />
        {updateReady && (
          <span className="mc-activity-badge" style={{ background: "var(--color-lavender-300)" }} />
        )}
      </button>
    </nav>
  );
}

/** A small moon gauge with a label, for one of the plan's limit windows. */
export function LimitGauge({
  label,
  fraction,
  resetsAt,
  size = 15,
}: {
  label: string;
  fraction: number;
  resetsAt: number | null;
  size?: number;
}) {
  const tone =
    fraction >= 0.9 ? "var(--mc-danger)" : fraction >= 0.75 ? "var(--mc-warning)" : "inherit";
  return (
    <span
      className="inline-flex items-center gap-1"
      title={`${label}: ${percent(fraction)} used${resetsAt ? `, resets ${timeUntil(resetsAt)}` : ""}`}
    >
      <MoonPhase fraction={fraction} size={size} />
      <span style={{ color: tone }}>
        {label} {percent(fraction)}
      </span>
    </span>
  );
}

/** The bottom line: branch and terminal on the left, editor and Claude facts on the right. */
export function StatusBar({
  branch,
  cursor,
  language,
  model,
  limits,
  context,
  signedIn,
  busy,
  theme,
  panelOpen,
  onToggleTheme,
  onTogglePanel,
  onClaude,
}: {
  branch: string | null;
  cursor: { line: number; column: number } | null;
  language: string | null;
  model: string | null;
  limits: RateLimit | null;
  context: { used: number; window: number | null } | null;
  signedIn: boolean | null;
  /** Claude is working: Axo types in the status bar. */
  busy: boolean;
  theme: "dark" | "light";
  panelOpen: boolean;
  onToggleTheme: () => void;
  onTogglePanel: () => void;
  onClaude: () => void;
}) {
  return (
    <footer className="mc-statusbar relative z-10 flex h-6 shrink-0 items-stretch justify-between">
      <div className="flex min-w-0 items-stretch">
        {branch && (
          <span className="mc-status-item" style={{ cursor: "default" }}>
            <BranchIcon /> {branch}
          </span>
        )}
        <button
          type="button"
          className="mc-status-item"
          onClick={onTogglePanel}
          aria-pressed={panelOpen}
        >
          <TerminalIcon size={13} /> Terminal
        </button>
      </div>
      <div className="flex min-w-0 items-stretch">
        {cursor && (
          <span className="mc-status-item" style={{ cursor: "default" }}>
            Ln {cursor.line}, Col {cursor.column}
          </span>
        )}
        {language && (
          <span className="mc-status-item" style={{ cursor: "default" }}>
            {language}
          </span>
        )}
        <button
          type="button"
          className="mc-status-item mc-status-claude"
          onClick={onClaude}
          title="Claude: model, context and your plan's limits"
        >
          {busy ? <Axolotl mood="work" size={22} /> : <ClaudeIcon size={13} />}
          {signedIn === false ? (
            "Sign in to Claude"
          ) : (
            <>
              {modelLabel(model)}
              {context && (
                <span className="text-[var(--mc-text-muted)]">
                  · {tokens(context.used)}
                  {context.window ? ` / ${tokens(context.window)}` : ""}
                </span>
              )}
            </>
          )}
        </button>
        {limits?.fiveHour && (
          <button type="button" className="mc-status-item" onClick={onClaude}>
            <LimitGauge
              label="5h"
              fraction={limits.fiveHour.utilization}
              resetsAt={limits.fiveHour.resetsAt}
              size={14}
            />
          </button>
        )}
        {limits?.sevenDay && (
          <button type="button" className="mc-status-item" onClick={onClaude}>
            <LimitGauge
              label="Week"
              fraction={limits.sevenDay.utilization}
              resetsAt={limits.sevenDay.resetsAt}
              size={14}
            />
          </button>
        )}
        <button
          type="button"
          className="mc-status-item"
          onClick={onToggleTheme}
          aria-label={theme === "dark" ? "Switch to the day theme" : "Switch to the night theme"}
          title={theme === "dark" ? "Night theme" : "Day theme"}
        >
          {theme === "dark" ? <MoonIcon size={13} /> : <SunIcon size={13} />}
        </button>
      </div>
    </footer>
  );
}

/**
 * A draggable edge that resizes the area next to it. `onResize` gets the size the drag asks for;
 * `invert` is for areas on the right or at the bottom, which grow when the edge moves the other way.
 */
export function Sash({
  axis,
  size,
  min,
  max,
  invert = false,
  onResize,
  label,
}: {
  axis: "x" | "y";
  size: number;
  min: number;
  max: number;
  invert?: boolean;
  onResize: (size: number) => void;
  label: string;
}) {
  const [active, setActive] = useState(false);
  const start = useRef<{ pos: number; size: number } | null>(null);
  const clamp = useCallback((v: number) => Math.min(max, Math.max(min, v)), [min, max]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { pos: axis === "x" ? e.clientX : e.clientY, size };
    setActive(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    const delta = (axis === "x" ? e.clientX : e.clientY) - start.current.pos;
    onResize(clamp(start.current.size + (invert ? -delta : delta)));
  };
  const onPointerUp = () => {
    start.current = null;
    setActive(false);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 40 : 10;
    const grow =
      axis === "x" ? (invert ? "ArrowLeft" : "ArrowRight") : invert ? "ArrowUp" : "ArrowDown";
    const shrink =
      axis === "x" ? (invert ? "ArrowRight" : "ArrowLeft") : invert ? "ArrowDown" : "ArrowUp";
    if (e.key === grow) onResize(clamp(size + step));
    else if (e.key === shrink) onResize(clamp(size - step));
    else return;
    e.preventDefault();
  };

  return (
    // A focusable separator is a widget (it moves with the arrow keys); jsx-a11y doesn't know that.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      role="separator"
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      aria-label={label}
      aria-valuenow={Math.round(size)}
      aria-valuemin={min}
      aria-valuemax={max}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      className="mc-sash"
      data-axis={axis}
      data-active={active}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    />
  );
}
