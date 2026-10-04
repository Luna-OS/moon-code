import { describe, expect, it } from "vitest";
import { allowRule, chatReducer, emptyChat, modelLabel, splitBlocks, toolSummary } from "./claude";
import { percent, timeAgo, timeUntil, tokens } from "./format";
import { kindColor, languageOf } from "./languages";
import { basename, dirname, join, relative, resolveIn, tildify } from "./paths";
import { fuzzyScore } from "./fuzzy";
import { moonPage, pageScript } from "../workbench/cloud-page";
import { bytes, fileUrl, fromBase64, hexRows, isMarkdown } from "./files";
import { money, paceWarning, resetText, runsOutAt, SESSION_MS, WEEK_MS } from "./usage";

describe("model names", () => {
  it("reads the ids Claude Code reports", () => {
    expect(modelLabel("claude-opus-5-5")).toBe("Opus 5.5");
    expect(modelLabel("claude-haiku-4-5-20251001")).toBe("Haiku 4.5");
    expect(modelLabel("claude-sonnet-5")).toBe("Sonnet 5");
    expect(modelLabel("claude-opus-4-8[1m]")).toBe("Opus 4.8 (1M)");
    expect(modelLabel(null)).toBe("Default");
    expect(modelLabel("something-else")).toBe("something-else");
  });
});

describe("the conversation", () => {
  it("streams an answer, then replaces it with the whole text", () => {
    let s = chatReducer(emptyChat(), { type: "user", text: "Hi" });
    expect(s.busy).toBe(true);
    s = chatReducer(s, {
      type: "event",
      event: { kind: "text-delta", messageId: "m1", text: "Hel" },
    });
    s = chatReducer(s, {
      type: "event",
      event: { kind: "text-delta", messageId: "m1", text: "lo" },
    });
    const streaming = s.items[1];
    expect(streaming).toMatchObject({ type: "assistant", text: "Hello", done: false });
    s = chatReducer(s, { type: "event", event: { kind: "text", messageId: "m1", text: "Hello!" } });
    expect(s.items[1]).toMatchObject({ text: "Hello!", done: true });
    s = chatReducer(s, {
      type: "event",
      event: {
        kind: "result",
        ok: true,
        subtype: "success",
        text: "Hello!",
        costUsd: 0.01,
        durationMs: 1,
        turns: 1,
        denials: [],
      },
    });
    expect(s.busy).toBe(false);
    expect(s.costUsd).toBe(0.01);
  });

  it("pairs tool calls with their results", () => {
    let s = chatReducer(emptyChat(), {
      type: "event",
      event: { kind: "tool-use", id: "t1", name: "Bash", input: { command: "npm test" } },
    });
    s = chatReducer(s, {
      type: "event",
      event: { kind: "tool-result", toolUseId: "t1", isError: true, text: "1 failed" },
    });
    expect(s.items[0]).toMatchObject({ type: "tool", result: { isError: true, text: "1 failed" } });
  });

  it("asks for an OK when tools were denied", () => {
    const s = chatReducer(emptyChat(), {
      type: "event",
      event: {
        kind: "result",
        ok: true,
        subtype: "success",
        text: "",
        costUsd: null,
        durationMs: null,
        turns: 1,
        denials: [{ tool: "Bash", input: { command: "rm -rf dist" } }],
      },
    });
    expect(s.items[0]).toMatchObject({ type: "notice", tone: "warning" });
    expect(allowRule({ tool: "Bash", input: { command: "rm -rf dist" } })).toBe(
      "Bash(rm -rf dist)",
    );
    expect(allowRule({ tool: "Edit", input: { file_path: "/a" } })).toBe("Edit");
  });

  it("remembers the session, model and context", () => {
    let s = chatReducer(emptyChat(), {
      type: "event",
      event: {
        kind: "init",
        model: "claude-opus-5-5",
        sessionId: "s1",
        cwd: "/a",
        permissionMode: "default",
        version: "2",
      },
    });
    s = chatReducer(s, { type: "event", event: { kind: "context", tokens: 1234 } });
    s = chatReducer(s, { type: "event", event: { kind: "context-window", tokens: 200000 } });
    expect(s).toMatchObject({
      model: "claude-opus-5-5",
      sessionId: "s1",
      contextTokens: 1234,
      contextWindow: 200000,
    });
  });

  it("reports a crash", () => {
    const s = chatReducer(
      { ...emptyChat(), busy: true },
      { type: "event", event: { kind: "exit", code: 1, stderr: "boom" } },
    );
    expect(s.busy).toBe(false);
    expect(s.ended).toBe(true);
    expect(s.items[0]).toMatchObject({ tone: "error", text: "boom" });
  });
});

