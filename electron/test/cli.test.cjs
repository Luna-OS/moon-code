"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { chatArgs, userMessageLine, cmdQuote } = require("../claude/cli.cjs");

test("a chat streams JSON both ways", () => {
  assert.deepEqual(chatArgs(), [
    "-p",
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
  ]);
});

test("model, permission mode, resume and allowed tools", () => {
  const args = chatArgs({
    model: "claude-opus-5-5",
    permissionMode: "acceptEdits",
    resume: "abc",
    allowedTools: ["Bash(git status)", "WebFetch"],
  });
  assert.deepEqual(args.slice(7), [
    "--model",
    "claude-opus-5-5",
    "--permission-mode",
    "acceptEdits",
    "--resume",
    "abc",
    "--allowedTools",
    "Bash(git status),WebFetch",
  ]);
});

test("an unknown permission mode is left out", () => {
  assert.ok(!chatArgs({ permissionMode: "whatever" }).includes("--permission-mode"));
});

test("a user message is one JSON line", () => {
  const line = userMessageLine('Say "hi"\nplease');
  assert.ok(line.endsWith("\n"));
  assert.equal(line.split("\n").length, 2);
  assert.deepEqual(JSON.parse(line), {
    type: "user",
    message: { role: "user", content: 'Say "hi"\nplease' },
  });
});

test("cmd.exe quoting", () => {
  assert.equal(cmdQuote("--model"), "--model");
  assert.equal(cmdQuote(""), '""');
  assert.equal(cmdQuote("Bash(git *)"), '"Bash(git *)"');
  assert.equal(cmdQuote('a"b'), '"a""b"');
});
