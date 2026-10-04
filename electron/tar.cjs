"use strict";
// Reads a .tar.gz (the archive GitHub gives for a repository) without any tool: ustar entries,
// with long names from PAX ("x") and GNU ("L") headers. Only regular files and folders are kept,
// and nothing may land outside the target folder.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const text = (buf, start, len) => {
  const s = buf.subarray(start, start + len);
  const end = s.indexOf(0);
  return s.subarray(0, end === -1 ? s.length : end).toString("utf8");
};
const octal = (buf, start, len) => parseInt(text(buf, start, len).trim() || "0", 8);

/** The PAX records of an "x" header: { path, … }. */
function pax(body) {
  const out = {};
  let i = 0;
  while (i < body.length) {
    const sp = body.indexOf(0x20, i);
    if (sp === -1) break;
    const len = parseInt(body.subarray(i, sp).toString("utf8"), 10);
    if (!len) break;
    const rec = body.subarray(sp + 1, i + len - 1).toString("utf8");
    const eq = rec.indexOf("=");
    if (eq > 0) out[rec.slice(0, eq)] = rec.slice(eq + 1);
    i += len;
  }
  return out;
}

/**
 * The entries of a tar archive: [{ name, type: "file" | "dir", data? }]. `strip` drops that many
 * leading path parts (GitHub puts everything under "owner-repo-sha/").
 */
function readTar(buf, { strip = 0 } = {}) {
  const entries = [];
  let off = 0;
  let longName = null;
  while (off + 512 <= buf.length) {
    const header = buf.subarray(off, off + 512);
    if (header.every((b) => b === 0)) break;
    const size = octal(header, 124, 12);
    const type = String.fromCharCode(header[156] || 48);
    const body = buf.subarray(off + 512, off + 512 + size);
    off += 512 + Math.ceil(size / 512) * 512;
    if (type === "x") {
      longName = pax(body).path ?? longName;
      continue;
    }
    if (type === "L") {
      longName = text(body, 0, body.length);
      continue;
    }
    if (type === "g") continue;
    const prefix = text(header, 345, 155);
    let name = longName ?? (prefix ? `${prefix}/${text(header, 0, 100)}` : text(header, 0, 100));
    longName = null;
    name = name.split("/").filter(Boolean).slice(strip).join("/");
    if (!name) continue;
    if (type === "5") entries.push({ name, type: "dir" });
    else if (type === "0" || type === "\0" || type === "7") {
      entries.push({ name, type: "file", data: Buffer.from(body) });
    }
    // Links and devices are left out.
  }
  return entries;
}

/** Writes a .tar.gz into `dest` (made if needed); resolves to the number of files written. */
function extractTarGz(gz, dest, { strip = 1 } = {}) {
  const entries = readTar(zlib.gunzipSync(gz), { strip });
  const root = path.resolve(dest);
  let files = 0;
  for (const e of entries) {
    const target = path.resolve(root, e.name);
    if (target !== root && !target.startsWith(root + path.sep)) continue;
    if (e.type === "dir") fs.mkdirSync(target, { recursive: true });
    else {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, e.data);
      files++;
    }
  }
  return files;
}

module.exports = { readTar, extractTarGz };
