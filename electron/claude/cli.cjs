"use strict";
// Finds the user's Claude Code CLI and builds its command lines. Moon Code never talks to the
// Claude API itself: it runs the official `claude` program, which signs in, keeps the login and
// counts the plan's limits on its own.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const isWindows = process.platform === "win32";

/** Places the Claude Code installers put `claude`, besides the PATH. */
function knownLocations(home = os.homedir(), env = process.env) {
  const names = isWindows ? ["claude.exe", "claude.cmd"] : ["claude"];
  const dirs = [path.join(home, ".local", "bin"), path.join(home, ".claude", "local")];
  if (isWindows && env.APPDATA) dirs.push(path.join(env.APPDATA, "npm"));
  if (!isWindows) dirs.push("/usr/local/bin", "/opt/homebrew/bin");
  return dirs.flatMap((d) => names.map((n) => path.join(d, n)));
}

/** The full path of `claude` (a configured one first), or null when it isn't installed. */
function findClaude(configured, env = process.env) {
  const candidates = [];
  if (configured) candidates.push(configured);
  const exts = isWindows ? (env.PATHEXT || ".EXE;.CMD").toLowerCase().split(";") : [""];
  for (const dir of (env.PATH || env.Path || "").split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) candidates.push(path.join(dir, `claude${ext}`));
  }
  candidates.push(...knownLocations(os.homedir(), env));
  for (const c of candidates) {
    try {
      if (fs.statSync(c).isFile()) return c;
    } catch {
      // not here
    }
  }
  return null;
}

/** The permission modes Claude Code knows (`--permission-mode`). */
const PERMISSION_MODES = ["default", "acceptEdits", "plan", "bypassPermissions"];

/**
 * The arguments for a chat process that reads user messages from stdin and streams everything
 * back as JSON lines: { model?, permissionMode?, resume?, allowedTools?, effort? }.
 */
function chatArgs(opts = {}) {
  const args = [
    "-p",
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
  ];
  if (opts.model) args.push("--model", String(opts.model));
  if (opts.effort) args.push("--effort", String(opts.effort));
  if (opts.permissionMode && PERMISSION_MODES.includes(opts.permissionMode)) {
    args.push("--permission-mode", opts.permissionMode);
  }
  if (opts.resume) args.push("--resume", String(opts.resume));
  const tools = (opts.allowedTools || []).filter(Boolean);
  if (tools.length) args.push("--allowedTools", tools.join(","));
  return args;
}

/** One user message as Claude Code's stream-json input expects it. */
function userMessageLine(text) {
  return `${JSON.stringify({ type: "user", message: { role: "user", content: text } })}\n`;
}

/** Quotes an argument for cmd.exe (only needed for a claude.cmd shim). */
function cmdQuote(arg) {
  if (/^[\w\-.,:/\\=@]+$/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '""')}"`;
}

/** Starts `claude` with `args`; a .cmd shim goes through cmd.exe, everything else directly. */
function spawnClaude(exe, args, options = {}) {
  if (isWindows && /\.cmd$/i.test(exe)) {
    const line = [exe, ...args].map(cmdQuote).join(" ");
    return spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `"${line}"`], {
      ...options,
      windowsVerbatimArguments: true,
      windowsHide: true,
    });
  }
  return spawn(exe, args, { ...options, windowsHide: true });
}

/** Runs `claude <args>` to the end and resolves to { code, stdout, stderr }. */
function runClaude(exe, args, { timeoutMs = 20_000, cwd } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnClaude(exe, args, { cwd: cwd || os.homedir(), env: process.env });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

module.exports = {
  findClaude,
  knownLocations,
  chatArgs,
  userMessageLine,
  cmdQuote,
  spawnClaude,
  runClaude,
  PERMISSION_MODES,
};
