"use strict";
// Who is signed in to Claude Code: `claude auth status --json`, completed with what
// ~/.claude.json remembers about the account (its e-mail and organisation). Moon Code never reads
// or stores the login's tokens.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { runClaude } = require("./cli.cjs");

const pick = (obj, ...keys) => {
  for (const k of keys) if (obj && obj[k] != null && obj[k] !== "") return obj[k];
  return null;
};

/** The account fields of `claude auth status --json` and ~/.claude.json's oauthAccount. */
function parseAccount(status, config) {
  const s = status && typeof status === "object" ? status : {};
  const oauth = (config && config.oauthAccount) || {};
  return {
    loggedIn: Boolean(s.loggedIn),
    authMethod: pick(s, "authMethod") || null,
    email: pick(s, "email", "emailAddress") || pick(oauth, "emailAddress") || null,
    organization: pick(s, "orgName", "organizationName") || pick(oauth, "organizationName") || null,
    plan: pick(s, "subscriptionType", "plan", "subscription") || null,
    projectsDirectory: pick(s, "projectsDirectory") || null,
    configDirectory: pick(s, "configDirectory") || null,
  };
}

function claudeHome() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
}

/** ~/.claude.json (Claude Code's global settings and project list), or {}. */
function readGlobalConfig() {
  const candidates = [
    process.env.CLAUDE_CONFIG_DIR && path.join(process.env.CLAUDE_CONFIG_DIR, ".claude.json"),
    path.join(os.homedir(), ".claude.json"),
  ].filter(Boolean);
  for (const file of candidates) {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      // try the next one
    }
  }
  return {};
}

/** { installed, exe, version, ...account } for the status bar and the Claude panel. */
async function accountStatus(exe) {
  if (!exe) return { installed: false, exe: null, version: null, ...parseAccount(null, null) };
  let version = null;
  try {
    const v = await runClaude(exe, ["--version"], { timeoutMs: 10_000 });
    version = (/(\d+\.\d+\.\d+)/.exec(v.stdout) || [])[1] || null;
  } catch {
    return { installed: false, exe, version: null, ...parseAccount(null, null) };
  }
  let status = null;
  try {
    const res = await runClaude(exe, ["auth", "status", "--json"], { timeoutMs: 15_000 });
    status = JSON.parse(res.stdout);
  } catch {
    status = null;
  }
  return { installed: true, exe, version, ...parseAccount(status, readGlobalConfig()) };
}

module.exports = { accountStatus, parseAccount, readGlobalConfig, claudeHome };
