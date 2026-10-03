"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { shellFor } = require("../terminal.cjs");

test("a command runs in PowerShell, quoted, and the shell stays open", () => {
  const { args } = shellFor(["claude", "auth", "login"], "win32");
  assert.deepEqual(args, ["-NoLogo", "-NoExit", "-Command", "& claude auth login"]);
  assert.equal(shellFor(["echo", "it's here"], "win32").args[3], "& echo 'it''s here'");
});

test("a command runs in a POSIX login shell, which then stays", () => {
  const { file, args } = shellFor(["echo", "it's"], "linux");
  assert.equal(args[2], `echo 'it'\\''s'; exec ${file} -l`);
});

test("a line of shell code is passed as it is", () => {
  const line = "irm https://claude.ai/install.ps1 | iex";
  assert.equal(shellFor(line, "win32").args[3], line);
});
