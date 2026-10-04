"use strict";
// Moon Code – Electron main process: the window, the open folder's files, the terminals and the
// bridge to the user's Claude Code CLI (chat, account, projects, limits).

const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  dialog,
  Menu,
  net,
  session,
  nativeTheme,
  protocol,
} = require("electron");
const { pathToFileURL } = require("url");
const fs = require("fs");
const os = require("os");
const path = require("path");
const workspace = require("./workspace.cjs");
const { Terminals } = require("./terminal.cjs");
const { Settings } = require("./settings.cjs");
const github = require("./github.cjs");
const { findClaude, runClaude } = require("./claude/cli.cjs");
const { accountStatus } = require("./claude/account.cjs");
const { listProjects, listSessions } = require("./claude/projects.cjs");
const { USAGE_ARGS, parseUsage } = require("./claude/usage.cjs");
const skills = require("./claude/skills.cjs");
const attachments = require("./claude/attachments.cjs");
const { ChatManager } = require("./claude/chat.cjs");
const { createLineParser } = require("./claude/events.cjs");
const { createUpdater } = require("./updater.cjs");
const cloud = require("./cloud.cjs");

const ROOT = path.join(__dirname, "..");
const BUILD = path.join(ROOT, "build");
// Matches FRAME_COLORS in src/theme/frame-colors.ts.
const FRAME = {
  dark: { color: "#0b0920", symbolColor: "#f4f1ff" },
  light: { color: "#ece7f7", symbolColor: "#1c1733" },
};
const TITLE_BAR_HEIGHT = 40;

app.setName("Moon Code");
// moon-file://local/<path>: pictures, PDFs, sound and video of the open files, for the viewers.
protocol.registerSchemesAsPrivileged([
  {
    scheme: "moon-file",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);
const settings = new Settings(path.join(app.getPath("userData"), "settings.json"));

/** @type {BrowserWindow | null} */
let mainWindow = null;

const send = (channel, payload) => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
};
// Session links that `claude --cloud` prints in a terminal open in Moon Code's cloud tab.
const sessionScanner = cloud.createSessionScanner((terminalId, found) =>
  send("cloud:session", { terminalId, ...found }),
);
const terminals = new Terminals((channel, payload) => {
  send(channel, payload);
  if (channel === "terminal:data") sessionScanner.push(payload.id, payload.data);
  else if (channel === "terminal:exit") sessionScanner.forget(payload.id);
});
const chats = new ChatManager((chatId, event) => {
  if (event.kind === "rate-limit") settings.set({ lastRateLimit: { ...event, at: Date.now() } });
  send("claude:event", { chatId, event });
});

// electron-updater only loads in the packaged app; in development there is nothing to update.
const updater = createUpdater({
  autoUpdater: app.isPackaged ? require("electron-updater").autoUpdater : null,
  currentVersion: app.getVersion(),
  packaged: app.isPackaged,
  send: (status) => send("update:status", status),
});

const claudeExe = () => findClaude(settings.get().claudePath);
/** Where the Claude panel's attachments are saved (electron/claude/attachments.cjs). */
const ATTACHMENTS = path.join(app.getPath("userData"), "attachments");

// ---------------------------------------------------------------- window

function createWindow() {
  const theme = settings.get().theme === "light" ? "light" : "dark";
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 820,
    minHeight: 520,
    show: false,
    backgroundColor: FRAME[theme].color,
    titleBarStyle: "hidden",
    titleBarOverlay: { ...FRAME[theme], height: TITLE_BAR_HEIGHT },
    icon: path.join(BUILD, "icon.png"),
    title: "Moon Code",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      // The cloud tab: claude.ai/code in a <webview> (see guardWebviews).
      webviewTag: true,
      // Chromium's PDF viewer, for PDF files opened in the editor.
      plugins: true,
    },
  });
  guardWebviews(mainWindow);
  if (process.env.MOON_DEV_URL) mainWindow.loadURL(process.env.MOON_DEV_URL);
  else mainWindow.loadFile(path.join(ROOT, "dist", "index.html"));
  // Links open in the browser, never inside the app – except cloud sessions, which open in the
  // cloud tab.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (cloud.sessionRef(url) || url === CLAUDE_CODE_WEB) send("cloud:open", { url });
    else if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (e) => e.preventDefault());
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------- the cloud tab

const CLAUDE_CODE_WEB = "https://claude.ai/code";

/**
 * The cloud tab's <webview> only ever shows claude.ai, in its own session, without Node or a
 * preload; the windows it opens are sign-ins (a small window of Moon Code) or links for the
 * browser.
 */
