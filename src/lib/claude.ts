import type { ClaudeEvent, Effort, PermissionMode } from "./types";

/** The models the Claude panel offers; `null` lets Claude Code pick its default for the plan. */
export const MODELS: { id: string | null; label: string; hint: string }[] = [
  { id: null, label: "Default", hint: "What Claude Code uses for your plan" },
  { id: "claude-opus-5-5", label: "Opus 5.5", hint: "The strongest everyday model" },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5", hint: "Fast and capable" },
  { id: "claude-haiku-4-5", label: "Haiku 4.5", hint: "The quickest, uses the least" },
  { id: "claude-fable-5-1", label: "Fable 5.1", hint: "The most capable, uses the most" },
];

export const PERMISSION_MODES: { id: PermissionMode; label: string; hint: string }[] = [
  { id: "default", label: "Ask", hint: "Edits and commands need your OK" },
  { id: "acceptEdits", label: "Edit files", hint: "Edits run, commands need your OK" },
  { id: "plan", label: "Plan only", hint: "Claude reads and plans, changes nothing" },
  {
    id: "bypassPermissions",
    label: "Do everything",
    hint: "No questions – only for folders you trust",
  },
];

export const EFFORTS: { id: Effort | null; label: string }[] = [
  { id: null, label: "Default" },
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "xhigh", label: "Extra high" },
  { id: "max", label: "Max" },
];

/** "claude-haiku-4-5-20251001" → "Haiku 4.5", "claude-opus-5-5" → "Opus 5.5". */
export function modelLabel(id: string | null | undefined): string {
  if (!id) return "Default";
  const m = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?(\[1m\])?$/.exec(id);
  if (!m) return id;
  const name = m[1].charAt(0).toUpperCase() + m[1].slice(1);
  return `${name} ${m[2]}${m[3] ? `.${m[3]}` : ""}${m[4] ? " (1M)" : ""}`;
}

/** "max" → "Max", "pro" → "Pro". */
export function planLabel(plan: string | null): string | null {
  if (!plan) return null;
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

// ---------------------------------------------------------------- the conversation

export type ChatItem =
  | { type: "user"; id: string; text: string }
  | { type: "assistant"; id: string; text: string; done: boolean }
  | {
      type: "tool";
      id: string;
      name: string;
      input: Record<string, unknown>;
      result: { text: string; isError: boolean } | null;
    }
  | {
      type: "notice";
      id: string;
      tone: "info" | "warning" | "error";
      text: string;
      /** Tools Claude Code didn't run because they needed an OK. */
      denials?: { tool: string; input: Record<string, unknown> }[];
    };

export interface ChatState {
  items: ChatItem[];
  busy: boolean;
  /** The model that really answered (from Claude Code's init line). */
  model: string | null;
  sessionId: string | null;
  contextTokens: number | null;
  contextWindow: number | null;
  costUsd: number;
  /** Counts the turns Claude finished without an error (Axo cheers on each). */
  finished: number;
  /** Set when the process ended on its own; the next message restarts it. */
  ended: boolean;
}

export const emptyChat = (): ChatState => ({
  items: [],
  busy: false,
  model: null,
  sessionId: null,
  contextTokens: null,
  contextWindow: null,
  costUsd: 0,
  finished: 0,
  ended: false,
});

let seq = 0;
const nextId = (p: string) => `${p}-${++seq}`;

export type ChatAction =
  | { type: "user"; text: string }
  | { type: "event"; event: ClaudeEvent }
  | { type: "notice"; tone: "info" | "warning" | "error"; text: string }
  | { type: "stopped" }
  | { type: "reset" };

function upsertAssistant(
  items: ChatItem[],
  id: string,
  fn: (text: string, done: boolean) => [string, boolean],
) {
  const i = items.findIndex((it) => it.type === "assistant" && it.id === id);
  if (i < 0) {
    const [text, done] = fn("", false);
    return [...items, { type: "assistant" as const, id, text, done }];
  }
  const it = items[i] as Extract<ChatItem, { type: "assistant" }>;
  const [text, done] = fn(it.text, it.done);
  const copy = items.slice();
  copy[i] = { ...it, text, done };
  return copy;
}

/** The conversation after one thing happened. */
export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "reset":
      return emptyChat();
    case "user":
      return {
        ...state,
        busy: true,
        ended: false,
        items: [...state.items, { type: "user", id: nextId("u"), text: action.text }],
      };
    case "notice":
      return {
        ...state,
        items: [
          ...state.items,
          { type: "notice", id: nextId("n"), tone: action.tone, text: action.text },
        ],
      };
    case "stopped":
      return {
        ...state,
        busy: false,
        items: [
          ...state.items.map((it) =>
            it.type === "assistant" && !it.done ? { ...it, done: true } : it,
          ),
          { type: "notice", id: nextId("n"), tone: "info", text: "Stopped." },
        ],
      };
    case "event":
      return applyEvent(state, action.event);
  }
}

