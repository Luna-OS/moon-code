import { useState, type ReactNode } from "react";
import {
  AlertIcon,
  CheckIcon,
  CloudIcon,
  DownloadIcon,
  HistoryIcon,
  SendIcon,
} from "../theme/icons";
import { CLAUDE_CODE_WEB, sessionRef, sessionUrl } from "../lib/cloud";
import { timeAgo } from "../lib/format";
import { basename } from "../lib/paths";
import type { ClaudeAccount, CloudSent, CloudTask, GitHubAccount, Repo } from "../lib/types";
import { GitHubCard } from "./GitHubCard";

/**
 * Cloud coding: hand a task to Claude Code on the web, which works on the GitHub repository in a
 * cloud sandbox (your computer can be off) and pushes a branch when it's done. The tasks start
 * through your own Claude Code (`claude --cloud`, `--teleport`, `--remote-control`, `ultrareview`)
 * in a terminal tab, so you see exactly what happens; the sessions themselves open in Moon Code's
 * cloud tab, and follow-ups go to them from here (`claude -p … --cloud <session>`).
 */
export function CloudView({
  claude,
  github,
  folder,
  repo,
  repos,
  tasks,
  onRun,
  onStartTask,
  onClaudeSignIn,
  onGitHubSignIn,
  onGitHubSignOut,
  onGitHubInstall,
  onGitHubRefresh,
  onOpen,
  onOpenWeb,
  onSend,
  onTeleport,
}: {
  claude: ClaudeAccount | null;
  github: GitHubAccount | null;
  folder: string | null;
  /** "owner/name" of the open folder's GitHub remote. */
  repo: string | null;
  /** The GitHub account's repositories (null while they load). */
  repos: Repo[] | null;
  tasks: CloudTask[];
  /** Runs `claude <args>` in a new terminal tab with that title. */
  onRun: (args: string[], title: string) => void;
  /** Starts a cloud task on `target` (null: the open folder's repository). */
  onStartTask: (task: string, target: Repo | null) => Promise<void>;
  onClaudeSignIn: () => void;
  onGitHubSignIn: () => void;
  onGitHubSignOut: () => void;
  onGitHubInstall: () => void;
  onGitHubRefresh: () => void;
  /** Opens a link in the browser (GitHub pages). */
  onOpen: (url: string) => void;
  /** Opens a claude.ai/code page in Moon Code's cloud tab. */
  onOpenWeb: (url: string) => void;
  /** Queues a message into a cloud session. */
  onSend: (ref: string, message: string) => Promise<CloudSent>;
  /** Continues a cloud session on this computer, in a checkout of `repo` (null: the open one). */
  onTeleport: (id: string, repo: string | null) => void;
}) {
  const [task, setTask] = useState("");
  const [session, setSession] = useState("");
  /** The session whose message box is open: a task's `at`, or "typed" for the field. */
  const [messaging, setMessaging] = useState<number | "typed" | null>(null);
  const [filter, setFilter] = useState("");
  /** The repository picked in the list; until then the open folder's. */
  const [chosen, setChosen] = useState<string | null>(null);
  const [preparing, setPreparing] = useState<string | null>(null);
  const claudeOk = Boolean(claude?.installed && claude.loggedIn);
  const githubOk = Boolean(github?.loggedIn);
  const target = chosen ?? repo;
  const ready = claudeOk && githubOk && Boolean(target) && !preparing;

  const start = async () => {
    const t = task.trim();
    if (!t || !ready || !target) return;
    const other = target !== repo ? (repos ?? []).find((r) => r.fullName === target) : null;
    setPreparing(target);
    try {
      await onStartTask(t, other ?? null);
      setTask("");
    } finally {
      setPreparing(null);
    }
  };

  const typed = sessionRef(session);
  const q = filter.trim().toLowerCase();
  const shown = (repos ?? []).filter(
    (r) => !q || r.fullName.toLowerCase().includes(q) || r.description.toLowerCase().includes(q),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mc-section-title">
        <span className="flex-1">Cloud</span>
        <button
          type="button"
          className="mc-icon-btn"
          style={{ width: 24, height: 24 }}
          aria-label="Open Claude Code on the web"
          title="Open claude.ai/code in Moon Code"
          onClick={() => onOpenWeb(CLAUDE_CODE_WEB)}
        >
          <CloudIcon size={14} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-3 pb-4 text-[0.8125rem]">
        <p className="m-0 text-[0.75rem] text-[var(--mc-text-muted)]">
          Hand a task to Claude in the cloud. It works on your GitHub repository in its own sandbox
          – your computer can even be off – and pushes a branch when it&apos;s done. You follow it
          right here, in the Cloud tab.
        </p>

        <section className="flex flex-col gap-1.5" aria-label="What the cloud needs">
          <Requirement
            ok={claudeOk}
            label={claudeOk ? `Claude: ${claude?.email ?? "signed in"}` : "Claude account"}
          >
            {!claudeOk && (
              <button type="button" className="mc-btn mc-btn-sm" onClick={onClaudeSignIn}>
                Sign in
              </button>
            )}
          </Requirement>
          <Requirement
            ok={githubOk}
            label={githubOk ? `GitHub: @${github?.login}` : "GitHub account"}
          />
          <Requirement
            ok={Boolean(target)}
            label={
              target
                ? `Repository: ${target}`
                : folder
                  ? `${basename(folder)} isn't on GitHub – pick a repository`
                  : "Pick a repository"
            }
          />
        </section>

        <GitHubCard
          account={github}
          onSignIn={onGitHubSignIn}
          onSignOut={onGitHubSignOut}
          onInstall={onGitHubInstall}
          onRefresh={onGitHubRefresh}
          onOpen={onOpen}
        />

        {githubOk && (
          <section className="flex flex-col gap-1.5">
            <h3 className="mc-eyebrow m-0">Your repositories</h3>
            <input
              className="mc-input w-full"
              placeholder="Filter repositories"
              aria-label="Filter repositories"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <div
              role="radiogroup"
              aria-label="Repository for the cloud task"
              className="mc-inset flex max-h-[220px] flex-col overflow-auto p-1"
            >
              {repos === null && (
                <span className="px-2 py-1 text-[0.75rem] text-[var(--mc-text-faint)]">
                  Loading…
                </span>
              )}
              {repos?.length === 0 && (
                <span className="px-2 py-1 text-[0.75rem] text-[var(--mc-text-faint)]">
                  No repositories found.
                </span>
              )}
              {shown.map((r) => (
                <button
                  key={r.fullName}
                  type="button"
                  role="radio"
                  aria-checked={target === r.fullName}
                  className="mc-row shrink-0 flex-col items-start gap-0 py-1"
                  title={r.description || r.fullName}
                  onClick={() => setChosen(r.fullName)}
                  style={{
                    background: target === r.fullName ? "var(--mc-selected)" : undefined,
                  }}
                >
                  <span className="flex w-full items-center gap-1.5">
                    <span className="min-w-0 truncate font-medium">{r.name}</span>
                    {r.private && <span className="mc-chip mc-chip-muted">private</span>}
                    {r.fullName === repo && <span className="mc-chip mc-chip-mint">open</span>}
                  </span>
                  <span className="w-full truncate text-[0.6875rem] text-[var(--mc-text-faint)]">
                    {[r.fullName, r.language, r.updated ? timeAgo(r.updated) : ""]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
              ))}
            </div>
            {target && target !== repo && (
              <p className="m-0 text-[0.6875rem] text-[var(--mc-text-faint)]">
                Not open here: Moon Code clones it into your projects folder first (once).
              </p>
            )}
          </section>
        )}

        <section className="flex flex-col gap-1.5">
          <h3 className="mc-eyebrow m-0 flex items-center gap-1.5">
            <CloudIcon size={12} /> New cloud task
          </h3>
          <div className="mc-composer px-3 pb-2 pt-2.5">
            <textarea
              rows={4}
              placeholder={
                target ? `What should Claude do in ${target}?` : "What should Claude do?"
              }
              aria-label="Cloud task"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void start();
                }
              }}
            />
            <div className="mt-1.5 flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[0.6875rem] text-[var(--mc-text-faint)]">
                Ctrl+Enter starts it
              </span>
              <button
                type="button"
                className="mc-btn mc-btn-primary mc-btn-sm"
                disabled={!ready || !task.trim()}
                onClick={() => void start()}
              >
                <CloudIcon size={13} /> {preparing ? "Getting it ready…" : "Start in the cloud"}
              </button>
            </div>
          </div>
          <p className="m-0 text-[0.6875rem] text-[var(--mc-text-faint)]">
            The session opens in the Cloud tab as soon as it starts. The first time, Claude asks to
            connect the repository through its GitHub app.
          </p>
        </section>

        <section className="flex flex-col gap-1.5">
          <h3 className="mc-eyebrow m-0">Your cloud sessions</h3>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className="mc-btn mc-btn-ghost mc-btn-sm"
              onClick={() => onOpenWeb(CLAUDE_CODE_WEB)}
            >
              <CloudIcon size={13} /> All sessions
            </button>
            <button
              type="button"
              className="mc-btn mc-btn-ghost mc-btn-sm"
              disabled={!claudeOk || !folder}
              title="Pick a cloud session and continue it here, on this computer"
              onClick={() => onRun(["--teleport"], "Bring a session here")}
            >
              Bring one here
            </button>
          </div>
          <input
            className="mc-input w-full"
            placeholder="Session link or ID"
            aria-label="Cloud session link or ID"
            aria-invalid={Boolean(session.trim()) && !typed}
            value={session}
            onChange={(e) => setSession(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && typed) onOpenWeb(sessionUrl(typed));
            }}
          />
          {typed ? (
            <SessionActions
              id={typed}
              claudeOk={claudeOk}
              canTeleport={Boolean(folder)}
              messaging={messaging === "typed"}
              onOpen={() => onOpenWeb(sessionUrl(typed))}
              onMessage={() => setMessaging((m) => (m === "typed" ? null : "typed"))}
              onTeleport={() => onTeleport(typed, null)}
              onSend={(text) => onSend(typed, text)}
            />
          ) : (
            session.trim() && (
              <p className="m-0 text-[0.6875rem] text-[var(--mc-warning)]">
                That isn&apos;t a session link (claude.ai/code/session_…) or ID.
              </p>
            )
          )}
        </section>

        <section className="flex flex-col gap-1.5">
          <h3 className="mc-eyebrow m-0">More</h3>
          <button
            type="button"
            className="mc-row flex-col items-start gap-0 py-1.5"
            disabled={!claudeOk || !folder}
            onClick={() =>
              onRun(["--remote-control", folder ? basename(folder) : "Moon Code"], "Remote Control")
            }
          >
            <span className="font-medium">Remote Control</span>
            <span className="whitespace-normal text-[0.6875rem] text-[var(--mc-text-faint)]">
              Start Claude here and steer it from your phone or claude.ai.
            </span>
          </button>
          <button
            type="button"
            className="mc-row flex-col items-start gap-0 py-1.5"
            disabled={!claudeOk || !repo}
            onClick={() => onRun(["ultrareview"], "Ultrareview")}
          >
            <span className="font-medium">Ultrareview</span>
            <span className="whitespace-normal text-[0.6875rem] text-[var(--mc-text-faint)]">
              A cloud review of this branch by several Claude agents.
            </span>
          </button>
        </section>

        {tasks.length > 0 && (
          <section className="flex flex-col gap-1">
            <h3 className="mc-eyebrow m-0 flex items-center gap-1.5">
              <HistoryIcon size={12} /> Started from Moon Code
            </h3>
            {tasks.slice(0, 12).map((t) => {
              const id = t.sessionId;
              const url = t.url ?? (id ? sessionUrl(id) : CLAUDE_CODE_WEB);
              return (
                <div key={`${t.at}-${t.task}`} className="flex flex-col gap-1">
                  <button
                    type="button"
                    className="mc-row flex-col items-start gap-0 py-1"
                    title={id ? "Open the session here" : "Open your sessions here"}
                    onClick={() => onOpenWeb(url)}
                  >
                    <span className="w-full truncate">{t.task}</span>
                    <span className="text-[0.6875rem] text-[var(--mc-text-faint)]">
                      {t.repo} · {timeAgo(t.at)}
                    </span>
                  </button>
                  {id && (
                    <div className="pl-2">
                      <SessionActions
                        id={id}
                        claudeOk={claudeOk}
                        canTeleport
                        messaging={messaging === t.at}
                        onOpen={() => onOpenWeb(url)}
                        onMessage={() => setMessaging((m) => (m === t.at ? null : t.at))}
                        onTeleport={() => onTeleport(id, t.repo)}
                        onSend={(text) => onSend(id, text)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}

/** What can be done with one cloud session: open it here, message it, continue it locally. */
function SessionActions({
  id,
  claudeOk,
  canTeleport,
  messaging,
  onOpen,
  onMessage,
  onTeleport,
  onSend,
}: {
  id: string;
  claudeOk: boolean;
  canTeleport: boolean;
  messaging: boolean;
  onOpen: () => void;
  onMessage: () => void;
  onTeleport: () => void;
  onSend: (text: string) => Promise<CloudSent>;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Session ${id}`}>
        <button type="button" className="mc-btn mc-btn-sm" onClick={onOpen}>
          <CloudIcon size={13} /> Open here
        </button>
        <button
          type="button"
          className="mc-btn mc-btn-ghost mc-btn-sm"
          aria-expanded={messaging}
          disabled={!claudeOk}
          onClick={onMessage}
        >
          <SendIcon size={12} /> Message
        </button>
        <button
          type="button"
          className="mc-btn mc-btn-ghost mc-btn-sm"
          disabled={!claudeOk || !canTeleport}
          title="Continue this session on this computer (claude --teleport)"
          onClick={onTeleport}
        >
          <DownloadIcon size={12} /> Bring here
        </button>
      </div>
      {messaging && <FollowUp onSend={onSend} />}
    </div>
  );
}

/** A message for a running cloud session; Claude picks it up there. */
function FollowUp({ onSend }: { onSend: (text: string) => Promise<CloudSent> }) {
  const [text, setText] = useState("");
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string }
  >({ kind: "idle" });
  const send = async () => {
    const t = text.trim();
    if (!t || state.kind === "sending") return;
    setState({ kind: "sending" });
    try {
      await onSend(t);
      setText("");
      setState({ kind: "sent" });
    } catch (e) {
      setState({ kind: "error", message: (e as Error).message });
    }
  };
  return (
    <div className="mc-composer px-2.5 pb-1.5 pt-2">
      <textarea
        rows={2}
        placeholder="Tell Claude in the cloud…"
        aria-label="Message for the cloud session"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void send();
          }
        }}
      />
      <div className="mt-1 flex items-center gap-2">
        <span
          className="min-w-0 flex-1 text-[0.6875rem]"
          aria-live="polite"
          style={{
            color:
              state.kind === "error"
                ? "var(--mc-danger)"
                : state.kind === "sent"
                  ? "var(--mc-success)"
                  : "var(--mc-text-faint)",
          }}
        >
          {state.kind === "sending"
            ? "Sending…"
            : state.kind === "sent"
              ? "Sent – Claude picks it up in the session."
              : state.kind === "error"
                ? state.message
                : "Ctrl+Enter sends it"}
        </span>
        <button
          type="button"
          className="mc-btn mc-btn-primary mc-btn-sm"
          disabled={!text.trim() || state.kind === "sending"}
          aria-label="Send to the cloud session"
          onClick={() => void send()}
        >
          <SendIcon size={12} /> Send
        </button>
      </div>
    </div>
  );
}

function Requirement({
  ok,
  label,
  children,
}: {
  ok: boolean;
  label: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-[0.75rem]">
      <span style={{ color: ok ? "var(--mc-success)" : "var(--mc-warning)" }}>
        {ok ? <CheckIcon size={13} /> : <AlertIcon size={13} />}
      </span>
      <span
        className="min-w-0 flex-1 truncate"
        style={{ color: ok ? "var(--mc-text)" : "var(--mc-text-muted)" }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}