describe("answers", () => {
  it("splits paragraphs and code blocks", () => {
    const blocks = splitBlocks("One.\n\nTwo `x`.\n\n```ts\nconst a = 1;\n```\nEnd");
    expect(blocks).toEqual([
      { kind: "text", text: "One." },
      { kind: "text", text: "Two `x`." },
      { kind: "code", lang: "ts", text: "const a = 1;" },
      { kind: "text", text: "End" },
    ]);
  });

  it("keeps an unfinished code block while it streams", () => {
    expect(splitBlocks("```js\nlet a")).toEqual([{ kind: "code", lang: "js", text: "let a" }]);
  });

  it("summarizes tool calls", () => {
    expect(toolSummary("Read", { file_path: "/home/luna/x/src/App.tsx" })).toBe("src/App.tsx");
    expect(toolSummary("Bash", { command: "ls", description: "List files" })).toBe("List files");
    expect(toolSummary("Grep", { pattern: "moon" })).toBe("moon");
  });
});

describe("paths", () => {
  it("work with both separators", () => {
    expect(basename("C:\\Users\\Luna\\a.ts")).toBe("a.ts");
    expect(dirname("/home/luna/a.ts")).toBe("/home/luna");
    expect(dirname("C:\\a.ts")).toBe("C:\\");
    expect(join("C:\\Users", "x")).toBe("C:\\Users\\x");
    expect(join("/home/", "x")).toBe("/home/x");
    expect(relative("/home/luna/p", "/home/luna/p/src/a.ts")).toBe("src/a.ts");
    expect(relative("C:\\p", "C:\\p\\src\\a.ts")).toBe("src/a.ts");
    expect(resolveIn("C:\\p", "src/a.ts")).toBe("C:\\p\\src\\a.ts");
    expect(tildify("/home/luna/Moon-Zip", "/home/luna")).toBe("~/Moon-Zip");
    expect(tildify("/opt/x", "/home/luna")).toBe("/opt/x");
  });

  it("know the languages", () => {
    expect(languageOf("a/App.tsx")).toBe("typescript");
    expect(languageOf("Dockerfile")).toBe("dockerfile");
    expect(languageOf("install.ps1")).toBe("powershell");
    expect(languageOf("notes")).toBe("plaintext");
    expect(kindColor("logo.svg")).toBe("var(--mc-kind-image)");
  });
});

describe("display", () => {
  const now = Date.UTC(2026, 9, 3, 12);
  it("formats times, percentages and tokens", () => {
    expect(timeAgo(now - 5 * 60_000, now)).toBe("5 min ago");
    expect(timeAgo(now - 30 * 3_600_000, now)).toBe("yesterday");
    expect(timeUntil(now + 144 * 60_000, now)).toBe("in 2 h 24 min");
    expect(timeUntil(now + 98 * 3_600_000, now)).toBe("in 4 d 2 h");
    expect(percent(0.483)).toBe("48 %");
    expect(tokens(18420)).toBe("18k");
    expect(tokens(4151)).toBe("4.2k");
  });

  it("ranks quick-open matches", () => {
    expect(fuzzyScore("app", "src/App.tsx")).toBeGreaterThan(
      fuzzyScore("app", "src/lib/wrapper.ts"),
    );
    expect(fuzzyScore("xyz", "src/App.tsx")).toBe(-1);
  });
});