function applyEvent(state: ChatState, ev: ClaudeEvent): ChatState {
  switch (ev.kind) {
    case "init":
      return { ...state, model: ev.model, sessionId: ev.sessionId ?? state.sessionId };
    case "context":
      return { ...state, contextTokens: ev.tokens };
    case "context-window":
      return { ...state, contextWindow: ev.tokens };
    case "text-delta": {
      const id = ev.messageId ?? "stream";
      return {
        ...state,
        items: upsertAssistant(state.items, id, (text, done) =>
          done ? [text, done] : [text + ev.text, false],
        ),
      };
    }
    case "text": {
      const id = ev.messageId ?? nextId("a");
      // The whole block replaces what streamed; a second text block of the same message follows it.
      return {
        ...state,
        items: upsertAssistant(state.items, id, (text, done) => [
          done ? `${text}\n\n${ev.text}` : ev.text,
          true,
        ]),
      };
    }
    case "tool-use":
      return {
        ...state,
        items: [
          ...state.items,
          { type: "tool", id: ev.id, name: ev.name, input: ev.input, result: null },
        ],
      };
    case "tool-result":
      return {
        ...state,
        items: state.items.map((it) =>
          it.type === "tool" && it.id === ev.toolUseId
            ? { ...it, result: { text: ev.text, isError: ev.isError } }
            : it,
        ),
      };
    case "result": {
      const items = state.items.map((it) =>
        it.type === "assistant" && !it.done ? { ...it, done: true } : it,
      );
      if (ev.denials.length) {
        items.push({
          type: "notice",
          id: nextId("n"),
          tone: "warning",
          text: "Claude wanted to do something that needs your OK:",
          denials: ev.denials,
        });
      }
      if (!ev.ok && ev.subtype !== "success") {
        items.push({
          type: "notice",
          id: nextId("n"),
          tone: "error",
          text: ev.text || "Claude Code stopped with an error.",
        });
      }
      return {
        ...state,
        busy: false,
        items,
        costUsd: state.costUsd + (ev.costUsd ?? 0),
        finished: ev.ok && !ev.denials.length ? state.finished + 1 : state.finished,
      };
    }
    case "error":
      return {
        ...state,
        busy: false,
        items: [
          ...state.items,
          { type: "notice", id: nextId("n"), tone: "error", text: ev.message },
        ],
      };
    case "exit": {
      const wasBusy = state.busy;
      const items = state.items.slice();
      if (ev.code && ev.code !== 0) {
        items.push({
          type: "notice",
          id: nextId("n"),
          tone: "error",
          text: ev.stderr || `Claude Code ended unexpectedly (code ${ev.code}).`,
        });
      } else if (wasBusy) {
        items.push({ type: "notice", id: nextId("n"), tone: "info", text: "Claude Code ended." });
      }
      return { ...state, busy: false, ended: true, items };
    }
    default:
      return state;
  }
}

/** The permission rule that allows one denied call again ("Bash(npm test)", "Edit"). */
export function allowRule(denial: { tool: string; input: Record<string, unknown> }): string {
  if (denial.tool === "Bash" && typeof denial.input.command === "string") {
    return `Bash(${denial.input.command})`;
  }
  return denial.tool;
}

const VERBS: Record<string, string> = {
  Read: "Reading",
  Write: "Writing",
  Edit: "Editing",
  MultiEdit: "Editing",
  NotebookEdit: "Editing",
  Bash: "Running",
  Glob: "Looking for",
  Grep: "Searching for",
  WebFetch: "Reading",
  WebSearch: "Searching the web for",
  Task: "Delegating",
  Agent: "Delegating",
  TodoWrite: "Planning",
};

/** What Claude is doing right now, in a few words ("Editing src/App.tsx"), or null. */
export function activityOf(state: ChatState): string | null {
  if (!state.busy) return null;
  const last = state.items[state.items.length - 1];
  if (last?.type === "tool" && !last.result) {
    const verb = VERBS[last.name] ?? `Using ${last.name}`;
    const what = last.name === "TodoWrite" ? "" : toolSummary(last.name, last.input);
    return `${verb}${what ? ` ${what}` : ""}…`;
  }
  if (last?.type === "assistant" && !last.done) return "Writing the answer…";
  return null;
}

/** A one-line summary of a tool call for its card. */
export function toolSummary(name: string, input: Record<string, unknown>): string {
  const s = (k: string) => (typeof input[k] === "string" ? input[k] : "");
  const short = (p: string) => p.split(/[\\/]/).slice(-2).join("/");
  switch (name) {
    case "Read":
    case "Write":
    case "Edit":
    case "MultiEdit":
    case "NotebookEdit":
      return short(s("file_path") || s("notebook_path"));
    case "Bash":
      return s("description") || s("command");
    case "Glob":
    case "Grep":
      return s("pattern");
    case "WebFetch":
      return s("url");
    case "WebSearch":
      return s("query");
    case "Task":
    case "Agent":
      return s("description");
    case "TodoWrite":
      return "Updated the to-do list";
    default:
      return "";
  }
}

/** Splits an answer into paragraphs and fenced code blocks for display (no HTML involved). */
export function splitBlocks(
  text: string,
): { kind: "text" | "code"; text: string; lang?: string }[] {
  const out: { kind: "text" | "code"; text: string; lang?: string }[] = [];
  const re = /```([\w+-]*)\n?([\s\S]*?)(```|$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    out.push({ kind: "code", lang: m[1] || undefined, text: m[2].replace(/\n$/, "") });
    last = re.lastIndex;
    if (m[0].length === 0) break;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out.flatMap((b) =>
    b.kind === "code"
      ? [b]
      : b.text
          .split(/\n{2,}/)
          .map((t) => t.trim())
          .filter(Boolean)
          .map((t) => ({ kind: "text" as const, text: t })),
  );
}
