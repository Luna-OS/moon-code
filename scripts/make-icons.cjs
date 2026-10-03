"use strict";
// npm run icons – renders public/moon-code-logo.svg into the app icons in build/:
// icon.png (256 px) and icon.ico (16–256 px, PNG-compressed entries, which Windows Vista and
// later read).
const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");

const root = path.join(__dirname, "..");
const svg = fs.readFileSync(path.join(root, "public", "moon-code-logo.svg"), "utf8");
const SIZES = [16, 24, 32, 48, 64, 128, 256];

const render = (size) =>
  Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng());

/** An .ico file holding one PNG per size. */
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

const pngs = SIZES.map((size) => ({ size, data: render(size) }));
fs.mkdirSync(path.join(root, "build"), { recursive: true });
fs.writeFileSync(path.join(root, "build", "icon.png"), pngs[pngs.length - 1].data);
fs.writeFileSync(path.join(root, "build", "icon.ico"), ico(pngs));
console.log(`build/icon.png and build/icon.ico (${SIZES.join(", ")} px)`);