describe("usage", () => {
  const H = 3_600_000;
  // A Monday morning (local time), so the weekday names are known.
  const now = new Date(2026, 9, 5, 8, 0).getTime();

  it("warns when the week runs out before its reset", () => {
    // 79 % used after 3.5 of 7 days: the rest lasts about another 0.9 days.
    const week = { utilization: 0.79, resetsAt: now + 3.5 * 24 * H };
    const at = runsOutAt(week, WEEK_MS, now);
    expect(at).not.toBeNull();
    expect(at! - now).toBeGreaterThan(0.9 * 24 * H);
    expect(at! - now).toBeLessThan(1 * 24 * H);
    expect(paceWarning(null, week, now)).toMatch(
      /^Heads up: at this pace you'll run out tomorrow at \d\d:\d\d, before the weekly reset on Thursday at 20:00\.$/,
    );
  });

  it("stays quiet when the pace lasts, or when it is too early to tell", () => {
    expect(runsOutAt({ utilization: 0.3, resetsAt: now + 3.5 * 24 * H }, WEEK_MS, now)).toBeNull();
    expect(runsOutAt({ utilization: 0.04, resetsAt: now + 4.9 * H }, SESSION_MS, now)).toBeNull();
    expect(paceWarning({ utilization: 0.2, resetsAt: now + 2 * H }, null, now)).toBeNull();
  });

  it("says when a limit is reached, and when the session runs out", () => {
    expect(paceWarning(null, { utilization: 1, resetsAt: now + 2 * 24 * H }, now)).toBe(
      "You've used this week's limit. It resets on Wednesday at 08:00.",
    );
    // 60 % after 1 of 5 hours: out in 40 minutes.
    expect(paceWarning({ utilization: 0.6, resetsAt: now + 4 * H }, null, now)).toBe(
      "Heads up: at this pace this session runs out at 08:40, before it resets at 12:00.",
    );
  });

  it("formats resets and money", () => {
    expect(resetText(now + 1.5 * H, now)).toBe("Resets at 09:30");
    expect(resetText(now + 4 * 24 * H, now)).toBe("Resets Friday, 08:00");
    expect(money(4000, "EUR")).toBe("€40.00");
    expect(money(1234, "USD")).toBe("US$12.34");
  });
});

