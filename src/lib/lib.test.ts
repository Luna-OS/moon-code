import { describe, expect, it } from "vitest";
import { allowRule, chatReducer, emptyChat, modelLabel, splitBlocks, toolSummary } from "./claude";
import { percent, timeAgo, timeUntil, tokens } from "./format";
import { kindColor, languageOf } from "./languages";
import { basename, dirname, join, relative, resolveIn, tildify } from "./paths";
import { fuzzyScore } from "./fuzzy";

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
