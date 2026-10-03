"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { eventsFrom, createLineParser } = require("../claude/events.cjs");

// Lines in the shapes Claude Code 2.1 prints with --output-format stream-json --verbose
// --include-partial-messages (trimmed to the fields that matter).
const LINES = [
  { type: "autocompact_state", value: { enabled: true, effective_window: 180000 } },
  {
    type: "system",
    subtype: "init",
    cwd: "/work/moon",
    session_id: "s-1",
    model: "claude-haiku-4-5-20251001",
    permissionMode: "default",
    claude_code_version: "2.1.288",
  },
  { type: "system", subtype: "status", status: "requesting" },
  {
    type: "stream_event",
    event: {
      type: "message_start",
      message: { id: "msg_1", usage: { input_tokens: 10, cache_read_input_tokens: 4141 } },
    },
    parent_tool_use_id: null,
  },
  {
    type: "stream_event",
    event: { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "Hello " } },
    parent_tool_use_id: null,
  },
  {
    type: "stream_event",
    event: { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "there!" } },
    parent_tool_use_id: null,
  },
  {
    type: "assistant",
    message: { id: "msg_1", content: [{ type: "text", text: "Hello there!" }] },
    parent_tool_use_id: null,
  },
  {
    type: "rate_limit_event",
    rate_limit_info: {
      status: "allowed_warning",
      resetsAt: 1791504000,
      rateLimitType: "seven_day",
      utilization: 0.66,
      isUsingOverage: false,
      unifiedWindows: {
        five_hour: { utilization: 0.48, resetsAt: 1791081600 },
        seven_day: { utilization: 0.66, resetsAt: 1791504000 },
      },
    },
  },
  {
    type: "result",
    subtype: "success",
    is_error: false,
    result: "Hello there!",
    total_cost_usd: 0.0008891,
    duration_ms: 1500,
    num_turns: 1,
    permission_denials: [],
  },
];

test("the stream of a short answer becomes the panel's events", () => {
  const events = [];
  const parser = createLineParser((e) => events.push(e));
  const text = LINES.map((l) => JSON.stringify(l)).join("\n") + "\n";
  // In pieces that cut lines in half, as stdout delivers them.
  for (let i = 0; i < text.length; i += 37) parser.push(text.slice(i, i + 37));
  parser.end();

  assert.deepEqual(
    events.map((e) => e.kind),
    [
      "context-window",
      "init",
      "status",
      "context",
      "text-delta",
      "text-delta",
      "text",
      "rate-limit",
      "result",
    ],
  );
  assert.equal(events[0].tokens, 180000);
  assert.equal(events[1].model, "claude-haiku-4-5-20251001");
  assert.equal(events[1].sessionId, "s-1");
  assert.equal(events[3].tokens, 4151);
  assert.equal(events[4].messageId, "msg_1");
  assert.equal(events[4].text + events[5].text, "Hello there!");

  const limit = events[7];
  assert.deepEqual(limit.fiveHour, { utilization: 0.48, resetsAt: 1791081600000 });
  assert.deepEqual(limit.sevenDay, { utilization: 0.66, resetsAt: 1791504000000 });
  assert.equal(limit.status, "allowed_warning");

  const result = events[8];
  assert.equal(result.ok, true);
  assert.equal(result.costUsd, 0.0008891);
  assert.deepEqual(result.denials, []);
});

test("tool calls and their results", () => {
  const use = eventsFrom({
    type: "assistant",
    message: {
      id: "m2",
      content: [{ type: "tool_use", id: "tu1", name: "Bash", input: { command: "ls" } }],
    },
  });
  assert.deepEqual(use, [{ kind: "tool-use", id: "tu1", name: "Bash", input: { command: "ls" } }]);

  const res = eventsFrom({
    type: "user",
    message: {
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: "tu1", content: [{ type: "text", text: "a.txt" }] },
      ],
    },
  });
  assert.deepEqual(res, [{ kind: "tool-result", toolUseId: "tu1", isError: false, text: "a.txt" }]);
});

test("a subagent's own messages stay out of the main conversation", () => {
  assert.deepEqual(
    eventsFrom({
      type: "assistant",
      parent_tool_use_id: "tu9",
      message: { id: "x", content: [{ type: "text", text: "inner" }] },
    }),
    [],
  );
});

test("denied tools are reported with the result", () => {
  const [r] = eventsFrom({
    type: "result",
    subtype: "success",
    is_error: false,
    result: "",
    permission_denials: [{ tool_name: "Bash", tool_use_id: "t", tool_input: { command: "rm x" } }],
  });
  assert.deepEqual(r.denials, [{ tool: "Bash", input: { command: "rm x" } }]);
});

test("a line that isn't JSON is passed on as stderr", () => {
  const events = [];
  const parser = createLineParser((e) => events.push(e));
  parser.push("Error: something broke\n");
  assert.deepEqual(events, [{ kind: "stderr", text: "Error: something broke" }]);
});