describe("the cloud tab's Moon colours", () => {
  const page = moonPage({ test: true }) as unknown as {
    parseColor: (
      v: string,
    ) => { r: number; g: number; b: number; a: number; format: string } | null;
    moonify: (
      c: { r: number; g: number; b: number; a: number },
      theme: "dark" | "light",
    ) => { r: number; g: number; b: number; a: number };
    formatColor: (c: { r: number; g: number; b: number; a: number }, format: string) => string;
  };
  const hueOf = (c: { r: number; g: number; b: number }) => {
    const max = Math.max(c.r, c.g, c.b);
    const min = Math.min(c.r, c.g, c.b);
    if (max === min) return 0;
    const d = max - min;
    const h =
      max === c.r
        ? (c.g - c.b) / d + (c.g < c.b ? 6 : 0)
        : max === c.g
          ? (c.b - c.r) / d + 2
          : (c.r - c.g) / d + 4;
    return h * 60;
  };

  it("reads colours in every way a stylesheet writes them", () => {
    expect(page.parseColor("#262624")).toMatchObject({ r: 38, g: 38, b: 36, format: "hex" });
    expect(page.parseColor("#fff")).toMatchObject({ r: 255, g: 255, b: 255, format: "hex" });
    expect(page.parseColor("rgba(217, 119, 87, 0.5)")).toMatchObject({ a: 0.5, format: "rgb" });
    expect(page.parseColor("rgb(31 30 29 / 40%)")).toMatchObject({ r: 31, a: 0.4, format: "rgb" });
    expect(page.parseColor("hsl(15 63% 60%)")?.format).toBe("hsl");
    expect(page.parseColor("60 2.7% 14.5%")?.format).toBe("hsl-triplet");
    expect(page.parseColor("31 31 30")?.format).toBe("rgb-triplet");
    expect(page.parseColor("12px")).toBeNull();
    expect(page.parseColor("var(--x)")).toBeNull();
    expect(page.parseColor("1 2")).toBeNull();
  });

  it("turns greys into night blue and Claude's orange into lavender", () => {
    const bg = page.moonify({ r: 38, g: 38, b: 36, a: 1 }, "dark");
    expect(hueOf(bg)).toBeGreaterThan(240);
    expect(hueOf(bg)).toBeLessThan(255);
    expect(bg.b).toBeGreaterThan(bg.r);
    const accent = page.moonify({ r: 217, g: 119, b: 87, a: 1 }, "dark");
    expect(hueOf(accent)).toBeGreaterThan(240);
    expect(hueOf(accent)).toBeLessThan(255);
    // Text stays readable: light stays light.
    const text = page.moonify({ r: 250, g: 249, b: 245, a: 1 }, "dark");
    expect(Math.min(text.r, text.g, text.b)).toBeGreaterThan(220);
    // Other colours (a green "success") are left alone.
    expect(page.moonify({ r: 60, g: 180, b: 90, a: 1 }, "dark")).toMatchObject({ g: 180 });
  });

  it("writes the colour back in the format it came in", () => {
    const c = { r: 16, g: 13, b: 40, a: 1 };
    expect(page.formatColor(c, "hex")).toBe("#100d28");
    expect(page.formatColor(c, "rgb-triplet")).toBe("16 13 40");
    expect(page.formatColor(c, "hsl-triplet")).toMatch(/^24\d(\.\d)? 5\d(\.\d)?% 10(\.\d)?%$/);
    expect(page.formatColor({ ...c, a: 0.5 }, "rgb")).toBe("rgba(16, 13, 40, 0.5)");
  });

  it("is one self-contained script for the page", () => {
    const script = pageScript({ theme: "dark" });
    expect(script.startsWith("(")).toBe(true);
    expect(script).toContain('"theme":"dark"');
    expect(script).toContain('"test":false');
  });
});

describe("files", () => {
  it("shows bytes as a hex view", () => {
    const rows = hexRows(new Uint8Array([0x4d, 0x6f, 0x6f, 0x6e, 0x00, 0x0a, 0x7e, 0xff]));
    expect(rows).toEqual([
      { offset: "00000000", hex: "4d 6f 6f 6e 00 0a 7e ff".padEnd(47, " "), text: "Moon..~." },
    ]);
    expect(hexRows(new Uint8Array(33))).toHaveLength(3);
    expect(fromBase64("TW9vbg==")).toEqual(new Uint8Array([77, 111, 111, 110]));
  });

  it("names sizes and the viewer address", () => {
    expect(bytes(512)).toBe("512 B");
    expect(bytes(1536)).toBe("1.5 KB");
    expect(bytes(6 * 1024 * 1024)).toBe("6.0 MB");
    expect(fileUrl("C:\\Users\\Luna\\moon.png")).toBe(
      "moon-file://local/C%3A%5CUsers%5CLuna%5Cmoon.png",
    );
    expect(isMarkdown("README.md")).toBe(true);
    expect(isMarkdown("main.ts")).toBe(false);
  });

  it("knows Claude's orange (the mascot) from other colours", () => {
    const { isOrange } = moonPage({ test: true }) as unknown as {
      isOrange: (c: { r: number; g: number; b: number; a: number }) => boolean;
    };
    expect(isOrange({ r: 217, g: 119, b: 87, a: 1 })).toBe(true);
    expect(isOrange({ r: 60, g: 180, b: 90, a: 1 })).toBe(false);
    expect(isOrange({ r: 38, g: 38, b: 36, a: 1 })).toBe(false);
    expect(isOrange({ r: 217, g: 119, b: 87, a: 0.1 })).toBe(false);
  });
});
