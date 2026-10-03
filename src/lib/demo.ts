import type {
  BridgeEvents,
  ChatStartOptions,
  ClaudeAccount,
  ClaudeEvent,
  ClaudeProject,
  ClaudeSession,
  DirEntry,
  GitHubAccount,
  MoonCodeBridge,
  RateLimit,
  Repo,
  SearchHit,
  SearchOptions,
  Settings,
  SysInfo,
} from "./types";

/*
 * An in-memory stand-in for the main process: a small sample project, a signed-in Claude account
 * and a Claude that answers with a canned reply. It runs the UI in a browser (npm run dev), in the
 * tests and for screenshots.
 */

const ROOT = "/home/luna/Moon-Zip";
const HOUR = 3_600_000;
const now = () => Date.now();

const SAMPLE: Record<string, string> = {
  "README.md":
    "# Moon Zip\n\nYour archives, calmly under the moon.\n\n```sh\nnpm install\nnpm run app\n```\n",
  "package.json": `{\n  "name": "moon-zip",\n  "version": "0.2.0",\n  "type": "module",\n  "scripts": {\n    "dev": "vite",\n    "build": "tsc -b && vite build"\n  }\n}\n`,
  "src/main.tsx": `import { StrictMode } from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "./App";\nimport "./theme/tokens.css";\n\nconst rootEl = document.getElementById("root");\nif (!rootEl) {\n  throw new Error("Moon Zip: #root element not found");\n}\n\ncreateRoot(rootEl).render(\n  <StrictMode>\n    <App />\n  </StrictMode>,\n);\n`,
  "src/App.tsx": `import { useState } from "react";\nimport { MoonPhase } from "./theme/MoonPhase";\n\n/** The start page: drop an archive or pick one. */\nexport default function App() {\n  const [progress, setProgress] = useState(0.42);\n  const label = \`\${Math.round(progress * 100)} %\`;\n  return (\n    <main className="mz-glass p-6">\n      <MoonPhase fraction={progress} size={48} />\n      <h1 className="mz-title">Moon Zip</h1>\n      <button className="mz-btn mz-btn-primary" onClick={() => setProgress(1)}>\n        Extract ({label})\n      </button>\n    </main>\n  );\n}\n`,
  "src/lib/format.ts": `const UNITS = ["B", "KB", "MB", "GB", "TB"];\n\n/** 1536 → "1.5 KB" */\nexport function formatSize(bytes: number): string {\n  let i = 0;\n  let n = bytes;\n  while (n >= 1024 && i < UNITS.length - 1) {\n    n /= 1024;\n    i++;\n  }\n  return \`\${n.toFixed(i ? 1 : 0)} \${UNITS[i]}\`;\n}\n`,
  "src/theme/tokens.css": `@theme {\n  --color-night-950: #0b0920;\n  --color-night-900: #141030;\n  --color-lavender-400: #b9aefb;\n  --color-mint-400: #7fe3c6;\n}\n\n.mz-title {\n  background: linear-gradient(100deg, #f4f1ff, #b9aefb);\n  background-clip: text;\n  color: transparent;\n}\n`,
  "electron/main.cjs": `"use strict";\nconst { app, BrowserWindow } = require("electron");\n\napp.whenReady().then(() => {\n  const win = new BrowserWindow({ width: 1180, height: 760 });\n  win.loadFile("dist/index.html");\n});\n`,
};

const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  lastFolder: ROOT,
  recent: [ROOT, "/home/luna/Moon-Explorer", "/home/luna/MoonDisk"],
  projectsFolder: "/home/luna/Moon Code Projects",
  githubOwner: "Luna-OS",
  claudePath: null,
  claudeModel: null,
  claudePermissionMode: "acceptEdits",
  claudeEffort: null,
  lastRateLimit: {
    status: "allowed",
    type: "five_hour",
    fiveHour: { utilization: 0.48, resetsAt: now() + 2.4 * HOUR },
    sevenDay: { utilization: 0.66, resetsAt: now() + 4.1 * 24 * HOUR },
    usingOverage: false,
    at: now() - 6 * 60_000,
  },
  cloudTasks: [
    {
      task: "Add a progress bar to the extract dialog",
      repo: "Luna-OS/Moon-Zip",
      at: now() - 3 * HOUR,
    },
  ],
  mascot: true,
  fontSize: 14,
  wordWrap: false,
  minimap: true,
};

