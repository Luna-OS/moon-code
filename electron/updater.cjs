"use strict";
// Updates from Moon Code's GitHub releases (electron-updater, "github" provider): the release
// workflow publishes latest.yml next to the installer, Moon Code compares it with its own version,
// downloads the new installer in the background when asked and installs it on a restart – no
// download page, no clicking through the installer again.
//
// The state the UI sees (update:state / the update:status event):
//   { state: "idle" | "checking" | "available" | "none" | "downloading" | "ready" | "error"
//            | "unsupported",
//     current, version?, notes?, percent?, error?, checkedAt? }

/** The release notes of an update as plain text (electron-updater gives HTML or a list). */
function notesText(notes) {
  if (!notes) return "";
  const text = Array.isArray(notes) ? notes.map((n) => n.note || "").join("\n\n") : String(notes);
  return text
    .replace(/<\/(p|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * The updater around an electron-updater `autoUpdater` (injected, so the tests use a fake).
 * `send(state)` gets every change; `packaged` is false in development, where there is nothing to
 * update.
 */
function createUpdater({ autoUpdater, currentVersion, packaged, send, now = Date.now }) {
  let status = packaged
    ? { state: "idle", current: currentVersion }
    : {
        state: "unsupported",
        current: currentVersion,
        error: "Updates work in the installed app.",
      };
  const set = (patch) => {
    status = { current: currentVersion, ...patch };
    send(status);
  };

  if (packaged && autoUpdater) {
    autoUpdater.autoDownload = false;
    // A downloaded update is installed on the next quit even without "Restart and update".
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on("checking-for-update", () => set({ state: "checking" }));
    autoUpdater.on("update-available", (info) =>
      set({
        state: "available",
        version: info.version,
        notes: notesText(info.releaseNotes),
        checkedAt: now(),
      }),
    );
    autoUpdater.on("update-not-available", () => set({ state: "none", checkedAt: now() }));
    autoUpdater.on("download-progress", (p) =>
      set({ ...status, state: "downloading", percent: Math.round(p.percent || 0) }),
    );
    autoUpdater.on("update-downloaded", (info) =>
      set({ ...status, state: "ready", version: info.version, percent: 100 }),
    );
    autoUpdater.on("error", (err) =>
      set({ ...status, state: "error", error: (err && err.message) || String(err) }),
    );
  }

  return {
    get: () => status,
    async check() {
      if (status.state === "unsupported") return status;
      if (status.state === "downloading" || status.state === "ready") return status;
      try {
        await autoUpdater.checkForUpdates();
      } catch (err) {
        set({ state: "error", error: (err && err.message) || String(err) });
      }
      return status;
    },
    async download() {
      if (status.state !== "available" && status.state !== "error") return status;
      set({ ...status, state: "downloading", percent: 0, error: undefined });
      try {
        await autoUpdater.downloadUpdate();
      } catch (err) {
        set({ ...status, state: "error", error: (err && err.message) || String(err) });
      }
      return status;
    },
    install() {
      if (status.state !== "ready") return false;
      // Quietly, and start the new version afterwards.
      autoUpdater.quitAndInstall(true, true);
      return true;
    },
  };
}

module.exports = { createUpdater, notesText };
