"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createUpdater, notesText } = require("../updater.cjs");

/** An autoUpdater that behaves like electron-updater's, driven by the test. */
function fakeAutoUpdater(script) {
  const u = new EventEmitter();
  u.calls = [];
  u.checkForUpdates = async () => {
    u.calls.push("check");
    u.emit("checking-for-update");
    script.check(u);
  };
  u.downloadUpdate = async () => {
    u.calls.push("download");
    u.emit("download-progress", { percent: 41.6 });
    u.emit("update-downloaded", { version: script.version });
  };
  u.quitAndInstall = (silent, runAfter) => u.calls.push(`install:${silent}:${runAfter}`);
  return u;
}

test("a new version: check, download, restart", async () => {
  const sent = [];
  const autoUpdater = fakeAutoUpdater({
    version: "0.2.0",
    check: (u) =>
      u.emit("update-available", { version: "0.2.0", releaseNotes: "<p>Faster &amp; nicer</p>" }),
  });
  const up = createUpdater({
    autoUpdater,
    currentVersion: "0.1.0",
    packaged: true,
    send: (s) => sent.push(s),
    now: () => 5,
  });
  assert.equal(autoUpdater.autoDownload, false);
  assert.equal(up.install(), false);

  let s = await up.check();
  assert.deepEqual(s, {
    current: "0.1.0",
    state: "available",
    version: "0.2.0",
    notes: "Faster & nicer",
    checkedAt: 5,
  });

  s = await up.download();
  assert.equal(s.state, "ready");
  assert.ok(sent.some((x) => x.state === "downloading" && x.percent === 42));

  assert.equal(up.install(), true);
  assert.deepEqual(autoUpdater.calls, ["check", "download", "install:true:true"]);
});

test("up to date", async () => {
  const autoUpdater = fakeAutoUpdater({ check: (u) => u.emit("update-not-available", {}) });
  const up = createUpdater({
    autoUpdater,
    currentVersion: "0.2.0",
    packaged: true,
    send: () => {},
    now: () => 9,
  });
  assert.deepEqual(await up.check(), { current: "0.2.0", state: "none", checkedAt: 9 });
});

test("errors are reported, not thrown", async () => {
  const autoUpdater = fakeAutoUpdater({ check: () => {} });
  autoUpdater.checkForUpdates = async () => {
    throw new Error("net::ERR_INTERNET_DISCONNECTED");
  };
  const up = createUpdater({
    autoUpdater,
    currentVersion: "0.1.0",
    packaged: true,
    send: () => {},
  });
  const s = await up.check();
  assert.equal(s.state, "error");
  assert.match(s.error, /DISCONNECTED/);
});

test("in development there is nothing to update", async () => {
  const up = createUpdater({
    autoUpdater: null,
    currentVersion: "0.1.0",
    packaged: false,
    send: () => {},
  });
  assert.equal((await up.check()).state, "unsupported");
  assert.equal(up.install(), false);
});

test("release notes as text", () => {
  assert.equal(notesText("<h2>New</h2><ul><li>One</li><li>Two</li></ul>"), "New\nOne\nTwo");
  assert.equal(notesText([{ note: "a" }, { note: "b" }]), "a\n\nb");
  assert.equal(notesText(null), "");
});