function guardWebviews(win) {
  const cloudSession = session.fromPartition(cloud.CLOUD_PARTITION);
  cloudSession.setUserAgent(cloud.cleanUserAgent(cloudSession.getUserAgent()));
  win.webContents.on("will-attach-webview", (e, prefs, params) => {
    delete prefs.preload;
    prefs.nodeIntegration = false;
    prefs.contextIsolation = true;
    prefs.sandbox = true;
    if (params.partition !== cloud.CLOUD_PARTITION || !cloud.isClaudeWeb(params.src)) {
      e.preventDefault();
    }
  });
}

app.on("web-contents-created", (_e, contents) => {
  if (contents.session !== session.fromPartition(cloud.CLOUD_PARTITION)) return;
  contents.setWindowOpenHandler(({ url }) => {
    const where = cloud.popupTarget(url);
    if (where === "external") shell.openExternal(url);
    if (where !== "app") return { action: "deny" };
    return {
      action: "allow",
      overrideBrowserWindowOptions: {
        width: 520,
        height: 720,
        autoHideMenuBar: true,
        title: "Moon Code",
        backgroundColor: FRAME.dark.color,
        icon: path.join(BUILD, "icon.png"),
        webPreferences: {
          partition: cloud.CLOUD_PARTITION,
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      },
    };
  });
});

// ---------------------------------------------------------------- IPC

/** Registers an IPC handler whose answer is an envelope: { ok, data } or { ok: false, error, code }. */
function handle(channel, fn) {
  ipcMain.handle(channel, async (e, ...args) => {
    try {
      return { ok: true, data: await fn(e, ...args) };
    } catch (err) {
      return {
        ok: false,
        error: err && err.message ? err.message : String(err),
        code: err && err.code,
      };
    }
  });
}

// The app and its window
handle("sys:info", () => ({
  platform: process.platform,
  version: app.getVersion(),
  home: os.homedir(),
  sep: path.sep,
}));
handle("settings:get", () => settings.get());
handle("settings:set", (_e, patch) => settings.set(patch));
handle("win:setTheme", (_e, theme) => {
  const t = theme === "light" ? "light" : "dark";
  // Pages in the cloud tab (claude.ai on "automatic") follow Moon Code's night or day.
  nativeTheme.themeSource = t;
  if (mainWindow) {
    mainWindow.setBackgroundColor(FRAME[t].color);
    try {
      mainWindow.setTitleBarOverlay({ ...FRAME[t], height: TITLE_BAR_HEIGHT });
    } catch {
      // not every platform draws an overlay
    }
  }
});
handle("win:setTitle", (_e, title) => mainWindow && mainWindow.setTitle(String(title)));
handle("win:devtools", () => mainWindow && mainWindow.webContents.toggleDevTools());
handle("shell:openExternal", (_e, url) => {
  if (/^https?:\/\//.test(url)) return shell.openExternal(url);
});
handle("shell:show", (_e, p) => shell.showItemInFolder(p));

// The open folder
handle("dialog:pickFolder", async () => {
  const res = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"] });
  return res.canceled ? null : res.filePaths[0];
});
handle("folder:opened", (_e, folder) => settings.addRecent(folder));
handle("fs:readDir", (_e, dir) => workspace.readDir(dir));
handle("fs:readFile", (_e, file, opts) => workspace.readFile(file, opts));
handle("fs:info", (_e, file) => workspace.fileInfo(file));
handle("fs:readBytes", (_e, file, max) => workspace.readBytes(file, max));
handle("fs:stat", (_e, files) => workspace.statFiles(files));
handle("dialog:openFiles", async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile", "multiSelections"],
  });
  return res.canceled ? [] : res.filePaths;
});
handle("dialog:saveAs", async (_e, suggested) => {
  const res = await dialog.showSaveDialog(mainWindow, { defaultPath: suggested || undefined });
  return res.canceled || !res.filePath ? null : res.filePath;
});
handle("fs:writeFile", (_e, file, content) => workspace.writeFile(file, content));
handle("fs:createFile", (_e, file) => workspace.createFile(file));
handle("fs:createFolder", (_e, dir) => workspace.createFolder(dir));
handle("fs:rename", (_e, from, to) => workspace.rename(from, to));
handle("fs:trash", (_e, p) => shell.trashItem(p));
handle("fs:listFiles", (_e, root) => workspace.listFiles(root));
handle("fs:search", (_e, root, opts) => workspace.search(root, opts));
handle("git:branch", (_e, root) => workspace.gitBranch(root));
handle("git:githubRepo", (_e, root) => workspace.gitHubRepo(root));

// Terminals
handle("terminal:start", (_e, id, opts) => terminals.start(id, opts));
handle("terminal:write", (_e, id, data) => terminals.write(id, data));
handle("terminal:resize", (_e, id, cols, rows) => terminals.resize(id, cols, rows));
handle("terminal:kill", (_e, id) => terminals.kill(id));

