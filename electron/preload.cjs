"use strict";
// The bridge between the UI and the main process. Its shape is the MoonCodeBridge type in
// src/lib/types.ts. Every call resolves to an envelope { __envelope, ok, data | error, code }, and
// src/lib/bridge.ts turns a failed one back into an Error with its code.
const { contextBridge, ipcRenderer } = require("electron");

async function call(channel, ...args) {
  const res = await ipcRenderer.invoke(channel, ...args);
  return { __envelope: true, ...res };
}

const EVENTS = new Set([
  "terminal:data",
  "terminal:exit",
  "claude:event",
  "update:status",
  "cloud:session",
  "cloud:open",
]);

contextBridge.exposeInMainWorld("moonCode", {
  kind: "electron",
  info: () => call("sys:info"),
  getSettings: () => call("settings:get"),
  setSettings: (patch) => call("settings:set", patch),
  setTheme: (theme) => call("win:setTheme", theme),
  setTitle: (title) => call("win:setTitle", title),
  devtools: () => call("win:devtools"),
  openExternal: (url) => call("shell:openExternal", url),
  showInFolder: (p) => call("shell:show", p),

  pickFolder: () => call("dialog:pickFolder"),
  folderOpened: (folder) => call("folder:opened", folder),
  readDir: (dir) => call("fs:readDir", dir),
  readFile: (file) => call("fs:readFile", file),
  writeFile: (file, content) => call("fs:writeFile", file, content),
  createFile: (file) => call("fs:createFile", file),
  createFolder: (dir) => call("fs:createFolder", dir),
  rename: (from, to) => call("fs:rename", from, to),
  trash: (p) => call("fs:trash", p),
  listFiles: (root) => call("fs:listFiles", root),
  search: (root, opts) => call("fs:search", root, opts),
  gitBranch: (root) => call("git:branch", root),
  gitHubRepo: (root) => call("git:githubRepo", root),

  terminalStart: (id, opts) => call("terminal:start", id, opts),
  terminalWrite: (id, data) => call("terminal:write", id, data),
  terminalResize: (id, cols, rows) => call("terminal:resize", id, cols, rows),
  terminalKill: (id) => call("terminal:kill", id),

  claudeStatus: () => call("claude:status"),
  claudeProjects: () => call("claude:projects"),
  claudeSessions: (projectPath) => call("claude:sessions", projectPath),
  claudeLogout: () => call("claude:logout"),
  claudeStart: (chatId, opts) => call("claude:start", chatId, opts),
  claudeSend: (chatId, text) => call("claude:send", chatId, text),
  claudeStop: (chatId) => call("claude:stop", chatId),
  claudeCheckLimits: () => call("claude:checkLimits"),
  claudeUsage: () => call("claude:usage"),

  cloudSend: (ref, message) => call("cloud:send", ref, message),

  skillsList: (project) => call("skills:list", project),
  skillsCreate: (opts) => call("skills:create", opts),
  skillsInstall: (repo) => call("skills:install", repo),
  skillsRemove: (dir, project) => call("skills:remove", dir, project),

  githubAccount: () => call("github:account"),
  githubRepos: () => call("github:repos"),
  githubClone: (cloneUrl, name) => call("github:clone", cloneUrl, name),

  updateState: () => call("update:state"),
  updateCheck: () => call("update:check"),
  updateDownload: () => call("update:download"),
  updateInstall: () => call("update:install"),

  on(channel, fn) {
    if (!EVENTS.has(channel)) throw new Error(`Unknown event ${channel}`);
    const listener = (_e, data) => fn(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
});
