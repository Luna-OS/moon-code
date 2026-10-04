"use strict";
// One Claude Code process per chat in the Claude panel. It stays alive between messages (stdin
// takes the next one), so a conversation keeps its context; changing the model or the permission
// mode restarts it with --resume on the same session.
const { chatArgs, spawnClaude, userMessageLine } = require("./cli.cjs");
const { createLineParser } = require("./events.cjs");

class ChatManager {
  /** `emit(chatId, event)` gets every event of every chat. */
  constructor(emit) {
    this.emit = emit;
    /** chatId → { child, opts, sessionId } */
    this.chats = new Map();
  }

  /** Starts (or restarts) the process of a chat: { exe, cwd, model, permissionMode, resume, allowedTools, effort }. */
  start(chatId, opts) {
    this.stop(chatId);
    const child = spawnClaude(opts.exe, chatArgs(opts), {
      cwd: opts.cwd,
      env: { ...process.env, CLAUDE_CODE_ENTRYPOINT: "moon-code" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const chat = { child, opts, sessionId: opts.resume || null };
    this.chats.set(chatId, chat);

    // Only the chat's current process speaks; one that was stopped or replaced stays quiet.
    const current = () => this.chats.get(chatId) === chat;
    const parser = createLineParser((ev) => {
      if (ev.kind === "init" && ev.sessionId) chat.sessionId = ev.sessionId;
      if (current()) this.emit(chatId, ev);
    });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (d) => parser.push(d));
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (d) => {
      stderr = (stderr + d).slice(-4000);
    });
    child.on("error", (err) => {
      if (current()) this.emit(chatId, { kind: "error", message: err.message });
    });
    child.on("close", (code) => {
      parser.end();
      if (!current()) return;
      this.chats.delete(chatId);
      this.emit(chatId, { kind: "exit", code, stderr: code ? stderr.trim() : "" });
    });
    // A closed stdin (the process died) must not crash the main process.
    child.stdin.on("error", () => {});
    return { sessionId: chat.sessionId };
  }

  /** Sends one user message; false when the chat has no running process. */
  /** Sends a message: its text, or content blocks (pictures and text). */
  send(chatId, content) {
    const chat = this.chats.get(chatId);
    if (!chat || chat.child.exitCode !== null) return false;
    chat.child.stdin.write(userMessageLine(content));
    return true;
  }

  /** The session id Claude Code gave the chat (to --resume it). */
  sessionOf(chatId) {
    const chat = this.chats.get(chatId);
    return chat ? chat.sessionId : null;
  }

  stop(chatId) {
    const chat = this.chats.get(chatId);
    if (!chat) return;
    this.chats.delete(chatId);
    try {
      chat.child.stdin.end();
    } catch {
      // already closed
    }
    chat.child.kill();
  }

  stopAll() {
    for (const id of [...this.chats.keys()]) this.stop(id);
  }
}

module.exports = { ChatManager };
