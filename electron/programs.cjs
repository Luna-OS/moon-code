"use strict";
// Finds a command-line program the way a terminal would: on the PATH (with Windows' PATHEXT),
// then in the places its installers use. An app started from the Start menu may not see the same
// PATH as the user's terminal, hence the second list.
const fs = require("fs");
const path = require("path");

/**
 * The full path of `name` – the `configured` one first, then the PATH, then `extra` – or null.
 * `extra` holds full paths of the program.
 */
function findProgram(
  name,
  { configured = null, extra = [], env = process.env, platform = process.platform } = {},
) {
  const candidates = [];
  if (configured) candidates.push(configured);
  const exts = platform === "win32" ? (env.PATHEXT || ".EXE;.CMD").toLowerCase().split(";") : [""];
  const sep = platform === "win32" ? ";" : path.delimiter;
  for (const dir of (env.PATH || env.Path || "").split(sep)) {
    if (!dir) continue;
    for (const ext of exts) candidates.push(path.join(dir, `${name}${ext}`));
  }
  candidates.push(...extra);
  for (const c of candidates) {
    try {
      if (fs.statSync(c).isFile()) return c;
    } catch {
      // not here
    }
  }
  return null;
}

module.exports = { findProgram };