// Claude Code
handle("claude:status", () => accountStatus(claudeExe()));
handle("claude:projects", () => listProjects());
handle("claude:sessions", (_e, projectPath) => listSessions(projectPath));
handle("claude:logout", async () => {
  const exe = claudeExe();
  if (exe) await runClaude(exe, ["auth", "logout"]);
});
handle("claude:start", (_e, chatId, opts) => {
  const exe = claudeExe();
  if (!exe) {
    const err = new Error("Claude Code isn't installed.");
    err.code = "ENOCLAUDE";
    throw err;
  }
  fs.mkdirSync(ATTACHMENTS, { recursive: true });
  return chats.start(chatId, {
    ...opts,
    exe,
    cwd: opts.cwd || os.homedir(),
    attachmentsDir: ATTACHMENTS,
  });
});
handle("claude:send", (_e, chatId, text, files) => {
  const saved =
    files && files.length ? attachments.saveAttachments(ATTACHMENTS, chatId, files) : [];
  return chats.send(chatId, attachments.messageContent(text, saved));
});
handle("claude:stop", (_e, chatId) => chats.stop(chatId));
/**
 * Asks Claude Code for the plan's limits with the smallest possible request (one word from Haiku,
 * no tools, nothing saved): the answer comes with the current rate-limit windows.
 */
handle("claude:checkLimits", async () => {
  const exe = claudeExe();
  if (!exe) return null;
  let found = null;
  const parser = createLineParser((ev) => {
    if (ev.kind === "rate-limit") found = ev;
  });
  const res = await runClaude(
    exe,
    [
      "-p",
      "Reply with OK.",
      "--model",
      "haiku",
      "--output-format",
      "stream-json",
      "--verbose",
      "--tools",
      "",
      "--no-session-persistence",
    ],
    { timeoutMs: 60_000 },
  );
  parser.push(res.stdout);
  parser.end();
  if (found) settings.set({ lastRateLimit: { ...found, at: Date.now() } });
  return found;
});

/**
 * The plan's usage from Claude Code's `/usage` (runs locally, costs no usage), or null when it
 * has no plan numbers. The 5-hour and weekly windows also become the last known limits.
 */
handle("claude:usage", async () => {
  const exe = claudeExe();
  if (!exe) return null;
  const res = await runClaude(exe, USAGE_ARGS, { timeoutMs: 30_000 });
  const usage = parseUsage(res.stdout);
  if (usage && usage.available && (usage.session || usage.week)) {
    const prev = settings.get().lastRateLimit || {};
    settings.set({
      lastRateLimit: {
        status: prev.status ?? null,
        type: prev.type ?? null,
        usingOverage: prev.usingOverage ?? false,
        fiveHour: usage.session,
        sevenDay: usage.week,
        at: usage.at,
      },
    });
  }
  return usage;
});

// Skills
handle("skills:list", (_e, project) => skills.listSkills(project));
handle("skills:create", (_e, opts) => skills.createSkill(opts));
handle("skills:install", (_e, repo) =>
  skills.installFromGitHub(repo, {
    download: (owner, name) =>
      github.downloadTarball(owner, name, (url, opts) => net.fetch(url, opts)),
  }),
);
handle("skills:remove", (_e, dir, project) => shell.trashItem(skills.skillFolder(dir, project)));

// Projects on GitHub
handle("github:account", () => github.account((url, opts) => net.fetch(url, opts)));
handle("github:repos", () =>
  github.listRepos(settings.get().githubOwner, (url, opts) => net.fetch(url, opts)),
);
handle("github:clone", (_e, cloneUrl, name) =>
  github.clone(cloneUrl, settings.get().projectsFolder, name),
);

// Updates
handle("update:state", () => updater.get());
handle("update:check", () => updater.check());
handle("update:download", () => updater.download());
handle("update:install", () => updater.install());

// ---------------------------------------------------------------- app

Menu.setApplicationMenu(null);
app.whenReady().then(() => {
  // The viewers' files come from the disk as they are; only the workbench's own session has this.
  protocol.handle("moon-file", (request) => {
    const url = new URL(request.url);
    const file = decodeURIComponent(url.pathname.replace(/^\//, ""));
    // Only the range goes on (sound and video seek with it); other headers trip file:// up.
    const range = request.headers.get("range");
    return net.fetch(pathToFileURL(file).toString(), range ? { headers: { Range: range } } : {});
  });
  createWindow();
  attachments.pruneAttachments(ATTACHMENTS);
  // A quiet look for a new version a little after the start (Settings → Updates can switch it off).
  if (settings.get().autoUpdateCheck !== false) setTimeout(() => void updater.check(), 8000);
});
app.on("window-all-closed", () => {
  chats.stopAll();
  terminals.killAll();
  app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
