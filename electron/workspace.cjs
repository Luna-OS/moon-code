"use strict";
// Files of the open folder: listing, reading, writing, the quick-open list and the text search.
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { execFile } = require("child_process");

/** Folders that are never listed in quick open or searched (they are still shown in the tree). */
const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "release",
  "out",
  ".next",
  "target",
  "__pycache__",
  ".venv",
  "venv",
  "coverage",
]);
const MAX_FILES = 20_000;
const MAX_READ = 5 * 1024 * 1024;
const MAX_SEARCH_FILE = 1024 * 1024;

/** The entries of one folder, folders first, then by name. */
async function readDir(dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  return entries
    .map((e) => ({
      name: e.name,
      path: path.join(dir, e.name),
      isDir: e.isDirectory() || (e.isSymbolicLink() && isDirSync(path.join(dir, e.name))),
    }))
    .sort((a, b) =>
      a.isDir !== b.isDir
        ? a.isDir
          ? -1
          : 1
        : a.name.localeCompare(b.name, undefined, { numeric: true }),
    );
}

function isDirSync(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** True when the first bytes look like a binary file (a NUL byte). */
function looksBinary(buf) {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

/** A text file's content; binary and very large files are refused with a coded error. */
async function readFile(file) {
  const st = await fsp.stat(file);
  if (st.size > MAX_READ) {
    const err = new Error("This file is too large to open in the editor.");
    err.code = "ETOOLARGE";
    throw err;
  }
  const buf = await fsp.readFile(file);
  if (looksBinary(buf)) {
    const err = new Error("This looks like a binary file.");
    err.code = "EBINARY";
    throw err;
  }
  return buf.toString("utf8");
}

async function writeFile(file, content) {
  await fsp.writeFile(file, content, "utf8");
}

async function createFile(file) {
  await fsp.writeFile(file, "", { flag: "wx" });
}

async function createFolder(dir) {
  await fsp.mkdir(dir);
}

async function rename(from, to) {
  try {
    await fsp.access(to);
    const err = new Error(`"${path.basename(to)}" exists already.`);
    err.code = "EEXIST";
    throw err;
  } catch (e) {
    if (e.code === "EEXIST") throw e;
  }
  await fsp.rename(from, to);
}

/** Every file under `root` (relative paths with "/"), skipping SKIP_DIRS, at most MAX_FILES. */
async function listFiles(root) {
  const out = [];
  const walk = async (dir, rel) => {
    if (out.length >= MAX_FILES) return;
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= MAX_FILES) return;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) await walk(path.join(dir, e.name), r);
      } else if (e.isFile()) out.push(r);
    }
  };
  await walk(root, "");
  return out;
}

/** Escapes a string for use in a RegExp. */
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The RegExp a search uses: { query, regex, caseSensitive, wholeWord }. Throws on a bad regex. */
function searchPattern({ query, regex = false, caseSensitive = false, wholeWord = false }) {
  let src = regex ? query : escapeRegExp(query);
  if (wholeWord) src = `\\b${src}\\b`;
  return new RegExp(src, caseSensitive ? "g" : "gi");
}

/**
 * Searches the text files under `root`: [{ file (relative), matches: [{ line, column, text }] }],
 * with at most `limit` matches in all.
 */
async function search(root, opts, limit = 2000) {
  if (!opts.query) return [];
  const pattern = searchPattern(opts);
  const files = await listFiles(root);
  const results = [];
  let total = 0;
  for (const rel of files) {
    if (total >= limit) break;
    const abs = path.join(root, ...rel.split("/"));
    let buf;
    try {
      const st = await fsp.stat(abs);
      if (st.size > MAX_SEARCH_FILE) continue;
      buf = await fsp.readFile(abs);
    } catch {
      continue;
    }
    if (looksBinary(buf)) continue;
    const lines = buf.toString("utf8").split(/\r?\n/);
    const matches = [];
    for (let i = 0; i < lines.length && total < limit; i++) {
      pattern.lastIndex = 0;
      const m = pattern.exec(lines[i]);
      if (m) {
        matches.push({
          line: i + 1,
          column: m.index + 1,
          length: m[0].length,
          text: lines[i].slice(0, 400),
        });
        total++;
      }
    }
    if (matches.length) results.push({ file: rel, matches });
  }
  return results;
}

/** The git branch of the folder, or null. */
function gitBranch(root) {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      { cwd: root, timeout: 5000, windowsHide: true },
      (err, stdout) => resolve(err ? null : stdout.trim() || null),
    );
  });
}

/**
 * "owner/name" of a GitHub remote URL (https, ssh or git@ form), or null for anything else.
 * "https://github.com/Luna-OS/moon-code.git" → "Luna-OS/moon-code".
 */
function parseGitHubRemote(url) {
  const m =
    /^(?:https?:\/\/(?:[^@/]+@)?github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(
      (url || "").trim(),
    );
  return m ? `${m[1]}/${m[2]}` : null;
}

/** The GitHub repository ("owner/name") the folder's `origin` points at, or null. */
function gitHubRepo(root) {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["remote", "get-url", "origin"],
      { cwd: root, timeout: 5000, windowsHide: true },
      (err, stdout) => resolve(err ? null : parseGitHubRemote(stdout)),
    );
  });
}

module.exports = {
  parseGitHubRemote,
  gitHubRepo,
  readDir,
  readFile,
  writeFile,
  createFile,
  createFolder,
  rename,
  listFiles,
  search,
  searchPattern,
  gitBranch,
  looksBinary,
  SKIP_DIRS,
};
