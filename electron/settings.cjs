"use strict";
// Moon Code's settings, a JSON file in the app's data folder. Values the UI doesn't know are kept.
const fs = require("fs");
const os = require("os");
const path = require("path");

const DEFAULTS = {
  theme: "dark",
  /** The last folder that was open, reopened on start. */
  lastFolder: null,
  /** Recently opened folders, newest first. */
  recent: [],
  /** Where cloned repositories go. */
  projectsFolder: path.join(os.homedir(), "Moon Code Projects"),
  /** Whose repositories the Projects view lists when the GitHub CLI isn't signed in. */
  githubOwner: "Luna-OS",
  /** A `claude` to use instead of the one on the PATH. */
  claudePath: null,
  /** The Claude panel's choices. */
  claudeModel: null,
  claudePermissionMode: "acceptEdits",
  claudeEffort: null,
  /** The last known plan limits, so they show before the first message. */
  lastRateLimit: null,
  /** The cloud tasks started from Moon Code, newest first. */
  cloudTasks: [],
  /** Show Axo, the axolotl, in the Claude panel. */
  mascot: true,
  fontSize: 14,
  wordWrap: false,
  minimap: true,
};

class Settings {
  constructor(file) {
    this.file = file;
    this.values = { ...DEFAULTS };
    try {
      Object.assign(this.values, JSON.parse(fs.readFileSync(file, "utf8")));
    } catch {
      // first start or a broken file: the defaults
    }
  }

  get() {
    return { ...this.values };
  }

  set(patch) {
    Object.assign(this.values, patch || {});
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.values, null, 2));
    } catch {
      // read-only data folder: keep the values for this run
    }
    return this.get();
  }

  /** Puts `folder` first in the recent list (at most 12). */
  addRecent(folder) {
    const recent = [folder, ...this.values.recent.filter((f) => f !== folder)].slice(0, 12);
    return this.set({ recent, lastFolder: folder });
  }
}

module.exports = { Settings, DEFAULTS };