const PROJECTS: ClaudeProject[] = [
  ["Moon-Zip", 0.2, 14, "main"],
  ["Moon-Explorer", 5, 22, "main"],
  ["Moon-Windows-Theme", 7, 9, "main"],
  ["Moon-Browser", 18, 31, "main"],
  ["Moon-Terminal", 120, 6, "main"],
  ["MoonDisk", 210, 12, "main"],
].map(([name, hoursAgo, sessions, branch]) => ({
  path: `/home/luna/${name as string}`,
  name: name as string,
  lastUsed: now() - (hoursAgo as number) * HOUR,
  sessionCount: sessions as number,
  branch: branch as string,
  exists: true,
}));

const REPOS: Repo[] = [
  ["moon-code", "Moon Code – a code editor under the night sky.", 0.1, "TypeScript"],
  ["Moon-Zip", "Your archives, calmly under the moon.", 0.2, "TypeScript"],
  ["Moon-Windows-Theme", "The Moon look for Windows 11.", 0.3, "PowerShell"],
  ["Moon-Explorer", "A calm file manager for Windows.", 7, "TypeScript"],
  ["Moon-Browser", "A browser under the moon.", 11, "TypeScript"],
  ["Luna-OS", "Luna OS.", 220, null],
].map(([name, description, hoursAgo, language]) => ({
  name: name as string,
  fullName: `Luna-OS/${name as string}`,
  description: description as string,
  url: `https://github.com/Luna-OS/${name as string}`,
  cloneUrl: `https://github.com/Luna-OS/${name as string}.git`,
  updated: now() - (hoursAgo as number) * HOUR,
  private: false,
  language: language as string | null,
}));

const join = (dir: string, name: string) => (dir.endsWith("/") ? dir + name : `${dir}/${name}`);

type Listener = (data: never) => void;

export class DemoBridge implements MoonCodeBridge {
  kind = "demo" as const;
  private files = new Map<string, string>();
  private dirs = new Set<string>([ROOT]);
  private settings: Settings = { ...DEFAULT_SETTINGS };
  private listeners = new Map<string, Set<Listener>>();
  private loggedIn = true;
  private githubLoggedIn = true;
  private chats = new Map<string, { model: string | null; sessionId: string }>();

  constructor() {
    for (const [rel, content] of Object.entries(SAMPLE)) {
      const abs = join(ROOT, rel);
      this.files.set(abs, content);
      const parts = rel.split("/");
      for (let i = 1; i < parts.length; i++) this.dirs.add(join(ROOT, parts.slice(0, i).join("/")));
    }
  }

  private emit<K extends keyof BridgeEvents>(channel: K, data: BridgeEvents[K]) {
    for (const fn of this.listeners.get(channel) ?? []) (fn as (d: BridgeEvents[K]) => void)(data);
  }

  on<K extends keyof BridgeEvents>(channel: K, fn: (data: BridgeEvents[K]) => void) {
    const set = this.listeners.get(channel) ?? new Set<Listener>();
    set.add(fn);
    this.listeners.set(channel, set);
    return () => set.delete(fn);
  }

  info(): Promise<SysInfo> {
    return Promise.resolve({ platform: "demo", version: "0.1.0", home: "/home/luna", sep: "/" });
  }
  getSettings() {
    return Promise.resolve({ ...this.settings });
  }
  setSettings(patch: Partial<Settings>) {
    this.settings = { ...this.settings, ...patch };
    return this.getSettings();
  }
  setTheme() {
    return Promise.resolve();
  }
  setTitle(title: string) {
    document.title = title;
    return Promise.resolve();
  }
  devtools() {
    return Promise.resolve();
  }
  openExternal() {
    return Promise.resolve();
  }
  showInFolder() {
    return Promise.resolve();
  }

