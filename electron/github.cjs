"use strict";
// GitHub through the official GitHub CLI (`gh`): who is signed in (gh keeps the login; Moon Code
// never sees its token), the repositories next to the local Claude projects – the signed-in
// account's, else the public ones of the configured owner – and cloning one into the projects
// folder.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile, spawn } = require("child_process");
const { findProgram } = require("./programs.cjs");

/** Where the GitHub CLI installers put `gh`, besides the PATH. */
function ghLocations(env = process.env) {
  if (process.platform === "win32") {
    return [
      path.join(env.ProgramFiles || "C:\\Program Files", "GitHub CLI", "gh.exe"),
      path.join(
        env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
        "Programs",
        "GitHub CLI",
        "gh.exe",
      ),
    ];
  }
  return ["/usr/local/bin/gh", "/opt/homebrew/bin/gh", "/usr/bin/gh"];
}

/** The full path of `gh`, or null when the GitHub CLI isn't installed. */
const findGh = (env = process.env) => findProgram("gh", { extra: ghLocations(env), env });

function run(file, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout: 30_000, windowsHide: true, ...opts }, (err, stdout, stderr) =>
      err ? reject(Object.assign(err, { stderr })) : resolve(stdout),
    );
  });
}

/** The account fields the UI shows, from `gh api user`. */
function parseUser(u) {
  return {
    login: u.login,
    name: u.name || null,
    url: u.html_url || `https://github.com/${u.login}`,
  };
}

/**
 * { installed, exe, loggedIn, login, name, url, avatar } – `avatar` is a data: URL, fetched here
 * because the page's Content Security Policy keeps remote images out.
 */
async function account(fetchImpl) {
  const exe = findGh();
  const none = {
    installed: Boolean(exe),
    exe,
    loggedIn: false,
    login: null,
    name: null,
    url: null,
    avatar: null,
  };
  if (!exe) return none;
  let user;
  try {
    user = JSON.parse(await run(exe, ["api", "user"], { timeout: 15_000 }));
  } catch {
    return none;
  }
  if (!user || !user.login) return none;
  let avatar = null;
  if (user.avatar_url && fetchImpl) {
    try {
      const res = await fetchImpl(
        `${user.avatar_url}${user.avatar_url.includes("?") ? "&" : "?"}s=64`,
      );
      if (res.ok) {
        const type = res.headers.get("content-type") || "image/png";
        avatar = `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
      }
    } catch {
      // no picture then
    }
  }
  return { ...none, loggedIn: true, ...parseUser(user), avatar };
}

/** One repository in the shape the UI uses. */
function normalizeRepo(r) {
  return {
    name: r.name,
    fullName: r.nameWithOwner || r.full_name || r.name,
    description: r.description || "",
    url: r.url || r.html_url,
    cloneUrl: r.clone_url || `${r.url || r.html_url}.git`,
    updated: Date.parse(r.pushedAt || r.updatedAt || r.pushed_at || r.updated_at || "") || 0,
    private: r.visibility ? r.visibility.toLowerCase() === "private" : Boolean(r.private),
    language: (r.primaryLanguage && r.primaryLanguage.name) || r.language || null,
  };
}

/** The repositories of `owner` via `gh` (private ones too), or null when gh can't. */
async function viaGh(owner) {
  const gh = findGh();
  if (!gh) return null;
  try {
    const out = await run(gh, [
      "repo",
      "list",
      ...(owner ? [owner] : []),
      "--limit",
      "200",
      "--json",
      "name,nameWithOwner,description,url,pushedAt,visibility,primaryLanguage",
    ]);
    return JSON.parse(out).map(normalizeRepo);
  } catch {
    return null;
  }
}

/** The public repositories of `owner` from the GitHub API (a user or an organisation). */
async function viaApi(owner, fetchImpl) {
  const url = `https://api.github.com/users/${encodeURIComponent(owner)}/repos?per_page=100&sort=pushed`;
  const res = await fetchImpl(url, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "Moon-Code" },
  });
  if (!res.ok) throw new Error(`GitHub answered ${res.status}.`);
  return (await res.json()).map(normalizeRepo);
}

/** { source: "gh" | "api", repos } sorted by the last push. */
async function listRepos(owner, fetchImpl) {
  let repos = await viaGh(owner);
  let source = "gh";
  if (!repos) {
    if (!owner) return { source: "none", repos: [] };
    repos = await viaApi(owner, fetchImpl);
    source = "api";
  }
  repos.sort((a, b) => b.updated - a.updated);
  return { source, repos };
}

/** Clones `cloneUrl` into `parent/<name>` (or returns it when it is there already). */
function clone(cloneUrl, parent, name) {
  const target = path.join(parent, name);
  if (fs.existsSync(path.join(target, ".git"))) return Promise.resolve(target);
  fs.mkdirSync(parent, { recursive: true });
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["clone", "--", cloneUrl, target], { windowsHide: true });
    let err = "";
    child.stderr.on("data", (d) => (err = (err + d).slice(-2000)));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(target) : reject(new Error(err.trim() || `git clone failed (${code}).`)),
    );
  });
}

module.exports = { listRepos, clone, normalizeRepo, account, parseUser, findGh };
