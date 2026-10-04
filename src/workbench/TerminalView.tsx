import { useEffect, useLayoutEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import type { MoonCodeBridge } from "../lib/types";

/** The terminal colours: the Moon palette (night) and its day variant. */
const THEMES = {
  dark: {
    background: "#00000000",
    foreground: "#e9e4f7",
    cursor: "#d6cffd",
    cursorAccent: "#0b0920",
    selectionBackground: "#b9aefb55",
    black: "#1d1742",
    red: "#f28b92",
    green: "#7fe3c6",
    yellow: "#f3c766",
    blue: "#9ad7f5",
    magenta: "#b9aefb",
    cyan: "#8ee6e0",
    white: "#e9e4f7",
    brightBlack: "#5d5789",
    brightRed: "#ffa3a9",
    brightGreen: "#a3f0da",
    brightYellow: "#f8d98f",
    brightBlue: "#bfe6fa",
    brightMagenta: "#d6cffd",
    brightCyan: "#b5f2ee",
    brightWhite: "#ffffff",
  },
  light: {
    background: "#00000000",
    foreground: "#1c1733",
    cursor: "#5b4bc4",
    cursorAccent: "#ffffff",
    selectionBackground: "#7d6de033",
    black: "#1c1733",
    red: "#c2323d",
    green: "#1d7d65",
    yellow: "#a86b00",
    blue: "#2f86b5",
    magenta: "#5b4bc4",
    cyan: "#18808a",
    white: "#6a6390",
    brightBlack: "#a29cc3",
    brightRed: "#d9505a",
    brightGreen: "#2a9a7e",
    brightYellow: "#c48a12",
    brightBlue: "#4a9fcb",
    brightMagenta: "#7d6de0",
    brightCyan: "#2a9aa5",
    brightWhite: "#1c1733",
  },
};

/** One terminal (xterm.js) wired to a pseudo console in the main process. */
export default function TerminalView({
  bridge,
  id,
  cwd,
  command,
  theme,
  visible,
  onLink,
}: {
  bridge: MoonCodeBridge;
  id: string;
  cwd: string | null;
  command?: string[] | string;
  theme: "dark" | "light";
  visible: boolean;
  /** A link clicked in the terminal (cloud sessions open in Moon Code, the rest in the browser). */
  onLink: (url: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const term = useRef<Terminal | null>(null);
  const fit = useRef<FitAddon | null>(null);
  const link = useRef(onLink);
  useLayoutEffect(() => {
    link.current = onLink;
  });

  useEffect(() => {
    if (!host.current) return;
    const t = new Terminal({
      allowTransparency: true,
      cursorBlink: true,
      fontFamily: '"Cascadia Code", "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.25,
      theme: THEMES[theme],
      scrollback: 5000,
      // Links a program marks itself (OSC 8).
      linkHandler: { activate: (_e, uri) => link.current(uri), allowNonHttpProtocols: false },
    });
    const f = new FitAddon();
    t.loadAddon(f);
    t.loadAddon(new WebLinksAddon((_e, uri) => link.current(uri)));
    t.open(host.current);
    term.current = t;
    fit.current = f;
    try {
      f.fit();
    } catch {
      // not laid out yet
    }
    const offData = bridge.on("terminal:data", (d) => {
      if (d.id === id) t.write(d.data);
    });
    const offExit = bridge.on("terminal:exit", (d) => {
      if (d.id === id) t.write("\r\n\x1b[2m[process ended]\x1b[0m\r\n");
    });
    const sub = t.onData((data) => void bridge.terminalWrite(id, data));
    void bridge.terminalStart(id, { cwd, cols: t.cols, rows: t.rows, command });
    const ro = new ResizeObserver(() => {
      try {
        f.fit();
        void bridge.terminalResize(id, t.cols, t.rows);
      } catch {
        // hidden
      }
    });
    ro.observe(host.current);
    return () => {
      ro.disconnect();
      offData();
      offExit();
      sub.dispose();
      void bridge.terminalKill(id);
      t.dispose();
    };
    // A terminal lives as long as its tab: cwd and command are only read at the start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge, id]);

  useEffect(() => {
    if (term.current) term.current.options.theme = THEMES[theme];
  }, [theme]);

  useEffect(() => {
    if (!visible) return;
    try {
      fit.current?.fit();
    } catch {
      // not laid out yet
    }
    term.current?.focus();
  }, [visible]);

  return (
    <div
      ref={host}
      className="h-full w-full px-2 pt-1"
      style={{ display: visible ? "block" : "none" }}
    />
  );
}