  pickFolder() {
    return Promise.resolve(ROOT);
  }
  folderOpened(folder: string) {
    const recent = [folder, ...this.settings.recent.filter((f) => f !== folder)].slice(0, 12);
    return this.setSettings({ recent, lastFolder: folder });
  }
  readDir(dir: string): Promise<DirEntry[]> {
    const prefix = dir.endsWith("/") ? dir : `${dir}/`;
    const names = new Map<string, boolean>();
    for (const d of this.dirs) {
      if (d.startsWith(prefix) && !d.slice(prefix.length).includes("/")) {
        names.set(d.slice(prefix.length), true);
      }
    }
    for (const f of this.files.keys()) {
      if (f.startsWith(prefix) && !f.slice(prefix.length).includes("/")) {
        names.set(f.slice(prefix.length), false);
      }
    }
    return Promise.resolve(
      [...names.entries()]
        .map(([name, isDir]) => ({ name, isDir, path: join(dir, name) }))
        .sort((a, b) => (a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name))),
    );
  }
  readFile(file: string) {
    const c = this.files.get(file);
    return c === undefined
      ? Promise.reject(new Error(`${file} doesn't exist.`))
      : Promise.resolve(c);
  }
  writeFile(file: string, content: string) {
    this.files.set(file, content);
    return Promise.resolve();
  }
  createFile(file: string) {
    if (this.files.has(file)) return Promise.reject(new Error("The file exists already."));
    this.files.set(file, "");
    return Promise.resolve();
  }
  createFolder(dir: string) {
    this.dirs.add(dir);
    return Promise.resolve();
  }
  rename(from: string, to: string) {
    const c = this.files.get(from);
    if (c !== undefined) {
      this.files.delete(from);
      this.files.set(to, c);
    }
    return Promise.resolve();
  }
  trash(p: string) {
    this.files.delete(p);
    this.dirs.delete(p);
    for (const f of [...this.files.keys()]) if (f.startsWith(`${p}/`)) this.files.delete(f);
    return Promise.resolve();
  }
  listFiles(root: string) {
    const prefix = `${root}/`;
    return Promise.resolve(
      [...this.files.keys()].filter((f) => f.startsWith(prefix)).map((f) => f.slice(prefix.length)),
    );
  }
  async search(root: string, opts: SearchOptions): Promise<SearchHit[]> {
    if (!opts.query) return [];
    const needle = opts.caseSensitive ? opts.query : opts.query.toLowerCase();
    const out: SearchHit[] = [];
    for (const rel of await this.listFiles(root)) {
      const lines = (this.files.get(join(root, rel)) ?? "").split("\n");
      const matches = lines.flatMap((text, i) => {
        const hay = opts.caseSensitive ? text : text.toLowerCase();
        const col = hay.indexOf(needle);
        return col < 0 ? [] : [{ line: i + 1, column: col + 1, length: needle.length, text }];
      });
      if (matches.length) out.push({ file: rel, matches });
    }
    return out;
  }
  gitBranch() {
    return Promise.resolve("main");
  }
  gitHubRepo(root: string) {
    return Promise.resolve(root === ROOT ? "Luna-OS/Moon-Zip" : null);
  }

  terminalStart(id: string, opts: { cwd: string | null; command?: string[] | string }) {
    const line = typeof opts.command === "string" ? opts.command : opts.command?.join(" ");
    setTimeout(() => {
      this.emit("terminal:data", {
        id,
        data: `\x1b[38;2;185;174;251mluna@moon\x1b[0m:\x1b[38;2;154;215;245m${opts.cwd ?? "~"}\x1b[0m$ ${line ?? ""}\r\n`,
      });
      if (line?.includes("gh auth login")) {
        this.emit("terminal:data", { id, data: "! First copy your one-time code: 4F2A-9C1B\r\n" });
        this.githubLoggedIn = true;
      }
      if (line?.includes("claude auth login")) {
        this.emit("terminal:data", { id, data: "Opening the browser to sign in…\r\n" });
        this.loggedIn = true;
      }
    }, 20);
    return Promise.resolve();
  }
  terminalWrite(id: string, data: string) {
    this.emit("terminal:data", { id, data: data === "\r" ? "\r\n$ " : data });
    return Promise.resolve();
  }
  terminalResize() {
    return Promise.resolve();
  }
  terminalKill() {
    return Promise.resolve();
  }

  claudeStatus(): Promise<ClaudeAccount> {
    return Promise.resolve({
      installed: true,
      exe: "/home/luna/.local/bin/claude",
      version: "2.1.288",
      loggedIn: this.loggedIn,
      authMethod: this.loggedIn ? "claude.ai" : null,
      email: this.loggedIn ? "luna@example.com" : null,
      organization: null,
      plan: this.loggedIn ? "max" : null,
    });
  }
  claudeProjects() {
    return Promise.resolve(this.loggedIn ? PROJECTS : []);
  }
  claudeSessions(): Promise<ClaudeSession[]> {
    return Promise.resolve([
      {
        id: "s-1",
        updated: now() - 0.2 * HOUR,
        title: "Add a night theme to the installer",
        branch: "main",
      },
      {
        id: "s-2",
        updated: now() - 26 * HOUR,
        title: "Fix the moon phase gauge at 100 %",
        branch: "main",
      },
    ]);
  }
  claudeLogout() {
    this.loggedIn = false;
    return Promise.resolve();
  }
  claudeStart(chatId: string, opts: ChatStartOptions) {
    const sessionId = opts.resume ?? `demo-${chatId}`;
    this.chats.set(chatId, { model: opts.model ?? null, sessionId });
    return Promise.resolve({ sessionId });
  }
  claudeSend(chatId: string, text: string) {
    const chat = this.chats.get(chatId);
    if (!chat) return Promise.resolve(false);
    const send = (event: ClaudeEvent, delay: number) =>
      setTimeout(() => this.emit("claude:event", { chatId, event }), delay);
    const reply = demoReply(text);
    send(
      {
        kind: "init",
        model: chat.model ?? "claude-opus-5-5",
        sessionId: chat.sessionId,
        cwd: ROOT,
        permissionMode: "acceptEdits",
        version: "2.1.288",
      },
      10,
    );
    send({ kind: "context-window", tokens: 200_000 }, 12);
    send({ kind: "context", tokens: 18_420 }, 15);
    send(
      { kind: "tool-use", id: "t1", name: "Read", input: { file_path: `${ROOT}/src/App.tsx` } },
      40,
    );
    send({ kind: "tool-result", toolUseId: "t1", isError: false, text: SAMPLE["src/App.tsx"] }, 60);
    const words = reply.split(/(?<= )/);
    words.forEach((w, i) => send({ kind: "text-delta", messageId: "m1", text: w }, 80 + i * 8));
    const end = 90 + words.length * 8;
    send({ kind: "text", messageId: "m1", text: reply }, end);
    const limit: RateLimit = {
      status: "allowed",
      type: "five_hour",
      fiveHour: { utilization: 0.49, resetsAt: now() + 2.4 * HOUR },
      sevenDay: { utilization: 0.66, resetsAt: now() + 4.1 * 24 * HOUR },
      usingOverage: false,
    };
    send({ kind: "rate-limit", ...limit }, end + 2);
    send(
      {
        kind: "result",
        ok: true,
        subtype: "success",
        text: reply,
        costUsd: 0.0412,
        durationMs: 4200,
        turns: 2,
        denials: [],
      },
      end + 4,
    );
    return Promise.resolve(true);
  }
  claudeStop() {
    return Promise.resolve();
  }
  claudeCheckLimits() {
    return Promise.resolve(this.settings.lastRateLimit);
  }

  /** For the tests: start signed out of GitHub. */
  signOutOfGitHub() {
    this.githubLoggedIn = false;
  }
  githubAccount(): Promise<GitHubAccount> {
    const base = { installed: true, exe: "/usr/bin/gh" };
    return Promise.resolve(
      this.githubLoggedIn
        ? {
            ...base,
            loggedIn: true,
            login: "Luna-OS",
            name: "Luna",
            url: "https://github.com/Luna-OS",
            avatar: null,
          }
        : { ...base, loggedIn: false, login: null, name: null, url: null, avatar: null },
    );
  }
  githubRepos() {
    return Promise.resolve({ source: "api" as const, repos: REPOS });
  }
  githubClone(_url: string, name: string) {
    return Promise.resolve(join("/home/luna/Moon Code Projects", name));
  }
}

function demoReply(prompt: string) {
  return (
    `I looked at \`src/App.tsx\` for "${prompt.slice(0, 60)}".\n\n` +
    "The start page keeps its progress in local state and shows it with `MoonPhase`. " +
    "To make the button reflect the real extraction, pass the job's progress in:\n\n" +
    "```tsx\n<MoonPhase fraction={job.percent / 100} size={48} />\n```\n\n" +
    "Want me to wire it up?"
  );
}
