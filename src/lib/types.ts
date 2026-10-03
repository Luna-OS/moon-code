/** The shapes the UI and the main process (electron/preload.cjs) share. */

export interface CodedError extends Error {
  code?: string;
}

export interface SysInfo {
  platform: string;
  version: string;
  home: string;
  sep: string;
}

export type ThemeSetting = "dark" | "light" | "system";
export type PermissionMode = "default" | "acceptEdits" | "plan" | "bypassPermissions";
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface RateWindow {
  /** 0..1 of the window's limit used. */
  utilization: number;
  /** When the window starts over (ms since the epoch), if known. */
  resetsAt: number | null;
}

export interface RateLimit {
  status: string | null;
  type: string | null;
  fiveHour: RateWindow | null;
  sevenDay: RateWindow | null;
  usingOverage: boolean;
  /** When Moon Code learned it (ms). */
  at?: number;
}

export interface Settings {
  theme: ThemeSetting;
  lastFolder: string | null;
  recent: string[];
  projectsFolder: string;
  githubOwner: string;
  claudePath: string | null;
  claudeModel: string | null;
  claudePermissionMode: PermissionMode;
  claudeEffort: Effort | null;
  lastRateLimit: RateLimit | null;
  fontSize: number;
  wordWrap: boolean;
  minimap: boolean;
}

export interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
}

export interface SearchOptions {
  query: string;
  regex?: boolean;
  caseSensitive?: boolean;
  wholeWord?: boolean;
}

export interface SearchMatch {
  line: number;
  column: number;
  length: number;
  text: string;
}

export interface SearchHit {
  /** Relative to the folder, with "/". */
  file: string;
  matches: SearchMatch[];
}

export interface ClaudeAccount {
  installed: boolean;
  exe: string | null;
  version: string | null;
  loggedIn: boolean;
  authMethod: string | null;
  email: string | null;
  organization: string | null;
  plan: string | null;
}

export interface ClaudeProject {
  path: string;
  name: string;
  lastUsed: number;
  sessionCount: number;
  branch: string | null;
  exists: boolean;
}

export interface ClaudeSession {
  id: string;
  updated: number;
  title: string | null;
  branch: string | null;
}

export interface Repo {
  name: string;
  fullName: string;
  description: string;
  url: string;
  cloneUrl: string;
  updated: number;
  private: boolean;
  language: string | null;
}

export interface ChatStartOptions {
  cwd: string | null;
  model?: string | null;
  permissionMode?: PermissionMode;
  effort?: Effort | null;
  resume?: string | null;
  allowedTools?: string[];
}

/** What electron/claude/events.cjs makes of Claude Code's output. */
export type ClaudeEvent =
  | {
      kind: "init";
      model: string | null;
      sessionId: string | null;
      cwd: string | null;
      permissionMode: string | null;
      version: string | null;
    }
  | { kind: "status"; status: string }
  | { kind: "text-delta"; messageId: string | null; text: string }
  | { kind: "text"; messageId: string | null; text: string }
  | { kind: "tool-use"; id: string; name: string; input: Record<string, unknown> }
  | { kind: "tool-result"; toolUseId: string; isError: boolean; text: string }
  | { kind: "context"; tokens: number }
  | { kind: "context-window"; tokens: number }
  | ({ kind: "rate-limit" } & RateLimit)
  | {
      kind: "result";
      ok: boolean;
      subtype: string | null;
      text: string;
      costUsd: number | null;
      durationMs: number | null;
      turns: number | null;
      denials: { tool: string; input: Record<string, unknown> }[];
    }
  | { kind: "stderr"; text: string }
  | { kind: "error"; message: string }
  | { kind: "exit"; code: number | null; stderr: string };

export interface BridgeEvents {
  "terminal:data": { id: string; data: string };
  "terminal:exit": { id: string; code: number };
  "claude:event": { chatId: string; event: ClaudeEvent };
}

export interface MoonCodeBridge {
  kind: "electron" | "demo";
  info(): Promise<SysInfo>;
  getSettings(): Promise<Settings>;
  setSettings(patch: Partial<Settings>): Promise<Settings>;
  setTheme(theme: "dark" | "light"): Promise<void>;
  setTitle(title: string): Promise<void>;
  devtools(): Promise<void>;
  openExternal(url: string): Promise<void>;
  showInFolder(path: string): Promise<void>;

  pickFolder(): Promise<string | null>;
  folderOpened(folder: string): Promise<Settings>;
  readDir(dir: string): Promise<DirEntry[]>;
  readFile(file: string): Promise<string>;
  writeFile(file: string, content: string): Promise<void>;
  createFile(file: string): Promise<void>;
  createFolder(dir: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  trash(path: string): Promise<void>;
  listFiles(root: string): Promise<string[]>;
  search(root: string, opts: SearchOptions): Promise<SearchHit[]>;
  gitBranch(root: string): Promise<string | null>;

  terminalStart(
    id: string,
    opts: { cwd: string | null; cols: number; rows: number; command?: string[] | string },
  ): Promise<void>;
  terminalWrite(id: string, data: string): Promise<void>;
  terminalResize(id: string, cols: number, rows: number): Promise<void>;
  terminalKill(id: string): Promise<void>;

  claudeStatus(): Promise<ClaudeAccount>;
  claudeProjects(): Promise<ClaudeProject[]>;
  claudeSessions(projectPath: string): Promise<ClaudeSession[]>;
  claudeLogout(): Promise<void>;
  claudeStart(chatId: string, opts: ChatStartOptions): Promise<{ sessionId: string | null }>;
  claudeSend(chatId: string, text: string): Promise<boolean>;
  claudeStop(chatId: string): Promise<void>;
  claudeCheckLimits(): Promise<RateLimit | null>;

  githubRepos(): Promise<{ source: "gh" | "api" | "none"; repos: Repo[] }>;
  githubClone(cloneUrl: string, name: string): Promise<string>;

  on<K extends keyof BridgeEvents>(channel: K, fn: (data: BridgeEvents[K]) => void): () => void;
}
