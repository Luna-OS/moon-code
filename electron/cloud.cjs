"use strict";
// Claude Code on the web inside Moon Code: the claude.ai/code page runs in a <webview> of the
// workbench (its own persistent session, so the claude.ai sign-in stays), the session links that
// `claude --cloud` prints in a terminal are picked up and open there too.

/** The webview's session: claude.ai's cookies live here, apart from the workbench. */
const CLOUD_PARTITION = "persist:claude-web";

const SESSION_ID = /^(session_|cse_)[A-Za-z0-9]{6,}$/;
const SESSION_URL = /https:\/\/claude\.ai\/code\/((?:session_|cse_)[A-Za-z0-9]{6,})/g;

const hostOf = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
};
const isOrUnder = (host, domain) => host === domain || host.endsWith(`.${domain}`);

/** True for a page of claude.ai (where the webview may start). */
function isClaudeWeb(url) {
  const host = hostOf(url);
  return Boolean(host && isOrUnder(host, "claude.ai"));
}

/**
 * Where a window that claude.ai opens goes: "app" (a small window of Moon Code with the same
 * session – sign-ins and connecting GitHub, which report back to the page) or "external" (the
 * browser: pull requests, docs, everything else).
 */
function popupTarget(url) {
  const host = hostOf(url);
  if (!host) return "deny";
  if (isOrUnder(host, "claude.ai") || isOrUnder(host, "anthropic.com")) return "app";
  if (host === "accounts.google.com" || host === "appleid.apple.com") return "app";
  if (host === "github.com") {
    const path = new URL(url).pathname;
    if (/^\/(login|session|sessions|apps\/[^/]+\/installations)(\/|$)/.test(path)) return "app";
  }
  return "external";
}

/**
 * The user agent for claude.ai without Electron's and Moon Code's own tokens: some sign-in pages
 * (Google's) turn away browsers they don't know.
 */
function cleanUserAgent(ua) {
  return String(ua)
    .replace(/\s(Electron|moon-code|Moon Code|MoonCode)\/\S+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * A session's ID from what the user typed: the bare ID (session_… / cse_…) or its claude.ai/code
 * link, with or without the scheme or a query string. Null for anything else.
 */
function sessionRef(input) {
  const s = String(input || "").trim();
  if (SESSION_ID.test(s)) return s;
  const m =
    /^(?:https?:\/\/)?claude\.ai\/code\/((?:session_|cse_)[A-Za-z0-9]{6,})(?:[/?#].*)?$/.exec(s);
  return m ? m[1] : null;
}

const sessionUrl = (id) => `https://claude.ai/code/${id}`;

// CSI (colours, cursor moves) and other escapes; OSC 8 links are read before they go.
/* eslint-disable no-control-regex */
const OSC8 = /\x1b\]8;[^;\x07\x1b]*;([^\x07\x1b]*)(?:\x07|\x1b\\)/g;
const ANSI = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g;
/* eslint-enable no-control-regex */

/**
 * Watches terminal output for cloud session links (`claude --cloud` prints "Open in browser:
 * https://claude.ai/code/session_…") and calls `onFound(terminalId, {id, url})` once per session
 * and terminal. Output arrives in chunks, so the end of each chunk is kept for the next one.
 */
function createSessionScanner(onFound) {
  const tails = new Map();
  const seen = new Map();
  const found = (tid, id) => {
    const ids = seen.get(tid) || new Set();
    seen.set(tid, ids);
    if (ids.has(id)) return;
    ids.add(id);
    onFound(tid, { id, url: sessionUrl(id) });
  };
  return {
    push(tid, data) {
      const raw = (tails.get(tid) || "") + String(data);
      for (const m of raw.matchAll(OSC8)) {
        const id = sessionRef(m[1]);
        if (id) found(tid, id);
      }
      // Escapes become spaces, so an ID ends where the text around it changes colour or line.
      const text = raw.replace(OSC8, " ").replace(ANSI, " ");
      for (const m of text.matchAll(SESSION_URL)) {
        // An ID at the very end may still go on in the next chunk.
        if (m.index + m[0].length < text.length) found(tid, m[1]);
      }
      // A link already found again in the kept end is skipped (seen).
      tails.set(tid, raw.slice(-300));
    },
    forget(tid) {
      tails.delete(tid);
      seen.delete(tid);
    },
  };
}

module.exports = {
  CLOUD_PARTITION,
  isClaudeWeb,
  popupTarget,
  cleanUserAgent,
  sessionRef,
  sessionUrl,
  createSessionScanner,
};
