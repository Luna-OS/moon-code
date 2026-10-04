"use strict";
// Files and pictures added to a message in the Claude panel. Each is saved in Moon Code's data
// folder (attachments/<chat>/), which the chat may read (`--add-dir`), and the message names
// them; pictures also go into the message itself, so Claude sees them right away.
const fs = require("fs");
const path = require("path");

/** Pictures Claude can look at directly (and how big one may be for that). */
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_INLINE_IMAGE = 5 * 1024 * 1024;
/** The largest file Moon Code takes as an attachment. */
const MAX_FILE = 25 * 1024 * 1024;

/** A file name that is safe on every system (and not empty). */
function safeName(name) {
  const base = Array.from(path.basename(String(name || "file")))
    .map((c) => (c.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(c) ? "_" : c))
    .join("");
  const trimmed = base.replace(/^[.\s]+|[.\s]+$/g, "");
  return (trimmed || "file").slice(0, 120);
}

/**
 * Saves the attachments ({ name, mime, data: base64 }) of one message under root/<chat>/ and
 * resolves to [{ name, mime, size, path, data }] (data kept for pictures shown inline).
 */
function saveAttachments(root, chatId, attachments) {
  const dir = path.join(root, safeName(chatId));
  fs.mkdirSync(dir, { recursive: true });
  return (attachments || []).map((a) => {
    const data = Buffer.from(String(a.data || ""), "base64");
    if (data.length > MAX_FILE) {
      throw new Error(`${a.name} is larger than ${MAX_FILE / 1024 / 1024} MB.`);
    }
    const name = safeName(a.name);
    const ext = path.extname(name);
    const stem = name.slice(0, name.length - ext.length);
    let file = path.join(dir, name);
    for (let i = 2; fs.existsSync(file); i++) file = path.join(dir, `${stem} (${i})${ext}`);
    fs.writeFileSync(file, data);
    return { name, mime: String(a.mime || ""), size: data.length, path: file, data: a.data };
  });
}

/** The message for Claude Code: its pictures, then the text naming every saved file. */
function messageContent(text, saved) {
  if (!saved || !saved.length) return text;
  const content = [];
  for (const f of saved) {
    if (IMAGE_TYPES.has(f.mime) && f.size <= MAX_INLINE_IMAGE) {
      content.push({ type: "image", source: { type: "base64", media_type: f.mime, data: f.data } });
    }
  }
  const list = saved.map((f) => `- ${f.name}: ${f.path}`).join("\n");
  content.push({
    type: "text",
    text: `${text}\n\nAttached files (saved on this computer; read them when you need them):\n${list}`.trim(),
  });
  return content;
}

/** Removes attachment folders older than `days` (best effort, at start). */
function pruneAttachments(root, days = 30, now = Date.now()) {
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const dir = path.join(root, e.name);
    try {
      if (now - fs.statSync(dir).mtimeMs > days * 86_400_000) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    } catch {
      // in use: next time
    }
  }
}

module.exports = {
  saveAttachments,
  messageContent,
  pruneAttachments,
  safeName,
  IMAGE_TYPES,
  MAX_FILE,
};
