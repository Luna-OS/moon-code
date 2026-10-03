"use strict";
// The terminals of the bottom panel: one pseudo console (node-pty) each, so shells and
// `claude auth login` behave as in a real terminal.
const os = require("os");

let pty = null;
function loadPty() {
  if (!pty) pty = require("node-pty");
  return pty;
}

/** The user's shell: PowerShell on Windows, $SHELL elsewhere. */
function defaultShell() {
  if (process.platform === "win32") return { file: "powershell.exe", args: ["-NoLogo"] };
  return { file: process.env.SHELL || "/bin/bash", args: ["-l"] };
}

/**
 * The shell command for `command` run in the user's shell, so it finds the same programs the
 * user's own terminal finds; the shell stays open afterwards. `command` is a list of arguments
 * (["claude", "auth", "login"]), quoted here, or one line of shell code the UI wrote itself (the
 * Claude Code installer's pipe).
 */
function shellFor(command, platform = process.platform) {
  const shell = platform === process.platform ? defaultShell() : { file: "sh", args: [] };
  if (!command || !command.length) return shell;
  if (platform === "win32") {
    const line =
      typeof command === "string"
        ? command
        : `& ${command.map((a) => (/^[\w\-./:\\]+$/.test(a) ? a : `'${a.replace(/'/g, "''")}'`)).join(" ")}`;
    return { file: shell.file, args: ["-NoLogo", "-NoExit", "-Command", line] };
  }
  const line =
    typeof command === "string"
      ? command
      : command
          .map((a) => (/^[\w\-./:]+$/.test(a) ? a : `'${a.replace(/'/g, "'\\''")}'`))
          .join(" ");
  return { file: shell.file, args: ["-l", "-c", `${line}; exec ${shell.file} -l`] };
}

class Terminals {
  /** `emit(channel, payload)` sends terminal:data / terminal:exit to the window. */
  constructor(emit) {
    this.emit = emit;
    this.procs = new Map();
  }

  start(id, { cwd, cols = 80, rows = 24, command } = {}) {
    this.kill(id);
    const { file, args } = shellFor(command);
    const proc = loadPty().spawn(file, args, {
      name: "xterm-256color",
      cols,
      rows,
      cwd: cwd || os.homedir(),
      env: { ...process.env, TERM_PROGRAM: "MoonCode", COLORTERM: "truecolor" },
    });
    this.procs.set(id, proc);
    proc.onData((data) => this.emit("terminal:data", { id, data }));
    proc.onExit(({ exitCode }) => {
      if (this.procs.get(id) === proc) this.procs.delete(id);
      this.emit("terminal:exit", { id, code: exitCode });
    });
  }

  write(id, data) {
    const p = this.procs.get(id);
    if (p) p.write(data);
  }

  resize(id, cols, rows) {
    const p = this.procs.get(id);
    if (p && cols > 0 && rows > 0) {
      try {
        p.resize(cols, rows);
      } catch {
        // the process is gone
      }
    }
  }

  kill(id) {
    const p = this.procs.get(id);
    if (!p) return;
    this.procs.delete(id);
    try {
      p.kill();
    } catch {
      // already gone
    }
  }

  killAll() {
    for (const id of [...this.procs.keys()]) this.kill(id);
  }
}

module.exports = { Terminals, shellFor, defaultShell };
