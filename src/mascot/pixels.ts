import { AXOLOTL_COLORS } from "./axo";

/** The pixel frames as rects: one per run of same-coloured pixels in a row. */
export type Frame = readonly string[];
export type Rect = { x: number; y: number; w: number; fill: string };

export const AXO_WIDTH = 26;
export const AXO_HEIGHT = 20;

export function toRects(frame: Frame): Rect[] {
  const rects: Rect[] = [];
  frame.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      const fill = AXOLOTL_COLORS[ch];
      if (fill) rects.push({ x, y, w: end - x, fill });
      x = end;
    }
  });
  return rects;
}
