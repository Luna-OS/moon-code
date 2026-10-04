import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sky } from "./theme/Sky";
import { CloseIcon, CloudIcon, PlusIcon, TerminalIcon, FileIcon, MoonIcon } from "./theme/icons";
import { useDocumentTheme } from "./theme/useTheme";
import { defaultBridge } from "./lib/bridge";
import { languageName, languageOf, kindColor } from "./lib/languages";
import { basename, relative, resolveIn } from "./lib/paths";
import type {
  ClaudeAccount,
  CloudTask,
  GitHubAccount,
  MoonCodeBridge,
  PlanUsage,
  RateLimit,
  Settings,
  SysInfo,
  Repo,
  UpdateStatus,
} from "./lib/types";
import { ActivityBar, Sash, StatusBar, TitleBar, type SideView } from "./workbench/chrome";
import { ExplorerView } from "./workbench/ExplorerView";
import { SearchView } from "./workbench/SearchView";
import { ProjectsView } from "./workbench/ProjectsView";
import { ClaudePanel, type ClaudeInfo, type ResumeRequest } from "./workbench/ClaudePanel";
import { QuickOpen, type Command } from "./workbench/QuickOpen";
import { Welcome } from "./workbench/Welcome";
import { SettingsDialog } from "./workbench/SettingsDialog";
import { CloudView } from "./workbench/CloudView";
import { SkillsView } from "./workbench/SkillsView";
import { CloudWeb } from "./workbench/CloudWeb";
import { UsageView } from "./workbench/UsageView";
import { AccountMenu } from "./workbench/AccountMenu";
import { CLAUDE_CODE_WEB, isClaudeCodeUrl } from "./lib/cloud";

// Monaco and xterm are big; they load when the first file or terminal opens.
const CodeEditor = lazy(() => import("./workbench/CodeEditor"));
const TerminalView = lazy(() => import("./workbench/TerminalView"));

interface Tab {
  path: string;
  /** The text on disk (as last loaded or saved). */
  saved: string;
  /** The text in the editor. */
  value: string;
  language: string;
}

interface TerminalTab {
  id: string;
  title: string;
  command?: string[] | string;
  /** Where it starts; the open folder when unset. */
  cwd?: string;
}

let terminalSeq = 0;

