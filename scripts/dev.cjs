"use strict";
// npm run app:dev – the Vite dev server with hot reload, and Electron on top of it.
const { spawn } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const bin = (name) =>
  path.join(root, "node_modules", ".bin", process.platform === "win32" ? `${name}.cmd` : name);
const URL = "http://localhost:1420";

const vite = spawn(bin("vite"), [], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});

async function waitForVite() {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(URL);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("The Vite dev server didn't start.");
}

waitForVite()
  .then(() => {
    const electron = spawn(bin("electron"), ["."], {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, MOON_DEV_URL: URL },
    });
    electron.on("close", (code) => {
      vite.kill();
      process.exit(code ?? 0);
    });
  })
  .catch((err) => {
    console.error(err.message);
    vite.kill();
    process.exit(1);
  });
