"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isClaudeWeb,
  popupTarget,
  cleanUserAgent,
  sessionRef,
  createSessionScanner,
} = require("../cloud.cjs");

const ID = "session_01Jt1DbydCdQW8P3YacS1hBz";

test("only claude.ai pages start in the webview", () => {
  assert.equal(isClaudeWeb("https://claude.ai/code"), true);
  assert.equal(isClaudeWeb(`https://claude.ai/code/${ID}`), true);
  assert.equal(isClaudeWeb("http://claude.ai/code"), false);
  assert.equal(isClaudeWeb("https://claude.ai.example.com/code"), false);
  assert.equal(isClaudeWeb("https://example.com/?u=https://claude.ai"), false);
  assert.equal(isClaudeWeb("not a url"), false);
});

test("sign-in windows stay in Moon Code, other links go to the browser", () => {
  assert.equal(popupTarget("https://accounts.google.com/o/oauth2/auth?x=1"), "app");
  assert.equal(popupTarget("https://claude.ai/login"), "app");
  assert.equal(popupTarget("https://github.com/login/oauth/authorize?client_id=1"), "app");
  assert.equal(popupTarget("https://github.com/apps/claude/installations/new"), "app");
  assert.equal(popupTarget("https://github.com/Luna-OS/moon-code/pull/4"), "external");
  assert.equal(popupTarget("https://code.claude.com/docs"), "external");
  assert.equal(popupTarget("file:///etc/passwd"), "deny");
});

test("the user agent loses Electron's and Moon Code's tokens", () => {
  const ua =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
    "moon-code/0.3.0 Chrome/146.0.7680.0 Electron/44.5.1 Safari/537.36";
  assert.equal(
    cleanUserAgent(ua),
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/146.0.7680.0 Safari/537.36",
  );
});

test("a session is found by its ID or its link", () => {
  assert.equal(sessionRef(ID), ID);
  assert.equal(sessionRef(`  https://claude.ai/code/${ID}  `), ID);
  assert.equal(sessionRef(`claude.ai/code/${ID}?tab=diff`), ID);
  assert.equal(sessionRef("cse_abc123XYZ"), "cse_abc123XYZ");
  assert.equal(sessionRef("https://claude.ai/code"), null);
  assert.equal(sessionRef("session_; rm -rf /"), null);
  assert.equal(sessionRef(""), null);
});

test("the scanner finds the link claude --cloud prints, once", () => {
  const found = [];
  const s = createSessionScanner((tid, sess) => found.push([tid, sess.id, sess.url]));
  s.push("t1", "\x1b[1mCloud session\x1b[22m\r\n\x1b[2mOpen in browser: \x1b[22m\x1b[36mhttps://");
  s.push("t1", `claude.ai/code/${ID.slice(0, 12)}`);
  assert.deepEqual(found, []);
  s.push("t1", `${ID.slice(12)}\x1b[39m\r\n`);
  // The same frame drawn again.
  s.push("t1", `\x1b[2K\x1b[1AOpen in browser: \x1b[36mhttps://claude.ai/code/${ID}\x1b[39m\r\n`);
  assert.deepEqual(found, [["t1", ID, `https://claude.ai/code/${ID}`]]);
});

test("the scanner reads OSC 8 links and keeps terminals apart", () => {
  const found = [];
  const s = createSessionScanner((tid, sess) => found.push([tid, sess.id]));
  s.push("t2", `\x1b]8;;https://claude.ai/code/cse_9fXk2PqLmN\x07View\x1b]8;;\x07`);
  s.push("t3", `see https://claude.ai/code/${ID} now`);
  assert.deepEqual(found, [
    ["t2", "cse_9fXk2PqLmN"],
    ["t3", ID],
  ]);
  s.forget("t3");
  s.push("t3", `again https://claude.ai/code/${ID}\n`);
  assert.equal(found.length, 3);
});
