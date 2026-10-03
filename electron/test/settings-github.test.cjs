"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Settings } = require("../settings.cjs");
const { normalizeRepo } = require("../github.cjs");
const { parseAccount } = require("../claude/account.cjs");

test("settings keep their values and the recent folders", () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "moon-set-")), "settings.json");
  const s = new Settings(file);
  assert.equal(s.get().theme, "dark");
  s.set({ theme: "light" });
  s.addRecent("/a");
  s.addRecent("/b");
  s.addRecent("/a");
  const again = new Settings(file).get();
  assert.equal(again.theme, "light");
  assert.deepEqual(again.recent, ["/a", "/b"]);
  assert.equal(again.lastFolder, "/a");
});

test("repositories from gh and from the GitHub API look the same", () => {
  const fromGh = normalizeRepo({
    name: "Moon-Zip",
    nameWithOwner: "Luna-OS/Moon-Zip",
    url: "https://github.com/Luna-OS/Moon-Zip",
    pushedAt: "2026-10-03T21:54:44Z",
    visibility: "PUBLIC",
    primaryLanguage: { name: "TypeScript" },
  });
  const fromApi = normalizeRepo({
    name: "Moon-Zip",
    full_name: "Luna-OS/Moon-Zip",
    html_url: "https://github.com/Luna-OS/Moon-Zip",
    clone_url: "https://github.com/Luna-OS/Moon-Zip.git",
    pushed_at: "2026-10-03T21:54:44Z",
    private: false,
    language: "TypeScript",
  });
  assert.deepEqual(fromGh, fromApi);
});

test("the account from auth status and ~/.claude.json", () => {
  const a = parseAccount(
    { loggedIn: true, authMethod: "claude.ai", subscriptionType: "max" },
    { oauthAccount: { emailAddress: "luna@example.com", organizationName: "Luna" } },
  );
  assert.equal(a.loggedIn, true);
  assert.equal(a.email, "luna@example.com");
  assert.equal(a.plan, "max");
  assert.equal(a.organization, "Luna");
  assert.equal(parseAccount(null, null).loggedIn, false);
});
