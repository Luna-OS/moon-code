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

test("Claude's pull requests: checks, drafts and conflicts", () => {
  const { normalizePull, checksOf } = require("../github.cjs");
  assert.equal(checksOf([]), "none");
  assert.equal(checksOf([{ conclusion: "SUCCESS" }, { state: "SUCCESS" }]), "passing");
  assert.equal(checksOf([{ conclusion: "SUCCESS" }, { status: "IN_PROGRESS" }]), "pending");
  assert.equal(checksOf([{ conclusion: "FAILURE" }, { status: "IN_PROGRESS" }]), "failing");
  assert.deepEqual(
    normalizePull({
      number: 4,
      title: "Cloud tab",
      headRefName: "claude/cloud-tab",
      url: "https://github.com/Luna-OS/moon-code/pull/4",
      isDraft: true,
      mergeable: "CONFLICTING",
      statusCheckRollup: [{ conclusion: "SUCCESS" }],
      updatedAt: "2026-10-04T03:45:00Z",
    }),
    {
      number: 4,
      title: "Cloud tab",
      branch: "claude/cloud-tab",
      url: "https://github.com/Luna-OS/moon-code/pull/4",
      draft: true,
      mergeable: false,
      checks: "passing",
      updated: Date.UTC(2026, 9, 4, 3, 45),
    },
  );
});
