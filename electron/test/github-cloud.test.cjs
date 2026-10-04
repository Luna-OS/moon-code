"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { parseGitHubRemote } = require("../workspace.cjs");
const { parseUser } = require("../github.cjs");
const { findProgram } = require("../programs.cjs");

test("GitHub remotes in every form, and only GitHub", () => {
  assert.equal(
    parseGitHubRemote("https://github.com/Luna-OS/moon-code.git\n"),
    "Luna-OS/moon-code",
  );
  assert.equal(parseGitHubRemote("https://github.com/Luna-OS/moon-code"), "Luna-OS/moon-code");
  assert.equal(
    parseGitHubRemote("https://token@github.com/Luna-OS/Moon.Zip.git"),
    "Luna-OS/Moon.Zip",
  );
  assert.equal(parseGitHubRemote("git@github.com:Luna-OS/moon-code.git"), "Luna-OS/moon-code");
  assert.equal(
    parseGitHubRemote("ssh://git@github.com/Luna-OS/moon-code.git"),
    "Luna-OS/moon-code",
  );
  assert.equal(parseGitHubRemote("https://gitlab.com/luna/moon-code.git"), null);
  assert.equal(parseGitHubRemote(""), null);
});

test("the GitHub account from gh api user", () => {
  assert.deepEqual(
    parseUser({ login: "Luna-OS", name: "Luna", html_url: "https://github.com/Luna-OS" }),
    {
      login: "Luna-OS",
      name: "Luna",
      url: "https://github.com/Luna-OS",
    },
  );
  assert.deepEqual(parseUser({ login: "x" }), {
    login: "x",
    name: null,
    url: "https://github.com/x",
  });
});

test("programs are found on the PATH, then in the installers' places", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "moon-bin-"));
  const extra = path.join(dir, "elsewhere", "gh");
  fs.mkdirSync(path.dirname(extra));
  fs.writeFileSync(extra, "");
  const env = { PATH: path.join(dir, "nothing-here") };
  assert.equal(findProgram("gh", { extra: [extra], env, platform: "linux" }), extra);
  const onPath = path.join(dir, "gh");
  fs.writeFileSync(onPath, "");
  assert.equal(
    findProgram("gh", { extra: [extra], env: { PATH: dir }, platform: "linux" }),
    onPath,
  );
  assert.equal(findProgram("nope", { env: { PATH: dir }, platform: "linux" }), null);
});
