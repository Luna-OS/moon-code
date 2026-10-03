"use strict";
// The projects Claude Code knows on this computer: every folder it has had a conversation in
// (~/.claude/projects/<folder>/<session>.jsonl) plus the folders ~/.claude.json lists. They show up
// in Moon Code's Projects view as soon as Claude Code is signed in.
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { claudeHome, readGlobalConfig } = require("./account.cjs");

/** How much of a transcript is read to find its folder and first prompt. */
const HEAD_BYTES = 64 * 1024;

async function readHead(file, bytes = HEAD_BYTES) {
  const fh = await fsp.open(file, "r");
  try {
    const buf = Buffer.alloc(bytes);
    const { bytesRead } = await fh.read(buf, 0, bytes, 0);
    return buf.subarray(0, bytesRead).toString("utf8");
  } finally {
    await fh.close();
  }
}

/** The text of a user message's content (a string or a list of blocks), or "". */
function promptText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const t = content.find((b) => b && b.type === "text" && typeof b.text === "string");
  return t ? t.text : "";
}

/**
 * What the start of a transcript tells: { cwd, title, branch }. The title is the session's own
 * title when it has one, else its first prompt (without the tags Claude Code wraps commands in).
 */
function parseTranscriptHead(text) {
  let cwd = null;
  let title = null;
  let firstPrompt = null;
  let branch = null;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue; // the last, cut-off line
    }
    if (!cwd && typeof e.cwd === "string") cwd = e.cwd;
    if (!branch && typeof e.gitBranch === "string" && e.gitBranch) branch = e.gitBranch;
    if (e.type === "custom-title" && e.customTitle) title = e.customTitle;
    if (!title && e.type === "summary" && e.summary) title = e.summary;
    if (!firstPrompt && e.type === "user" && e.message && !e.isMeta) {
      const p = promptText(e.message.content)
        .replace(/<[^>]+>[^<]*<\/[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (p) firstPrompt = p;
    }
  }
  const t = title || firstPrompt;
  return { cwd, branch, title: t ? (t.length > 90 ? `${t.slice(0, 89)}…` : t) : null };
}

async function exists(p) {
  try {
    return (await fsp.stat(p)).isDirectory();
  } catch {
    return false;
  }
}

/** The sessions in one project folder of ~/.claude/projects, newest first. */
async function sessionsIn(dir) {
  let names;
  try {
    names = await fsp.readdir(dir);
  } catch {
    return [];
  }
  const sessions = await Promise.all(
    names
      .filter((n) => n.endsWith(".jsonl"))
      .map(async (n) => {
        const file = path.join(dir, n);
        try {
          const [st, head] = await Promise.all([fsp.stat(file), readHead(file)]);
          const info = parseTranscriptHead(head);
          return { id: n.slice(0, -".jsonl".length), updated: st.mtimeMs, ...info };
        } catch {
          return null;
        }
      }),
  );
  return sessions.filter(Boolean).sort((a, b) => b.updated - a.updated);
}

/**
 * Every project Claude Code knows, newest first:
 * { path, name, lastUsed, sessionCount, branch, exists }.
 */
async function listProjects(home = claudeHome(), config = readGlobalConfig()) {
  const byPath = new Map();
  const root = path.join(home, "projects");
  let dirs = [];
  try {
    dirs = await fsp.readdir(root);
  } catch {
    dirs = [];
  }
  await Promise.all(
    dirs.map(async (d) => {
      const sessions = await sessionsIn(path.join(root, d));
      const withCwd = sessions.find((s) => s.cwd);
      if (!withCwd) return;
      const p = withCwd.cwd;
      const prev = byPath.get(p);
      const lastUsed = sessions[0].updated;
      byPath.set(p, {
        path: p,
        lastUsed: Math.max(lastUsed, prev ? prev.lastUsed : 0),
        sessionCount: sessions.length + (prev ? prev.sessionCount : 0),
        branch: withCwd.branch || (prev && prev.branch) || null,
      });
    }),
  );
  for (const p of Object.keys((config && config.projects) || {})) {
    if (!byPath.has(p)) byPath.set(p, { path: p, lastUsed: 0, sessionCount: 0, branch: null });
  }
  const list = await Promise.all(
    [...byPath.values()].map(async (p) => ({
      ...p,
      name: path.basename(p.path) || p.path,
      exists: await exists(p.path),
    })),
  );
  return list.sort((a, b) => b.lastUsed - a.lastUsed || a.name.localeCompare(b.name));
}

/** The folder name Claude Code keeps a project's transcripts under. */
function projectDirName(p) {
  return p.replace(/[^a-zA-Z0-9]/g, "-");
}

/** The sessions of one project (by its folder), newest first. */
async function listSessions(projectPath, home = claudeHome()) {
  const sessions = await sessionsIn(path.join(home, "projects", projectDirName(projectPath)));
  return sessions.map(({ id, updated, title, branch }) => ({ id, updated, title, branch }));
}

module.exports = { listProjects, listSessions, parseTranscriptHead, projectDirName };
