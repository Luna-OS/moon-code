import { memo, useEffect, useState } from "react";
import type { AxoMood } from "./axo";
import { AXOLOTL_FRAMES } from "./frames";
import { AXO_HEIGHT, AXO_WIDTH, toRects, type Rect } from "./pixels";

/*
 * Axo, Moon Code's mascot: a white (leucistic) axolotl in pixels. It sleeps while nobody is
 * signed in, idles and blinks while Claude waits, types on its moon laptop while Claude works,
 * and cheers when Claude is done. Frames come from scripts/axolotl-frames.py.
 */

const WIDTH = AXO_WIDTH;
const HEIGHT = AXO_HEIGHT;

const RECTS = Object.fromEntries(
  Object.entries(AXOLOTL_FRAMES).map(([mood, frames]) => [mood, frames.map(toRects)]),
) as Record<AxoMood, Rect[][]>;

const LABELS: Record<AxoMood, string> = {
  idle: "Axo the axolotl is waiting",
  work: "Axo the axolotl is coding with Claude",
  done: "Axo the axolotl is happy: Claude is done",
  sleep: "Axo the axolotl is asleep",
};

const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** Which frame of the mood to show now: typing alternates, idling blinks now and then. */
function useFrame(mood: AxoMood): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (mood === "work") {
      const t = setInterval(() => setTick((n) => n + 1), 280);
      return () => clearInterval(t);
    }
    if (mood === "idle") {
      // Eyes open for about four seconds, closed for a blink.
      let timer: ReturnType<typeof setTimeout>;
      const blink = () => {
        setTick(1);
        timer = setTimeout(() => {
          setTick(0);
          timer = setTimeout(blink, 3200 + Math.random() * 2400);
        }, 160);
      };
      timer = setTimeout(blink, 2400);
      return () => clearTimeout(timer);
    }
  }, [mood]);
  const count = RECTS[mood].length;
  return mood === "work" ? tick % count : mood === "idle" ? Math.min(tick, count - 1) : 0;
}

export const Axolotl = memo(function Axolotl({
  mood,
  size = 52,
}: {
  mood: AxoMood;
  /** Width in CSS pixels (the sprite is 26 × 20). */
  size?: number;
}) {
  const frame = useFrame(mood);
  // The typing and blinking timers keep running; a frame from another mood is never shown.
  const rects = RECTS[mood][Math.min(frame, RECTS[mood].length - 1)];
  return (
    <span className="mc-axo" data-mood={mood} role="img" aria-label={LABELS[mood]}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width={size}
        height={(size * HEIGHT) / WIDTH}
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        {rects.map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
        ))}
      </svg>
      {mood === "sleep" && (
        <span className="mc-axo-z" aria-hidden="true">
          <span>z</span>
          <span>z</span>
          <span>Z</span>
        </span>
      )}
    </span>
  );
});
