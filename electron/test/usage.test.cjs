"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { USAGE_ARGS, parseUsage, toMs } = require("../claude/usage.cjs");
const { chatArgs } = require("../claude/cli.cjs");

const NOW = Date.UTC(2026, 9, 4, 8, 0);

/** A /usage run as Claude Code prints it with --output-format stream-json. */
function report(rateLimits, extra = {}) {
  return [
    JSON.stringify({ type: "system", subtype: "init", session_id: "x" }),
    JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "text", text: "Total cost: $0" }] },
    }),
    JSON.stringify({
      type: "result",
      subtype: "success",
      local_command: "usage",
      usage_report: {
        session: { total_cost_usd: 0 },
        subscription_type: "pro",
        rate_limits_available: true,
        rate_limits: rateLimits,
        ...extra,
      },
    }),
    "",
  ].join("\n");
}

test("the usage report runs locally, without MCP servers or a session file", () => {
  assert.deepEqual(USAGE_ARGS.slice(0, 2), ["-p", "/usage"]);
  assert.ok(USAGE_ARGS.includes("--no-session-persistence"));
  assert.ok(USAGE_ARGS.includes("--strict-mcp-config"));
});

test("the plan's windows, per-model rows and extra usage are read (percent → fraction)", () => {
  const u = parseUsage(
    report({
      five_hour: { utilization: 44, resets_at: "2026-10-04T09:40:00Z" },
      seven_day: { utilization: 79, resets_at: "2026-10-09T02:00:00Z" },
      seven_day_opus: null,
      seven_day_sonnet: { utilization: 31, resets_at: "2026-10-09T02:00:00Z" },
      model_scoped: [{ display_name: "Fable", utilization: 12, resets_at: "2026-10-09T02:00:00Z" }],
      extra_usage: {
        is_enabled: false,
        monthly_limit: 4000,
        used_credits: 0,
        utilization: 0,
        currency: "EUR",
      },
    }),
    NOW,
  );
  assert.equal(u.available, true);
  assert.equal(u.plan, "pro");
  assert.deepEqual(u.session, { utilization: 0.44, resetsAt: Date.UTC(2026, 9, 4, 9, 40) });
  assert.deepEqual(u.week, { utilization: 0.79, resetsAt: Date.UTC(2026, 9, 9, 2, 0) });
  assert.deepEqual(
    u.models.map((m) => [m.name, m.utilization]),
    [
      ["Sonnet", 0.31],
      ["Fable", 0.12],
    ],
  );
  assert.deepEqual(u.extra, {
    enabled: false,
    limit: 4000,
    used: 0,
    utilization: 0,
    currency: "EUR",
  });
  assert.equal(u.at, NOW);
});

test("no plan numbers: null, or 'not available' for an API key", () => {
  assert.equal(parseUsage(""), null);
  assert.equal(parseUsage('{"type":"result","result":"Total cost: $0"}\n'), null);
  assert.deepEqual(
    parseUsage(
      JSON.stringify({ type: "result", x: { rate_limits_available: false, rate_limits: null } }),
      NOW,
    ),
    { available: false, plan: null, at: NOW },
  );
});

test("reset times in ISO text, seconds or milliseconds", () => {
  assert.equal(toMs("2026-10-04T09:40:00Z"), Date.UTC(2026, 9, 4, 9, 40));
  assert.equal(toMs(1791100000), 1791100000000);
  assert.equal(toMs(1791100000000), 1791100000000);
  assert.equal(toMs("soon"), null);
  assert.equal(toMs(null), null);
});

test("Claude's language goes in as an appended system prompt", () => {
  const args = chatArgs({ language: "German" });
  const i = args.indexOf("--append-system-prompt");
  assert.ok(i > 0);
  assert.match(args[i + 1], /Always answer the user in German/);
  assert.equal(chatArgs({ language: "  " }).includes("--append-system-prompt"), false);
  assert.equal(chatArgs({}).includes("--append-system-prompt"), false);
});
