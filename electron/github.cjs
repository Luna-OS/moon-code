"use strict";
// The GitHub repositories next to the local Claude projects: the ones of the signed-in GitHub CLI
// (`gh`) when it is there, else the public repositories of the configured owner. A repository can
// be cloned into the projects folder and opened.
const fs = require("fs");
const path = require("path");
const { execFile, spawn } = require("child_process");

function run(file, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout: 30_000, windowsHide: true, ...opts }, (err, stdout, stderr) =>
      err ? reject(Object.assign(err, { stderr })) : resolve(stdout),
    );
  });
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
  try {
    const out = await run("gh", [
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

module.exports = { listRepos, clone, normalizeRepo };
