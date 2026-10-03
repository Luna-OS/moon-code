import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import {
  AlertIcon,
  CheckIcon,
  ClaudeIcon,
  CloseIcon,
  LogoutIcon,
  PlusIcon,
  ReloadIcon,
  SendIcon,
  StopIcon,
  ToolIcon,
} from "../theme/icons";
import { MoonPhase } from "../theme/MoonPhase";
import {
  allowRule,
  chatReducer,
  EFFORTS,
  emptyChat,
  MODELS,
  modelLabel,
  PERMISSION_MODES,
  planLabel,
  splitBlocks,
  toolSummary,
  type ChatItem,
} from "../lib/claude";
import { dollars, percent, timeAgo, timeUntil, tokens } from "../lib/format";
import { basename, relative } from "../lib/paths";
import type {
  ClaudeAccount,
  Effort,
  MoonCodeBridge,
  PermissionMode,
  RateLimit,
  RateWindow,
  Settings,
} from "../lib/types";

export interface ClaudeInfo {
  model: string | null;
  contextTokens: number | null;
  contextWindow: number | null;
  busy: boolean;
}

export interface ResumeRequest {
  sessionId: string;
  title: string | null;
  /** Changes on every request, so the same session can be resumed twice. */
  nonce: number;
}

const newChatId = () => `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * Claude in Moon Code: your Claude Code, signed in with your Claude account, working in the open
 * folder. Shows who is signed in, the model, how full the conversation is and how much of the
 * plan's 5-hour and weekly limits is used.
 */
export function ClaudePanel({
  bridge,
  account,
  folder,
  activeFile,
  settings,
  limits,
  resume,
  prefill,
  onSettings,
  onLimits,
  onInfo,
  onSignIn,
  onInstall,
  onRefreshAccount,
  onClose,
  onOpenFile,
}: {
  bridge: MoonCodeBridge;
  account: ClaudeAccount | null;
  folder: string | null;
  activeFile: string | null;
  settings: Settings;
  limits: RateLimit | null;
  resume: ResumeRequest | null;
  /** Text to put into the message box (from "Ask Claude about this" in the editor). */
  prefill: { text: string; nonce: number } | null;
  onSettings: (patch: Partial<Settings>) => void;
  onLimits: (limits: RateLimit) => void;
  onInfo: (info: ClaudeInfo) => void;
  onSignIn: () => void;
  onInstall: () => void;
  onRefreshAccount: () => void;
  onClose: () => void;
  onOpenFile: (path: string) => void;
}) {
  const [chat, dispatch] = useReducer(chatReducer, undefined, emptyChat);
  const [chatId, setChatId] = useState(newChatId);
  const [draft, setDraft] = useState("");
  const [allowed, setAllowed] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);
  /** The options the running process was started with; null when none runs. */
  const running = useRef<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  const model = settings.claudeModel;
  const mode = settings.claudePermissionMode;
  const effort = settings.claudeEffort;

  // Claude Code's events for this chat.
  useEffect(
    () =>
      bridge.on("claude:event", ({ chatId: id, event }) => {
        if (id !== chatId) return;
        if (event.kind === "rate-limit") {
          const { kind: _kind, ...rl } = event;
          onLimits({ ...rl, at: Date.now() });
        }
        if (event.kind === "exit") running.current = null;
        dispatch({ type: "event", event });
      }),
    [bridge, chatId, onLimits],
  );

  useEffect(() => {
    onInfo({
      model: chat.model ?? model,
      contextTokens: chat.contextTokens,
      contextWindow: chat.contextWindow,
      busy: chat.busy,
    });
  }, [chat.model, chat.contextTokens, chat.contextWindow, chat.busy, model, onInfo]);

  // "Ask Claude about this" in the editor adds to the message box.
  const [seenPrefill, setSeenPrefill] = useState(prefill);
  if (prefill !== seenPrefill) {
    setSeenPrefill(prefill);
    if (prefill) setDraft((d) => (d ? `${d}\n${prefill.text}` : prefill.text));
  }
  useEffect(() => {
    if (prefill) input.current?.focus();
  }, [prefill]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.items]);

  // A chat's process ends with the chat: a new conversation, another folder, closing the panel.
  useEffect(() => () => void bridge.claudeStop(chatId), [bridge, chatId]);

  const newChat = useCallback(() => {
    dispatch({ type: "reset" });
    setAllowed([]);
    setChatId(newChatId());
  }, []);

  // A conversation belongs to its folder: another folder starts a new one.
  const [chatFolder, setChatFolder] = useState(folder);
  if (folder !== chatFolder) {
    setChatFolder(folder);
    newChat();
  }

  /** What a process was started with; another value means it has to be started again. */
  const runKey = (id: string, tools: string[]) =>
    JSON.stringify([id, folder, model, mode, effort, tools]);

  // Continue a conversation picked in Projects: a new chat that resumes Claude Code's session.
  const [seenResume, setSeenResume] = useState(resume);
  const [resuming, setResuming] = useState<{ id: string; request: ResumeRequest } | null>(null);
  if (resume !== seenResume) {
    setSeenResume(resume);
    if (resume) {
      const id = `resume-${resume.nonce}`;
      dispatch({ type: "reset" });
      setAllowed([]);
      setChatId(id);
      setResuming({ id, request: resume });
    }
  }
  useEffect(() => {
    if (!resuming) return;
    const { id, request } = resuming;
    void bridge
      .claudeStart(id, {
        cwd: folder,
        model,
        permissionMode: mode,
        effort,
        resume: request.sessionId,
        allowedTools: [],
      })
      .then(() => {
        running.current = runKey(id, []);
        dispatch({
          type: "event",
          event: {
            kind: "init",
            model: null,
            sessionId: request.sessionId,
            cwd: folder,
            permissionMode: mode,
            version: null,
          },
        });
        dispatch({
          type: "notice",
          tone: "info",
          text: `Continuing "${request.title ?? "the conversation"}". Claude remembers everything said in it.`,
        });
      })
      .catch((e: Error) => dispatch({ type: "notice", tone: "error", text: e.message }));
    // Only a new request should resume; the other values are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resuming]);

  /** Starts Claude Code for this chat when it isn't running with the current choices. */
  const ensureRunning = async (tools: string[]) => {
    const key = runKey(chatId, tools);
    if (running.current === key && !chat.ended) return;
    await bridge.claudeStart(chatId, {
      cwd: folder,
      model,
      permissionMode: mode,
      effort,
      resume: chat.sessionId,
      allowedTools: tools,
    });
    running.current = key;
  };

  const send = async (text: string, tools = allowed) => {
    const t = text.trim();
    if (!t || chat.busy) return;
    dispatch({ type: "user", text: t });
    setDraft("");
    try {
      await ensureRunning(tools);
      const ok = await bridge.claudeSend(chatId, t);
      if (!ok) throw new Error("Claude Code isn't running. Try again.");
    } catch (e) {
      running.current = null;
      dispatch({ type: "event", event: { kind: "error", message: (e as Error).message } });
    }
  };

  const stop = () => {
    void bridge.claudeStop(chatId);
    running.current = null;
    dispatch({ type: "stopped" });
  };

  const allow = (denials: { tool: string; input: Record<string, unknown> }[]) => {
    const tools = [...new Set([...allowed, ...denials.map(allowRule)])];
    setAllowed(tools);
    void send("You may do that now – please go ahead.", tools);
  };

  const checkLimits = async () => {
    setChecking(true);
    try {
      const rl = await bridge.claudeCheckLimits();
      if (rl) onLimits({ ...rl, at: Date.now() });
    } finally {
      setChecking(false);
    }
  };

  const mentionActive = () => {
    if (!activeFile) return;
    const rel = folder ? relative(folder, activeFile) : activeFile;
    setDraft((d) => `${d}${d && !d.endsWith(" ") ? " " : ""}@${rel} `);
    input.current?.focus();
  };

  // ---------------------------------------------------------------- render

  let body: ReactNode;
  if (!account) {
    body = <Centered>Looking for Claude Code…</Centered>;
  } else if (!account.installed) {
    body = (
      <Centered>
        <ClaudeIcon size={34} />
        <p className="m-0 font-semibold text-[var(--mc-text)]">
          Claude Code isn&apos;t installed yet
        </p>
        <p className="m-0">Moon Code uses your own Claude Code. Install it once, then sign in.</p>
        <button type="button" className="mc-btn mc-btn-primary" onClick={onInstall}>
          Install Claude Code
        </button>
        <button type="button" className="mc-btn mc-btn-ghost" onClick={onRefreshAccount}>
          <ReloadIcon size={14} /> I installed it
        </button>
      </Centered>
    );
  } else if (!account.loggedIn) {
    body = (
      <Centered>
        <ClaudeIcon size={34} />
        <p className="m-0 font-semibold text-[var(--mc-text)]">Sign in with Claude</p>
        <p className="m-0">
          Use your Claude subscription. Your projects, your limits and the models of your plan show
          up right away.
        </p>
        <button type="button" className="mc-btn mc-btn-primary" onClick={onSignIn}>
          Sign in with Claude
        </button>
      </Centered>
    );
  } else {
    body = (
      <>
        <AccountCard
          account={account}
          limits={limits}
          checking={checking}
          onCheck={() => void checkLimits()}
          onLogout={() =>
            void bridge.claudeLogout().then(() => {
              newChat();
              onRefreshAccount();
            })
          }
        />
        <div
          ref={scroller}
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3"
          aria-live="polite"
        >
          {chat.items.length === 0 && (
            <div className="m-auto flex max-w-[300px] flex-col items-center gap-2 text-center text-[0.8125rem] text-[var(--mc-text-muted)]">
              <img src="./moon-code-logo.svg" alt="" width={44} height={44} />
              <p className="m-0 font-semibold text-[var(--mc-text)]">
                What are we building tonight?
              </p>
              <p className="m-0">
                Claude works in {folder ? <b>{basename(folder)}</b> : "your home folder"}: it reads
                the code, edits files and runs commands.
              </p>
            </div>
          )}
          {chat.items.map((item) => (
            <ChatRow
              key={item.id}
              item={item}
              folder={folder}
              onAllow={allow}
              onOpenFile={onOpenFile}
            />
          ))}
          {chat.busy && (
            <div className="flex items-center gap-2 text-[0.75rem] text-[var(--mc-text-muted)]">
              <span className="mc-working" /> Claude is working…
            </div>
          )}
        </div>
        <div className="shrink-0 px-3 pb-3">
          <div className="mc-composer px-3 pb-2 pt-2.5">
            <textarea
              ref={input}
              rows={Math.min(8, Math.max(2, draft.split("\n").length))}
              placeholder={folder ? `Ask Claude about ${basename(folder)}…` : "Ask Claude…"}
              aria-label="Message to Claude"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(draft);
                }
              }}
            />
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Select
                label="Model"
                value={model ?? ""}
                options={MODELS.map((m) => ({ value: m.id ?? "", label: m.label, title: m.hint }))}
                onChange={(v) => onSettings({ claudeModel: v || null })}
              />
              <Select
                label="Permissions"
                value={mode}
                options={PERMISSION_MODES.map((m) => ({
                  value: m.id,
                  label: m.label,
                  title: m.hint,
                }))}
                onChange={(v) => onSettings({ claudePermissionMode: v as PermissionMode })}
              />
              <Select
                label="Effort"
                value={effort ?? ""}
                options={EFFORTS.map((m) => ({
                  value: m.id ?? "",
                  label: m.id ? `Effort: ${m.label}` : "Effort",
                }))}
                onChange={(v) => onSettings({ claudeEffort: (v || null) as Effort | null })}
              />
              {activeFile && (
                <button
                  type="button"
                  className="mc-btn mc-btn-sm"
                  onClick={mentionActive}
                  title="Mention the open file"
                >
                  @{basename(activeFile)}
                </button>
              )}
              <span className="flex-1" />
              {chat.busy ? (
                <button
                  type="button"
                  className="mc-btn mc-btn-ghost mc-btn-sm mc-btn-icon"
                  aria-label="Stop"
                  title="Stop"
                  onClick={stop}
                >
                  <StopIcon size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  className="mc-btn mc-btn-primary mc-btn-sm mc-btn-icon"
                  aria-label="Send"
                  title="Send (Enter)"
                  disabled={!draft.trim()}
                  onClick={() => void send(draft)}
                >
                  <SendIcon size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="mt-1.5 flex items-center gap-2 px-1 text-[0.6875rem] text-[var(--mc-text-faint)]">
            <span>{modelLabel(chat.model ?? model)}</span>
            {chat.contextTokens !== null && (
              <span title="How much of the conversation's context is used">
                · Context {tokens(chat.contextTokens)}
                {chat.contextWindow ? ` / ${tokens(chat.contextWindow)}` : ""}
              </span>
            )}
            {chat.costUsd > 0 &&
              account.authMethod !== "oauth_token" &&
              account.authMethod !== "claude.ai" && <span>· {dollars(chat.costUsd)}</span>}
          </div>
        </div>
      </>
    );
  }

  return (
    <aside className="mc-sidebar flex h-full min-h-0 flex-col" aria-label="Claude">
      <div className="mc-section-title shrink-0" style={{ height: "2.4rem" }}>
        <span style={{ color: "var(--mc-claude)" }}>
          <ClaudeIcon size={15} />
        </span>
        <span className="flex-1">Claude</span>
        {account?.loggedIn && (
          <button
            type="button"
            className="mc-icon-btn"
            style={{ width: 26, height: 26 }}
            aria-label="New conversation"
            title="New conversation"
            onClick={newChat}
          >
            <PlusIcon size={15} />
          </button>
        )}
        <button
          type="button"
          className="mc-icon-btn"
          style={{ width: 26, height: 26 }}
          aria-label="Close Claude"
          title="Close"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>
      {body}
    </aside>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-[0.8125rem] text-[var(--mc-text-muted)]">
      {children}
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; title?: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      className="mc-input"
      style={{ height: "1.6rem", padding: "0 0.4rem", fontSize: "0.75rem", maxWidth: 140 }}
      aria-label={label}
      title={options.find((o) => o.value === value)?.title ?? label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} title={o.title}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Who is signed in and how much of the plan is used, as two moons. */
function AccountCard({
  account,
  limits,
  checking,
  onCheck,
  onLogout,
}: {
  account: ClaudeAccount;
  limits: RateLimit | null;
  checking: boolean;
  onCheck: () => void;
  onLogout: () => void;
}) {
  const plan = planLabel(account.plan);
  return (
    <section className="mc-glass mx-3 mb-1 shrink-0 p-3" aria-label="Claude account and limits">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[0.8125rem] font-semibold">
            {account.email ?? "Signed in"}
          </div>
          <div className="truncate text-[0.6875rem] text-[var(--mc-text-muted)]">
            Claude Code {account.version ?? ""}
            {account.organization ? ` · ${account.organization}` : ""}
          </div>
        </div>
        {plan && <span className="mc-chip mc-chip-mint">{plan}</span>}
        <button
          type="button"
          className="mc-icon-btn"
          style={{ width: 26, height: 26 }}
          aria-label="Sign out of Claude"
          title="Sign out"
          onClick={onLogout}
        >
          <LogoutIcon size={14} />
        </button>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <Limit label="5-hour limit" window={limits?.fiveHour ?? null} />
        <Limit label="Weekly limit" window={limits?.sevenDay ?? null} />
      </div>
      <div className="mt-2 flex items-center gap-2 text-[0.6875rem] text-[var(--mc-text-faint)]">
        <span className="flex-1">
          {limits?.at ? `Updated ${timeAgo(limits.at)}` : "Limits show after the first message."}
          {limits?.usingOverage ? " · using extra usage" : ""}
        </span>
        <button
          type="button"
          className="mc-btn mc-btn-sm"
          onClick={onCheck}
          disabled={checking}
          title="Asks Claude Code with a tiny request"
        >
          <ReloadIcon size={12} /> {checking ? "Checking…" : "Check now"}
        </button>
      </div>
    </section>
  );
}

function Limit({ label, window: w }: { label: string; window: RateWindow | null }) {
  const f = w?.utilization ?? 0;
  const tone = f >= 0.9 ? "var(--mc-danger)" : f >= 0.75 ? "var(--mc-warning)" : "var(--mc-text)";
  return (
    <div className="mc-inset flex items-center gap-2 p-2">
      <MoonPhase fraction={f} size={30} />
      <div className="min-w-0">
        <div className="text-[0.6875rem] text-[var(--mc-text-muted)]">{label}</div>
        <div className="text-[0.875rem] font-semibold" style={{ color: tone }}>
          {w ? percent(f) : "–"}
        </div>
        {w?.resetsAt && (
          <div className="truncate text-[0.625rem] text-[var(--mc-text-faint)]">
            resets {timeUntil(w.resetsAt)}
          </div>
        )}
      </div>
    </div>
  );
}

/** Inline `code` inside a paragraph. */
function InlineText({ text }: { text: string }) {
  const parts = text.split(/(`[^`\n]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("`") && p.endsWith("`") && p.length > 2 ? (
          <code key={i} className="mc-inline-code">
            {p.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{p.replace(/\*\*(.+?)\*\*/g, "$1")}</span>
        ),
      )}
    </>
  );
}

function ChatRow({
  item,
  folder,
  onAllow,
  onOpenFile,
}: {
  item: ChatItem;
  folder: string | null;
  onAllow: (denials: { tool: string; input: Record<string, unknown> }[]) => void;
  onOpenFile: (path: string) => void;
}) {
  switch (item.type) {
    case "user":
      return <div className="mc-msg-user text-[0.8125rem]">{item.text}</div>;
    case "assistant":
      return (
        <div className="mc-msg-assistant text-[0.8125rem]">
          {splitBlocks(item.text).map((b, i) =>
            b.kind === "code" ? (
              <pre key={i} className="mc-code">
                {b.text}
              </pre>
            ) : (
              <p key={i}>
                <InlineText text={b.text} />
              </p>
            ),
          )}
        </div>
      );
    case "tool": {
      const summary = toolSummary(item.name, item.input);
      const file = typeof item.input.file_path === "string" ? item.input.file_path : null;
      return (
        <details className="mc-tool">
          <summary>
            <span style={{ color: item.result?.isError ? "var(--mc-danger)" : "var(--mc-claude)" }}>
              {item.result ? (
                item.result.isError ? (
                  <AlertIcon size={13} />
                ) : (
                  <CheckIcon size={13} />
                )
              ) : (
                <ToolIcon />
              )}
            </span>
            <span className="font-semibold">{item.name}</span>
            <span className="min-w-0 flex-1 truncate text-[var(--mc-text-muted)]">{summary}</span>
            {file && (
              <button
                type="button"
                className="mc-btn mc-btn-sm"
                style={{ height: "1.3rem" }}
                onClick={(e) => {
                  e.preventDefault();
                  onOpenFile(file);
                }}
                title={folder ? relative(folder, file) : file}
              >
                Open
              </button>
            )}
          </summary>
          <pre>{JSON.stringify(item.input, null, 2)}</pre>
          {item.result && <pre>{item.result.text.slice(0, 6000) || "(no output)"}</pre>}
        </details>
      );
    }
    case "notice":
      return (
        <div
          className="mc-inset p-2.5 text-[0.75rem]"
          style={{
            borderColor:
              item.tone === "error"
                ? "color-mix(in srgb, var(--color-error-500) 45%, transparent)"
                : item.tone === "warning"
                  ? "color-mix(in srgb, var(--color-warning-400) 45%, transparent)"
                  : undefined,
            color: item.tone === "error" ? "var(--mc-danger)" : "var(--mc-text-muted)",
          }}
        >
          <div className="whitespace-pre-wrap">{item.text}</div>
          {item.denials && (
            <>
              <ul className="my-1.5 pl-4">
                {item.denials.map((d, i) => (
                  <li key={i}>
                    <b>{d.tool}</b> {toolSummary(d.tool, d.input)}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="mc-btn mc-btn-primary mc-btn-sm"
                onClick={() => onAllow(item.denials ?? [])}
              >
                Allow and continue
              </button>
            </>
          )}
        </div>
      );
  }
}
