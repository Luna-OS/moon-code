"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const a = require("../claude/attachments.cjs");
const { chatArgs, userMessageLine } = require("../claude/cli.cjs");

const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
    "1f15c4890000000d49444154789c6360f8cf00000301010018dd8db40000000049454e44ae426082",
  "hex",
).toString("base64");

test("attachments are saved with safe, unique names", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mc-att-"));
  const saved = a.saveAttachments(root, "chat-1", [
    { name: "shot.png", mime: "image/png", data: PNG },
    { name: "shot.png", mime: "image/png", data: PNG },
    {
      name: "../../evil:name?.txt",
      mime: "text/plain",
      data: Buffer.from("hi").toString("base64"),
    },
  ]);
  assert.deepEqual(
    saved.map((f) => path.relative(root, f.path)),
    [
      path.join("chat-1", "shot.png"),
      path.join("chat-1", "shot (2).png"),
      path.join("chat-1", "evil_name_.txt"),
    ],
  );
  assert.equal(fs.readFileSync(saved[2].path, "utf8"), "hi");
  assert.equal(a.safeName("..."), "file");
});

test("pictures go into the message, every file is named with its path", () => {
  const saved = [
    {
      name: "shot.png",
      mime: "image/png",
      size: 70,
      path: "/data/attachments/c/shot.png",
      data: PNG,
    },
    {
      name: "notes.pdf",
      mime: "application/pdf",
      size: 900,
      path: "/data/attachments/c/notes.pdf",
      data: "x",
    },
  ];
  const content = a.messageContent("Fix the layout", saved);
  assert.deepEqual(content[0], {
    type: "image",
    source: { type: "base64", media_type: "image/png", data: PNG },
  });
  assert.equal(content.length, 2);
  assert.equal(content[1].type, "text");
  assert.match(content[1].text, /^Fix the layout\n\nAttached files/);
  assert.match(content[1].text, /- notes\.pdf: \/data\/attachments\/c\/notes\.pdf/);
  assert.equal(a.messageContent("plain", []), "plain");
  // The line Claude Code reads.
  const line = JSON.parse(userMessageLine(content));
  assert.equal(line.message.content[0].type, "image");
});

test("the chat may read the attachments folder", () => {
  const args = chatArgs({ attachmentsDir: "/data/attachments" });
  assert.equal(args[args.indexOf("--add-dir") + 1], "/data/attachments");
  assert.equal(chatArgs({}).includes("--add-dir"), false);
});

test("old attachment folders are pruned", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mc-att-"));
  fs.mkdirSync(path.join(root, "old"));
  fs.mkdirSync(path.join(root, "new"));
  const old = Date.now() - 40 * 86_400_000;
  fs.utimesSync(path.join(root, "old"), old / 1000, old / 1000);
  a.pruneAttachments(root, 30);
  assert.deepEqual(fs.readdirSync(root).sort(), ["new"]);
});