export default function App({ bridge: given }: { bridge?: MoonCodeBridge }) {
  const bridge = useMemo(() => given ?? defaultBridge(), [given]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [sys, setSys] = useState<SysInfo | null>(null);
  const [folder, setFolder] = useState<string | null>(null);
  const [branch, setBranch] = useState<string | null>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [view, setView] = useState<SideView | null>("explorer");
  const [sideWidth, setSideWidth] = useState(270);
  const [claudeOpen, setClaudeOpen] = useState(true);
  const [claudeWidth, setClaudeWidth] = useState(400);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelHeight, setPanelHeight] = useState(240);
  const [terminals, setTerminals] = useState<TerminalTab[]>([]);
  const [activeTerminal, setActiveTerminal] = useState<string | null>(null);
  const [account, setAccount] = useState<ClaudeAccount | null>(null);
  const [limits, setLimits] = useState<RateLimit | null>(null);
  const [claudeInfo, setClaudeInfo] = useState<ClaudeInfo | null>(null);
  const [cursor, setCursor] = useState<{ line: number; column: number } | null>(null);
  const [quick, setQuick] = useState<string | null>(null);
  const [files, setFiles] = useState<string[] | null>(null);
  const [reveal, setReveal] = useState<{ line: number; column: number; nonce: number } | null>(
    null,
  );
  const [resume, setResume] = useState<ResumeRequest | null>(null);
  const [prefill, setPrefill] = useState<{ text: string; nonce: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [waitingForLogin, setWaitingForLogin] = useState(false);
  const [github, setGithub] = useState<GitHubAccount | null>(null);
  /** Polling for the GitHub account while `gh auth login` / `logout` runs in a terminal. */
  const [waitingForGithub, setWaitingForGithub] = useState<"in" | "out" | null>(null);
  /** "owner/name" of the open folder's GitHub remote. */
  const [repo, setRepo] = useState<string | null>(null);
  const [update, setUpdate] = useState<UpdateStatus | null>(null);
  /** The GitHub repositories for the Cloud view (null while they load). */
  const [cloudRepos, setCloudRepos] = useState<Repo[] | null>(null);
  /** The cloud tab (claude.ai/code inside Moon Code), when it is open. */
  const [web, setWeb] = useState<{ url: string; nonce: number } | null>(null);
  /** Which kind of tab is in front: a file, the web tab or the Usage tab. */
  const [front, setFront] = useState<"file" | "web" | "usage">("file");
  /** The Usage tab, when it is open. */
  const [usageOpen, setUsageOpen] = useState(false);
  /** The plan's usage from Claude Code's `/usage` (null: none known, or no plan numbers). */
  const [usage, setUsage] = useState<PlanUsage | null>(null);
  /** When the usage numbers last arrived (from `/usage` or a message to Claude). */
  const [usageAt, setUsageAt] = useState<number | null>(null);
  const [accountMenu, setAccountMenu] = useState(false);
  /** The terminals running `claude --cloud` for a task, by terminal: the task's `at`. */
  const cloudTerminals = useRef(new Map<string, number>());

  const theme = useDocumentTheme(settings?.theme ?? "dark");
  useEffect(() => {
    void bridge.setTheme(theme);
  }, [bridge, theme]);

  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const refreshAccount = useCallback(() => {
    bridge
      .claudeStatus()
      .then(setAccount)
      .catch(() =>
        setAccount({
          installed: false,
          exe: null,
          version: null,
          loggedIn: false,
          authMethod: null,
          email: null,
          organization: null,
          plan: null,
        }),
      );
  }, [bridge]);

  const refreshGithub = useCallback(() => {
    bridge
      .githubAccount()
      .then(setGithub)
      .catch(() =>
        setGithub({
          installed: false,
          exe: null,
          loggedIn: false,
          login: null,
          name: null,
          url: null,
          avatar: null,
        }),
      );
  }, [bridge]);

  /** The branch and the GitHub repository of a folder, for the status bar and the cloud. */
  const loadGitInfo = useCallback(
    (path: string) => {
      bridge
        .gitBranch(path)
        .then(setBranch)
        .catch(() => setBranch(null));
      bridge
        .gitHubRepo(path)
        .then(setRepo)
        .catch(() => setRepo(null));
    },
    [bridge],
  );

  // ---------------------------------------------------------------- folders and files

  const openFolder = useCallback(
    async (path: string) => {
      const dirty = tabs.filter((t) => t.value !== t.saved);
      if (
        dirty.length &&
        !window.confirm(`${dirty.length} file(s) have unsaved changes. Open another folder anyway?`)
      ) {
        return;
      }
      if (tabs.length) {
        const mod = await import("./workbench/monaco-models");
        for (const t of tabs) mod.disposeModel(t.path);
      }
      setTabs([]);
      setActive(null);
      setCursor(null);
      setFiles(null);
      setFolder(path);
      setView((v) => v ?? "explorer");
      bridge
        .folderOpened(path)
        .then(setSettings)
        .catch(() => {});
      loadGitInfo(path);
      void bridge.setTitle(`${basename(path)} – Moon Code`);
    },
    [bridge, tabs, loadGitInfo],
  );

  const pickFolder = useCallback(async () => {
    const p = await bridge.pickFolder();
    if (p) await openFolder(p);
  }, [bridge, openFolder]);

  // Start: settings, the machine, Claude, and the last folder.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const [s, i] = await Promise.all([bridge.getSettings(), bridge.info()]);
      setSettings(s);
      setSys(i);
      setLimits(s.lastRateLimit);
      if (s.lastFolder) {
        setFolder(s.lastFolder);
        loadGitInfo(s.lastFolder);
        void bridge.setTitle(`${basename(s.lastFolder)} – Moon Code`);
      }
    })();
    refreshAccount();
    refreshGithub();
  }, [bridge, refreshAccount, refreshGithub, loadGitInfo]);

  // The Cloud view lists the signed-in GitHub account's repositories.
  const githubLogin = github?.loggedIn ? github.login : null;
  useEffect(() => {
    if (view !== "cloud" || !githubLogin) return;
    let cancelled = false;
    bridge
      .githubRepos()
      .then((r) => !cancelled && setCloudRepos(r.repos))
      .catch(() => !cancelled && setCloudRepos([]));
    return () => {
      cancelled = true;
    };
  }, [bridge, view, githubLogin]);

  // Moon Code's own updates: the state now, and every change (a check at start, a download…).
  const announced = useRef<string | null>(null);
  useEffect(() => {
    bridge
      .updateState()
      .then(setUpdate)
      .catch(() => {});
    return bridge.on("update:status", (u) => {
      setUpdate(u);
      // Say once per version that there's a new one.
      if (u.state === "available" && u.version && announced.current !== u.version) {
        announced.current = u.version;
        setToast(`Moon Code ${u.version} is out – Settings → Updates.`);
      }
    });
  }, [bridge]);

  // While `gh auth login` (or logout) runs in a terminal, look for the change every few seconds.
  useEffect(() => {
    if (!waitingForGithub) return;
    const t = setInterval(() => {
      bridge
        .githubAccount()
        .then((a) => {
          setGithub(a);
          if (waitingForGithub === "in" && a.loggedIn) {
            setWaitingForGithub(null);
            notify(`Signed in to GitHub as @${a.login}.`);
          } else if (waitingForGithub === "out" && !a.loggedIn) {
            setWaitingForGithub(null);
          }
        })
        .catch(() => {});
    }, 2500);
    return () => clearInterval(t);
  }, [bridge, waitingForGithub, notify]);

  // While the sign-in runs in the terminal, look for the account every few seconds.
  useEffect(() => {
    if (!waitingForLogin) return;
    const t = setInterval(() => {
      bridge
        .claudeStatus()
        .then((a) => {
          setAccount(a);
          if (a.loggedIn) {
            setWaitingForLogin(false);
            setView("projects");
            notify(`Signed in${a.email ? ` as ${a.email}` : ""}. Your projects are in Projects.`);
          }
        })
        .catch(() => {});
    }, 2500);
    return () => clearInterval(t);
  }, [bridge, waitingForLogin, notify]);

  const openFile = useCallback(
    async (path: string, at?: { line: number; column: number }) => {
      if (at) setReveal({ ...at, nonce: Date.now() });
      setFront("file");
      if (tabs.some((t) => t.path === path)) {
        setActive(path);
        return;
      }
      try {
        const text = await bridge.readFile(path);
        setTabs((ts) =>
          ts.some((t) => t.path === path)
            ? ts
            : [...ts, { path, saved: text, value: text, language: languageOf(path) }],
        );
        setActive(path);
      } catch (e) {
        notify((e as Error).message);
      }
    },
    [bridge, tabs, notify],
  );

  const closeTab = useCallback(
    (path: string) => {
      const tab = tabs.find((t) => t.path === path);
      if (
        tab &&
        tab.value !== tab.saved &&
        !window.confirm(`${basename(path)} has unsaved changes. Close it anyway?`)
      ) {
        return;
      }
      const i = tabs.findIndex((t) => t.path === path);
      const rest = tabs.filter((t) => t.path !== path);
      setTabs(rest);
      if (active === path) setActive(rest.length ? rest[Math.min(i, rest.length - 1)].path : null);
      void import("./workbench/monaco-models").then((m) => m.disposeModel(path));
    },
    [tabs, active],
  );

  const save = useCallback(async () => {
    const tab = tabs.find((t) => t.path === active);
    if (!tab) return;
    try {
      await bridge.writeFile(tab.path, tab.value);
      setTabs((ts) => ts.map((t) => (t.path === tab.path ? { ...t, saved: tab.value } : t)));
    } catch (e) {
      notify((e as Error).message);
    }
  }, [bridge, tabs, active, notify]);

  const onEdit = useCallback((path: string, value: string) => {
    setTabs((ts) => ts.map((t) => (t.path === path ? { ...t, value } : t)));
  }, []);

  const onRenamed = useCallback((from: string, to: string) => {
    setTabs((ts) =>
      ts.map((t) => (t.path === from ? { ...t, path: to, language: languageOf(to) } : t)),
    );
    setActive((a) => (a === from ? to : a));
    void import("./workbench/monaco-models").then((m) => m.disposeModel(from));
  }, []);

  const onDeleted = useCallback((path: string) => {
    setTabs((ts) =>
      ts.filter(
        (t) => t.path !== path && !t.path.startsWith(`${path}/`) && !t.path.startsWith(`${path}\\`),
      ),
    );
    setActive((a) =>
      a && (a === path || a.startsWith(`${path}/`) || a.startsWith(`${path}\\`)) ? null : a,
    );
  }, []);

  // ---------------------------------------------------------------- panels

  const newTerminal = useCallback(
    (command?: string[] | string, title = "Terminal", cwd?: string) => {
      const id = `term-${++terminalSeq}`;
      setTerminals((t) => [...t, { id, title, command, cwd }]);
      setActiveTerminal(id);
      setPanelOpen(true);
      return id;
    },
    [],
  );

  const togglePanel = useCallback(() => {
    setPanelOpen((open) => {
      if (!open && terminals.length === 0) {
        const id = `term-${++terminalSeq}`;
        setTerminals([{ id, title: "Terminal" }]);
        setActiveTerminal(id);
      }
      return !open;
    });
  }, [terminals.length]);

  const closeTerminal = (id: string) => {
    const rest = terminals.filter((t) => t.id !== id);
    setTerminals(rest);
    if (activeTerminal === id) setActiveTerminal(rest.length ? rest[rest.length - 1].id : null);
    if (!rest.length) setPanelOpen(false);
  };

  const claudeExe = account?.exe ?? "claude";
  const signIn = useCallback(() => {
    newTerminal([claudeExe, "auth", "login"], "Sign in to Claude");
    setWaitingForLogin(true);
    setClaudeOpen(true);
  }, [newTerminal, claudeExe]);

  /** Runs `claude <args>` in a new terminal tab (the cloud commands are interactive). */
  const runClaude = useCallback(
    (args: string[], title: string, cwd?: string) => newTerminal([claudeExe, ...args], title, cwd),
    [newTerminal, claudeExe],
  );

  /** Shows `url` (a claude.ai/code page) in the cloud tab. */
  const openWeb = useCallback((url: string) => {
    setWeb({ url, nonce: Date.now() });
    setFront("web");
  }, []);

  /** A link from anywhere in the workbench: cloud sessions stay in Moon Code. */
  const openLink = useCallback(
    (url: string) => {
      if (isClaudeCodeUrl(url)) openWeb(url);
      else void bridge.openExternal(url);
    },
    [bridge, openWeb],
  );

  const closeWeb = useCallback(() => {
    setWeb(null);
    setFront((f) => (f === "web" ? (usageOpen ? "usage" : "file") : f));
  }, [usageOpen]);

  const openUsage = useCallback(() => {
    setUsageOpen(true);
    setFront("usage");
  }, []);

  const closeUsage = useCallback(() => {
    setUsageOpen(false);
    setFront((f) => (f === "usage" ? (web ? "web" : "file") : f));
  }, [web]);

  const ghExe = github?.exe ?? "gh";
  const githubSignIn = useCallback(() => {
    newTerminal(
      [ghExe, "auth", "login", "--hostname", "github.com", "--web", "--git-protocol", "https"],
      "Sign in to GitHub",
    );
    setWaitingForGithub("in");
  }, [newTerminal, ghExe]);

  const githubSignOut = useCallback(() => {
    newTerminal([ghExe, "auth", "logout", "--hostname", "github.com"], "Sign out of GitHub");
    setWaitingForGithub("out");
  }, [newTerminal, ghExe]);

  const installGithub = useCallback(() => {
    if (sys?.platform === "win32") {
      newTerminal("winget install --id GitHub.cli -e --source winget", "Install GitHub CLI");
    } else if (sys?.platform === "darwin") {
      newTerminal("brew install gh", "Install GitHub CLI");
    } else {
      void bridge.openExternal("https://cli.github.com");
    }
  }, [newTerminal, sys, bridge]);

  const addCloudTask = useCallback(
    (task: CloudTask) =>
      setSettings((s) => {
        if (!s) return s;
        const cloudTasks = [task, ...s.cloudTasks].slice(0, 30);
        bridge.setSettings({ cloudTasks }).catch(() => {});
        return { ...s, cloudTasks };
      }),
    [bridge],
  );

  const updateCloudTask = useCallback(
    (at: number, patch: Partial<CloudTask>) =>
      setSettings((s) => {
        if (!s) return s;
        const cloudTasks = s.cloudTasks.map((t) => (t.at === at ? { ...t, ...patch } : t));
        bridge.setSettings({ cloudTasks }).catch(() => {});
        return { ...s, cloudTasks };
      }),
    [bridge],
  );

  // `claude --cloud` printed its session's link: remember it with the task and show the session
  // here, in the cloud tab – not in a browser or the Claude app.
  useEffect(() => {
    const offSession = bridge.on("cloud:session", ({ terminalId, id, url }) => {
      const at = cloudTerminals.current.get(terminalId);
      if (at === undefined) return;
      cloudTerminals.current.delete(terminalId);
      updateCloudTask(at, { sessionId: id, url });
      openWeb(url);
    });
    const offOpen = bridge.on("cloud:open", ({ url }) => openWeb(url));
    return () => {
      offSession();
      offOpen();
    };
  }, [bridge, updateCloudTask, openWeb]);

  /**
   * Continues cloud session `id` on this computer (`claude --teleport`), in a checkout of its
   * repository: the open folder when it is that one, else Moon Code's clone (made once).
   */
  const teleport = useCallback(
    async (id: string, repoName: string | null) => {
      let cwd: string | undefined;
      if (repoName && repoName !== repo) {
        try {
          cwd = await bridge.githubClone(
            `https://github.com/${repoName}.git`,
            repoName.split("/").pop() ?? repoName,
          );
        } catch (e) {
          notify((e as Error).message);
          return;
        }
      }
      runClaude(["--teleport", id], "Cloud session here", cwd);
    },
    [bridge, repo, runClaude, notify],
  );

  /**
   * A cloud task on `target`, or on the open folder's repository (null). Another repository is
   * cloned first (once – an existing clone is reused), because `claude --cloud` works on the
   * repository of the folder it runs in.
   */
  const startCloudTask = useCallback(
    async (task: string, target: Repo | null) => {
      let cwd: string | undefined;
      let name = repo;
      if (target) {
        try {
          cwd = await bridge.githubClone(target.cloneUrl, target.name);
        } catch (e) {
          notify((e as Error).message);
          return;
        }
        name = target.fullName;
      }
      const id = newTerminal(
        [claudeExe, "--cloud", task],
        `Cloud: ${task.length > 24 ? `${task.slice(0, 23)}…` : task}`,
        cwd,
      );
      if (name) {
        const at = Date.now();
        cloudTerminals.current.set(id, at);
        addCloudTask({ task, repo: name, at });
      }
    },
    [bridge, repo, claudeExe, newTerminal, notify, addCloudTask],
  );

  const installClaude = useCallback(() => {
    const win = sys?.platform === "win32";
    newTerminal(
      win
        ? "irm https://claude.ai/install.ps1 | iex"
        : "curl -fsSL https://claude.ai/install.sh | bash",
      "Install Claude Code",
    );
  }, [newTerminal, sys]);

  const toggleView = useCallback((v: SideView) => setView((cur) => (cur === v ? null : v)), []);

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((s) => (s ? { ...s, ...patch } : s));
      bridge.setSettings(patch).catch(() => {});
    },
    [bridge],
  );

  const onLimits = useCallback(
    (rl: RateLimit) => {
      setLimits(rl);
      setUsageAt(Date.now());
      // A message's numbers are newer than the last report.
      setUsage((u) =>
        u ? { ...u, session: rl.fiveHour ?? u.session, week: rl.sevenDay ?? u.week } : u,
      );
      bridge.setSettings({ lastRateLimit: rl }).catch(() => {});
    },
    [bridge],
  );

  // The usage, live: Claude Code's `/usage` (it costs no usage) every 30 seconds while the Usage
  // tab is in front and every 3 minutes otherwise, and right away when the tab opens or Moon Code
  // comes back to the front. Without plan numbers there, the limits come from Claude's answers,
  // and the Usage tab checks them itself every 10 minutes (that check is one tiny message).
  const signedIn = Boolean(account?.loggedIn);
  const usageShown = usageOpen && front === "usage";
  const lastPing = useRef(0);
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    const load = () => {
      bridge
        .claudeUsage()
        .then((u) => {
          if (cancelled) return;
          if (u && u.available && (u.session || u.week)) {
            setUsage(u);
            setUsageAt(u.at);
            setLimits((l) => ({
              status: l?.status ?? null,
              type: l?.type ?? null,
              usingOverage: l?.usingOverage ?? false,
              fiveHour: u.session ?? l?.fiveHour ?? null,
              sevenDay: u.week ?? l?.sevenDay ?? null,
              at: u.at,
            }));
          } else if (u) {
            setUsage(u);
          } else if (usageShown && Date.now() - lastPing.current > 10 * 60_000) {
            lastPing.current = Date.now();
            void bridge
              .claudeCheckLimits()
              .then((rl) => {
                if (!cancelled && rl) onLimits({ ...rl, at: Date.now() });
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, usageShown ? 30_000 : 180_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [bridge, signedIn, usageShown, onLimits]);

  const openQuick = useCallback(
    (initial: string) => {
      setQuick(initial);
      if (folder && !files && !initial.startsWith(">")) {
        bridge
          .listFiles(folder)
          .then(setFiles)
          .catch(() => setFiles([]));
      }
    },
    [bridge, folder, files],
  );

  const askClaude = useCallback(
    (selection: string) => {
      setClaudeOpen(true);
      const where = active && folder ? `@${relative(folder, active)}` : "";
      const text = selection
        ? `${where ? `In ${where}:` : ""}\n\`\`\`\n${selection}\n\`\`\`\n`
        : where;
      setPrefill({ text, nonce: Date.now() });
    },
    [active, folder],
  );

  const commands: Command[] = useMemo(
    () => [
      { id: "open-folder", label: "Open folder…", run: () => void pickFolder() },
      { id: "save", label: "Save", keys: "Ctrl+S", run: () => void save() },
      {
        id: "close-tab",
        label: "Close editor",
        keys: "Ctrl+W",
        run: () => active && closeTab(active),
      },
      {
        id: "claude",
        label: "Claude: Open the chat",
        keys: "Ctrl+L",
        run: () => setClaudeOpen(true),
      },
      { id: "claude-ask", label: "Claude: Ask about the open file", run: () => askClaude("") },
      { id: "claude-signin", label: "Claude: Sign in", run: signIn },
      { id: "github-signin", label: "GitHub: Sign in", run: githubSignIn },
      { id: "cloud", label: "Cloud: New task for Claude on the web", run: () => setView("cloud") },
      {
        id: "cloud-web",
        label: "Cloud: Open Claude Code on the web",
        run: () => openWeb(CLAUDE_CODE_WEB),
      },
      { id: "claude-status", label: "Claude: Refresh account and limits", run: refreshAccount },
      { id: "usage", label: "Claude: Show usage", run: openUsage },
      { id: "skills", label: "Claude: Show skills", run: () => setView("skills") },
      {
        id: "projects",
        label: "Show projects",
        keys: "Ctrl+Shift+O",
        run: () => setView("projects"),
      },
      {
        id: "explorer",
        label: "Show explorer",
        keys: "Ctrl+Shift+E",
        run: () => setView("explorer"),
      },
      {
        id: "search",
        label: "Search in files",
        keys: "Ctrl+Shift+F",
        run: () => setView("search"),
      },
      { id: "terminal", label: "New terminal", keys: "Ctrl+Shift+`", run: () => newTerminal() },
      { id: "toggle-terminal", label: "Toggle terminal", keys: "Ctrl+`", run: togglePanel },
      {
        id: "sidebar",
        label: "Toggle side bar",
        keys: "Ctrl+B",
        run: () => setView((v) => (v ? null : "explorer")),
      },
      {
        id: "theme",
        label: "Switch night / day theme",
        run: () => updateSettings({ theme: theme === "dark" ? "light" : "dark" }),
      },
      { id: "settings", label: "Settings", keys: "Ctrl+,", run: () => setShowSettings(true) },
      { id: "devtools", label: "Developer tools", run: () => void bridge.devtools() },
    ],
    [
      pickFolder,
      save,
      active,
      closeTab,
      askClaude,
      signIn,
      githubSignIn,
      openWeb,
      openUsage,
      refreshAccount,
      newTerminal,
      togglePanel,
      updateSettings,
      theme,
      bridge,
    ],
  );

  // Keyboard shortcuts of the whole window.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      let handled = true;
      if (k === "s" && !e.shiftKey) void save();
      else if (k === "p" && e.shiftKey) openQuick(">");
      else if (k === "p") openQuick("");
      else if (k === "b" && !e.shiftKey) setView((v) => (v ? null : "explorer"));
      else if (k === "e" && e.shiftKey) setView("explorer");
      else if (k === "f" && e.shiftKey) setView("search");
      else if (k === "o" && e.shiftKey) setView("projects");
      else if (k === "l" && !e.shiftKey) setClaudeOpen((o) => !o);
      else if (e.code === "Backquote" && e.shiftKey) newTerminal();
      else if (e.code === "Backquote") togglePanel();
      else if (k === "w" && front === "web" && web) closeWeb();
      else if (k === "w" && front === "usage" && usageOpen) closeUsage();
      else if (k === "w" && active) closeTab(active);
      else if (k === ",") setShowSettings(true);
      else if (k === "o" && !e.shiftKey) void pickFolder();
      else handled = false;
      if (handled) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    save,
    openQuick,
    newTerminal,
    togglePanel,
    active,
    closeTab,
    pickFolder,
    front,
    web,
    closeWeb,
    usageOpen,
    closeUsage,
  ]);

  const activeTab = tabs.find((t) => t.path === active) ?? null;
  /** The web tab's name: Cloud for Claude Code on the web, else the site. */
  const webLabel = web && isClaudeCodeUrl(web.url) ? "Cloud" : "claude.ai";
  /** The file in front: none while the cloud tab is. */
  const shownTab = (front === "web" && web) || (front === "usage" && usageOpen) ? null : activeTab;
  const editorActions = useMemo(
    () => ({
      save: () => void save(),
      quickOpen: () => openQuick(""),
      commands: () => openQuick(">"),
      askClaude,
    }),
    [save, openQuick, askClaude],
  );

  if (!settings) {
    return (
      <div className="flex h-full items-center justify-center">
        <Sky />
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      <Sky />
      <TitleBar
        folderName={folder ? basename(folder) : null}
        onQuickOpen={() => openQuick("")}
        onOpenFolder={() => void pickFolder()}
      />
      <div className="relative z-[1] flex min-h-0 flex-1">
        <ActivityBar
          view={view}
          claudeOpen={claudeOpen}
          claudeBusy={Boolean(claudeInfo?.busy)}
          onView={toggleView}
          onClaude={() => setClaudeOpen((o) => !o)}
          accountOpen={accountMenu}
          onAccount={() => {
            setAccountMenu((o) => !o);
            refreshAccount();
          }}
          onSettings={() => setShowSettings(true)}
          updateReady={update?.state === "available" || update?.state === "ready"}
        />
        {view && (
          <>
            <div className="mc-sidebar flex min-h-0 shrink-0 flex-col" style={{ width: sideWidth }}>
              {view === "explorer" && (
                <ExplorerView
                  key={folder ?? ""}
                  bridge={bridge}
                  root={folder}
                  activePath={active}
                  onOpenFile={(p) => void openFile(p)}
                  onOpenFolder={() => void pickFolder()}
                  onRenamed={onRenamed}
                  onDeleted={onDeleted}
                  onError={notify}
                />
              )}
              {view === "search" && (
                <SearchView
                  bridge={bridge}
                  root={folder}
                  onOpen={(p, line, column) => void openFile(p, { line, column })}
                />
              )}
              {view === "projects" && (
                <ProjectsView
                  bridge={bridge}
                  account={account}
                  home={sys?.home ?? null}
                  currentFolder={folder}
                  onOpenFolder={(p) => void openFolder(p)}
                  onResume={(p, s) => {
                    void (async () => {
                      if (p !== folder) await openFolder(p);
                      setClaudeOpen(true);
                      setResume({ sessionId: s.id, title: s.title, nonce: Date.now() });
                    })();
                  }}
                  onSignIn={signIn}
                  onError={notify}
                  github={github}
                  onGitHubSignIn={githubSignIn}
                  onGitHubSignOut={githubSignOut}
                  onGitHubInstall={installGithub}
                  onGitHubRefresh={refreshGithub}
                />
              )}
              {view === "skills" && (
                <SkillsView
                  bridge={bridge}
                  folder={folder}
                  onOpenFile={(p) => void openFile(p)}
                  onUse={(name) => {
                    setClaudeOpen(true);
                    setPrefill({ text: `/${name} `, nonce: Date.now() });
                  }}
                  onNotify={notify}
                />
              )}
              {view === "cloud" && (
                <CloudView
                  bridge={bridge}
                  claude={account}
                  github={github}
                  folder={folder}
                  repo={repo}
                  repos={cloudRepos}
                  tasks={settings.cloudTasks ?? []}
                  onRun={runClaude}
                  onStartTask={startCloudTask}
                  onOpenWeb={openWeb}
                  onSend={(ref, message) => bridge.cloudSend(ref, message)}
                  onTeleport={(id, repoName) => void teleport(id, repoName)}
                  onClaudeSignIn={signIn}
                  onGitHubSignIn={githubSignIn}
                  onGitHubSignOut={githubSignOut}
                  onGitHubInstall={installGithub}
                  onGitHubRefresh={refreshGithub}
                  onOpen={(url) => void bridge.openExternal(url)}
                />
              )}
            </div>
            <Sash
              axis="x"
              size={sideWidth}
              min={180}
              max={560}
              onResize={setSideWidth}
              label="Resize the side bar"
            />
          </>
        )}

        <main className="flex min-w-0 flex-1 flex-col">
          {(tabs.length > 0 || web || usageOpen) && (
            <div
              className="mc-tabs flex shrink-0 overflow-x-auto"
              role="tablist"
              aria-label="Open files"
            >
              {tabs.map((t) => {
                const dirty = t.value !== t.saved;
                return (
                  <div
                    key={t.path}
                    role="tab"
                    tabIndex={0}
                    aria-selected={t.path === shownTab?.path}
                    className="mc-tab group"
                    title={folder ? relative(folder, t.path) : t.path}
                    onClick={() => {
                      setActive(t.path);
                      setFront("file");
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      setActive(t.path);
                      setFront("file");
                    }}
                    onMouseDown={(e) => {
                      if (e.button === 1) {
                        e.preventDefault();
                        closeTab(t.path);
                      }
                    }}
                  >
                    <span style={{ color: kindColor(t.path) }}>
                      <FileIcon size={14} />
                    </span>
                    {basename(t.path)}
                    <button
                      type="button"
                      className="mc-tab-close border-0 bg-transparent p-0"
                      aria-label={`Close ${basename(t.path)}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(t.path);
                      }}
                    >
                      {dirty ? (
                        <>
                          <span className="mc-dirty group-hover:hidden" />
                          <span className="hidden group-hover:inline-flex">
                            <CloseIcon size={12} />
                          </span>
                        </>
                      ) : (
                        <CloseIcon size={12} />
                      )}
                    </button>
                  </div>
                );
              })}
              {web && (
                <div
                  role="tab"
                  tabIndex={0}
                  aria-selected={front === "web"}
                  className="mc-tab group"
                  title={`${web.url} – inside Moon Code`}
                  onClick={() => setFront("web")}
                  onKeyDown={(e) => e.key === "Enter" && setFront("web")}
                  onMouseDown={(e) => {
                    if (e.button === 1) {
                      e.preventDefault();
                      closeWeb();
                    }
                  }}
                >
                  <span style={{ color: "var(--mc-accent)" }}>
                    <CloudIcon size={14} />
                  </span>
                  {webLabel}
                  <button
                    type="button"
                    className="mc-tab-close border-0 bg-transparent p-0"
                    aria-label={`Close ${webLabel}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      closeWeb();
                    }}
                  >
                    <CloseIcon size={12} />
                  </button>
                </div>
              )}
              {usageOpen && (
                <div
                  role="tab"
                  tabIndex={0}
                  aria-selected={front === "usage"}
                  className="mc-tab group"
                  title="Your plan's usage"
                  onClick={() => setFront("usage")}
                  onKeyDown={(e) => e.key === "Enter" && setFront("usage")}
                  onMouseDown={(e) => {
                    if (e.button === 1) {
                      e.preventDefault();
                      closeUsage();
                    }
                  }}
                >
                  <span style={{ color: "var(--mc-claude)" }}>
                    <MoonIcon size={14} />
                  </span>
                  Usage
                  <button
                    type="button"
                    className="mc-tab-close border-0 bg-transparent p-0"
                    aria-label="Close Usage"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeUsage();
                    }}
                  >
                    <CloseIcon size={12} />
                  </button>
                </div>
              )}
            </div>
          )}
          <div
            className="relative min-h-0 flex-1"
            style={{ background: activeTab ? "var(--mc-editor)" : undefined }}
          >
            {usageOpen && (
              <UsageView
                account={account}
                usage={usage}
                limits={limits}
                updatedAt={usageAt}
                visible={front === "usage"}
                onOpenWeb={openWeb}
                onSignIn={signIn}
              />
            )}
            {web && (
              <CloudWeb
                url={web.url}
                nonce={web.nonce}
                embedded={bridge.kind === "electron"}
                visible={front === "web"}
                theme={theme}
                title={
                  (settings.cloudTasks ?? []).find(
                    (t) => t.sessionId && web.url.includes(t.sessionId),
                  )?.task ?? null
                }
                onOpenExternal={(url) => void bridge.openExternal(url)}
              />
            )}
            {activeTab ? (
              <Suspense fallback={null}>
                <CodeEditor
                  path={activeTab.path}
                  text={activeTab.saved}
                  language={activeTab.language}
                  theme={theme}
                  fontSize={settings.fontSize}
                  wordWrap={settings.wordWrap}
                  minimap={settings.minimap}
                  reveal={reveal}
                  actions={editorActions}
                  onChange={onEdit}
                  onCursor={setCursor}
                />
              </Suspense>
            ) : (
              <Welcome
                recent={settings.recent}
                home={sys?.home ?? null}
                folder={folder}
                onOpenFolder={() => void pickFolder()}
                onOpenRecent={(p) => void openFolder(p)}
                onProjects={() => setView("projects")}
                onClaude={() => setClaudeOpen(true)}
              />
            )}
          </div>

          {panelOpen && (
            <Sash
              axis="y"
              size={panelHeight}
              min={100}
              max={700}
              invert
              onResize={setPanelHeight}
              label="Resize the terminal"
            />
          )}
          <section
            className="mc-panel flex shrink-0 flex-col"
            style={{ height: panelHeight, display: panelOpen ? "flex" : "none" }}
            aria-label="Terminal"
          >
            <div className="flex h-8 shrink-0 items-center gap-1 px-2">
              <span className="mc-eyebrow mr-2">Terminal</span>
              {terminals.map((t) => (
                <span key={t.id} className="inline-flex items-center">
                  <button
                    type="button"
                    className="mc-btn mc-btn-sm"
                    aria-pressed={t.id === activeTerminal}
                    style={{ color: t.id === activeTerminal ? "var(--mc-accent)" : undefined }}
                    onClick={() => setActiveTerminal(t.id)}
                  >
                    <TerminalIcon size={12} /> {t.title}
                  </button>
                  <button
                    type="button"
                    className="mc-icon-btn"
                    style={{ width: 20, height: 20 }}
                    aria-label={`Close ${t.title}`}
                    onClick={() => closeTerminal(t.id)}
                  >
                    <CloseIcon size={11} />
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="mc-icon-btn"
                style={{ width: 24, height: 24 }}
                aria-label="New terminal"
                title="New terminal"
                onClick={() => newTerminal()}
              >
                <PlusIcon size={14} />
              </button>
              <span className="flex-1" />
              <button
                type="button"
                className="mc-icon-btn"
                style={{ width: 24, height: 24 }}
                aria-label="Hide the terminal"
                onClick={() => setPanelOpen(false)}
              >
                <CloseIcon size={13} />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <Suspense fallback={null}>
                {terminals.map((t) => (
                  <TerminalView
                    key={t.id}
                    bridge={bridge}
                    id={t.id}
                    cwd={t.cwd ?? folder}
                    command={t.command}
                    theme={theme}
                    visible={panelOpen && t.id === activeTerminal}
                    onLink={openLink}
                  />
                ))}
              </Suspense>
            </div>
          </section>
        </main>

        {claudeOpen && (
          <>
            <Sash
              axis="x"
              size={claudeWidth}
              min={300}
              max={760}
              invert
              onResize={setClaudeWidth}
              label="Resize Claude"
            />
            <div
              className="flex min-h-0 shrink-0 flex-col border-l border-[var(--mc-border)]"
              style={{ width: claudeWidth }}
            >
              <ClaudePanel
                bridge={bridge}
                account={account}
                folder={folder}
                activeFile={active}
                settings={settings}
                limits={limits}
                resume={resume}
                prefill={prefill}
                onSettings={updateSettings}
                onLimits={onLimits}
                onInfo={setClaudeInfo}
                onSignIn={signIn}
                onInstall={installClaude}
                onRefreshAccount={refreshAccount}
                onClose={() => setClaudeOpen(false)}
                home={sys?.home ?? null}
                onResume={(s) => setResume({ sessionId: s.id, title: s.title, nonce: Date.now() })}
                onOpenFile={(p) =>
                  void openFile(folder && !/^([a-zA-Z]:)?[\\/]/.test(p) ? resolveIn(folder, p) : p)
                }
              />
            </div>
          </>
        )}
      </div>
      <StatusBar
        branch={branch}
        cursor={shownTab ? cursor : null}
        language={shownTab ? languageName(shownTab.language) : null}
        model={claudeInfo?.model ?? settings.claudeModel}
        limits={account?.loggedIn ? limits : null}
        context={
          claudeInfo?.contextTokens != null
            ? { used: claudeInfo.contextTokens, window: claudeInfo.contextWindow }
            : null
        }
        signedIn={account ? account.loggedIn : null}
        busy={Boolean(claudeInfo?.busy) && settings.mascot !== false}
        theme={theme}
        panelOpen={panelOpen}
        onToggleTheme={() => updateSettings({ theme: theme === "dark" ? "light" : "dark" })}
        onTogglePanel={togglePanel}
        onClaude={() => setClaudeOpen(true)}
      />

      {quick !== null && (
        <QuickOpen
          files={folder ? files : null}
          commands={commands}
          initial={quick}
          onOpenFile={(rel) => folder && void openFile(resolveIn(folder, rel))}
          onClose={() => setQuick(null)}
        />
      )}
      {accountMenu && (
        <AccountMenu
          account={account}
          language={settings.claudeLanguage ?? null}
          onLanguage={(l) => {
            updateSettings({ claudeLanguage: l });
            notify(
              l
                ? `Claude answers in ${l} from your next message.`
                : "Claude answers in the language you write in.",
            );
          }}
          onUsage={openUsage}
          onOpenWeb={openWeb}
          onOpenExternal={(url) => void bridge.openExternal(url)}
          onShortcuts={() => openQuick(">")}
          onSignIn={signIn}
          onSignOut={() => {
            void bridge.claudeLogout().then(refreshAccount);
          }}
          onClose={() => setAccountMenu(false)}
        />
      )}
      {showSettings && (
        <SettingsDialog
          settings={settings}
          onChange={updateSettings}
          onClose={() => setShowSettings(false)}
          update={update}
          onUpdateCheck={() => void bridge.updateCheck().then(setUpdate)}
          onUpdateDownload={() => void bridge.updateDownload()}
          onUpdateInstall={() => void bridge.updateInstall()}
        />
      )}
      {toast && (
        <div
          role="status"
          className="mc-popover fixed bottom-9 left-1/2 z-50 -translate-x-1/2 px-4 py-2 text-[0.8125rem]"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
