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

/**
 * A repository's files as a .tar.gz (no git needed): GitHub's public archive first, then – for a
 * private repository – through the signed-in GitHub CLI.
 */
async function downloadTarball(owner, repo, fetchImpl) {
  const res = await fetchImpl(`https://api.github.com/repos/${owner}/${repo}/tarball`, {
    headers: { "User-Agent": "Moon-Code", Accept: "application/vnd.github+json" },
  });
  if (res.ok) return Buffer.from(await res.arrayBuffer());
  const gh = findGh();
  if (gh && (res.status === 404 || res.status === 403)) {
    const viaCli = await new Promise((resolve) => {
      const child = spawn(gh, ["api", `repos/${owner}/${repo}/tarball`], { windowsHide: true });
      const chunks = [];
      child.stdout.on("data", (d) => chunks.push(d));
      child.on("error", () => resolve(null));
      child.on("close", (code) => resolve(code === 0 ? Buffer.concat(chunks) : null));
    });
    if (viaCli && viaCli.length) return viaCli;
  }
  throw new Error(
    res.status === 404
      ? `${owner}/${repo} wasn't found. If it is private, sign in to GitHub in Moon Code first.`
      : `GitHub didn't hand out ${owner}/${repo} (${res.status}).`,
  );
}

/** "passing", "failing", "pending" or "none", from `gh pr list`'s statusCheckRollup. */
function checksOf(rollup) {
  const list = Array.isArray(rollup) ? rollup : [];
  if (!list.length) return "none";
  const states = list.map((c) => String(c.conclusion || c.state || c.status || "").toUpperCase());
  if (
    states.some((s) =>
      ["FAILURE", "ERROR", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED"].includes(s),
    )
  ) {
    return "failing";
  }
  if (
    states.some((s) => ["", "PENDING", "QUEUED", "IN_PROGRESS", "EXPECTED", "WAITING"].includes(s))
  ) {
    return "pending";
  }
  return "passing";
}

/** A pull request as the Cloud view shows it, from `gh pr list --json …`. */
function normalizePull(p) {
  return {
    number: p.number,
    title: p.title || "",
    branch: p.headRefName || "",
    url: p.url || "",
    draft: Boolean(p.isDraft),
    mergeable: p.mergeable === "MERGEABLE" ? true : p.mergeable === "CONFLICTING" ? false : null,
    checks: checksOf(p.statusCheckRollup),
    updated: p.updatedAt ? Date.parse(p.updatedAt) || 0 : 0,
  };
}

const REPO = /^[\w.-]+\/[\w.-]+$/;

/** The open pull requests Claude made in `repo` (its branches start with "claude/"). */
async function claudePulls(repo) {
  if (!REPO.test(String(repo))) throw new Error("That isn't a repository (owner/name).");
  const gh = findGh();
  if (!gh) return [];
  const out = await run(gh, [
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--limit",
    "50",
    "--json",
    "number,title,headRefName,url,isDraft,mergeable,statusCheckRollup,updatedAt",
  ]);
  return JSON.parse(out || "[]")
    .filter((p) => String(p.headRefName || "").startsWith("claude/"))
    .map(normalizePull)
    .sort((a, b) => b.updated - a.updated);
}

/** Merges a pull request (a draft is marked ready first) with a merge commit. */
async function mergePull(repo, number, draft) {
  if (!REPO.test(String(repo)) || !Number.isInteger(number)) {
    throw new Error("That isn't a pull request.");
  }
  const gh = findGh();
  if (!gh) throw new Error("The GitHub CLI isn't installed.");
  try {
    if (draft) await run(gh, ["pr", "ready", String(number), "--repo", repo]);
    await run(gh, ["pr", "merge", String(number), "--repo", repo, "--merge"]);
  } catch (err) {
    throw new Error(
      String(err.stderr || err.message)
        .trim()
        .split("\n")
        .pop(),
    );
  }
}

module.exports = {
  listRepos,
  clone,
  normalizeRepo,
  account,
  parseUser,
  findGh,
  downloadTarball,
  claudePulls,
  mergePull,
  normalizePull,
  checksOf,
};
