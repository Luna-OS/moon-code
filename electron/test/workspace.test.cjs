"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const ws = require("../workspace.cjs");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moon-ws-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.mkdirSync(path.join(root, "node_modules", "dep"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "src", "moon.ts"),
    "const moon = 1;\nexport const Moonlight = moon;\n",
  );
  fs.writeFileSync(path.join(root, "README.md"), "# Moon\n");
  fs.writeFileSync(path.join(root, "node_modules", "dep", "index.js"), "moon");
  fs.writeFileSync(path.join(root, "logo.bin"), Buffer.from([0, 1, 2, 109, 111, 111, 110]));
  return root;
}

test("folders first, then names", async () => {
  const root = fixture();
  assert.deepEqual(
    (await ws.readDir(root)).map((e) => [e.name, e.isDir]),
    [
      ["node_modules", true],
      ["src", true],
      ["logo.bin", false],
      ["README.md", false],
    ],
  );
});

test("quick open skips node_modules", async () => {
  const files = (await ws.listFiles(fixture())).sort();
  assert.deepEqual(files, ["README.md", "logo.bin", "src/moon.ts"]);
});

test("search: case, whole word, regex and binary files", async () => {
  const root = fixture();
  const hits = await ws.search(root, { query: "moon" });
  assert.deepEqual(hits.map((h) => [h.file, h.matches.map((m) => m.line)]).sort(), [
    ["README.md", [1]],
    ["src/moon.ts", [1, 2]],
  ]);
  const whole = await ws.search(root, { query: "Moon", caseSensitive: true, wholeWord: true });
  assert.deepEqual(
    whole.map((h) => h.file),
    ["README.md"],
  );
  const re = await ws.search(root, { query: "Moon\\w+", regex: true });
  assert.equal(re[0].matches[0].text, "export const Moonlight = moon;");
  assert.throws(() => ws.searchPattern({ query: "(", regex: true }));
});

test("binary and existing files are refused", async () => {
  const root = fixture();
  await assert.rejects(ws.readFile(path.join(root, "logo.bin")), { code: "EBINARY" });
  await assert.rejects(ws.rename(path.join(root, "README.md"), path.join(root, "src", "moon.ts")), {
    code: "EEXIST",
  });
  await ws.rename(path.join(root, "README.md"), path.join(root, "READ.md"));
  assert.equal(await ws.readFile(path.join(root, "READ.md")), "# Moon\n");
});
