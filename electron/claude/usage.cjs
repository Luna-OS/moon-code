"use strict";
// The plan's usage, as Claude Code's own `/usage` command reports it: the 5-hour session, the week,
// the per-model weekly windows and the extra usage (credits). `claude -p /usage` runs locally – it
// asks claude.ai for the numbers and sends nothing to the model, so it costs no usage and can run
// every few seconds. Its result carries a structured copy of the numbers beside the text; that copy
// is what is read here.
//
// The shape (Claude Code's "/usage" twin, experimental):
//   { subscription_type, rate_limits_available,
//     rate_limits: { five_hour, seven_day, seven_day_opus, seven_day_sonnet: { utilization, resets_at },
//                    model_scoped: [{ display_name, utilization, resets_at }],
//                    extra_usage: { is_enabled, monthly_limit, used_credits, utilization, currency } } }
// utilization is in percent there (44 = 44 %); Moon Code uses fractions (0.44).

/** `claude` arguments for the usage report: no session file, no MCP servers to start. */
const USAGE_ARGS = [
  "-p",
  "/usage",
  "--output-format",
  "stream-json",
  "--verbose",
  "--no-session-persistence",
  "--strict-mcp-config",
];

const MODEL_WINDOWS = [
  ["seven_day_opus", "Opus"],
  ["seven_day_sonnet", "Sonnet"],
];

/** A time from the report (ISO text, seconds or milliseconds) in milliseconds, or null. */
function toMs(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v < 1e12 ? v * 1000 : v;
  if (typeof v === "string" && v) {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** { utilization (0..1), resetsAt (ms) } from a window of the report, or null. */
function windowOf(w) {
  const u = w && num(w.utilization);
  if (u === null || u === undefined) return null;
  return { utilization: u / 100, resetsAt: toMs(w.resets_at ?? w.resetsAt) };
}

/** The first object (depth first) that has `key` as its own property. */
function findWith(value, key, depth = 0) {
  if (!value || typeof value !== "object" || depth > 8) return null;
  if (!Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, key)) return value;
  for (const v of Array.isArray(value) ? value : Object.values(value)) {
    const hit = findWith(v, key, depth + 1);
    if (hit) return hit;
  }
  return null;
}

/**
 * The plan usage from the output of `claude -p /usage` (stream-json or json), or null when the
 * report has no plan numbers (an older Claude Code, an API key, a login without that scope).
 */
function parseUsage(stdout, now = Date.now()) {
  for (const line of String(stdout || "").split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith("{")) continue;
    let msg;
    try {
      msg = JSON.parse(t);
    } catch {
      continue;
    }
    const report = findWith(msg, "rate_limits");
    if (!report) continue;
    const rl = report.rate_limits;
    if (!rl || typeof rl !== "object") {
      return report.rate_limits_available === false
        ? { available: false, plan: report.subscription_type || null, at: now }
        : null;
    }
    const models = [];
    for (const [key, name] of MODEL_WINDOWS) {
      const w = windowOf(rl[key]);
      if (w) models.push({ name, ...w });
    }
    for (const m of Array.isArray(rl.model_scoped) ? rl.model_scoped : []) {
      const w = windowOf(m);
      if (w && m.display_name && !models.some((x) => x.name === m.display_name)) {
        models.push({ name: String(m.display_name), ...w });
      }
    }
    const x = rl.extra_usage;
    return {
      available: true,
      plan: report.subscription_type || null,
      session: windowOf(rl.five_hour),
      week: windowOf(rl.seven_day),
      models,
      // Amounts as claude.ai sends them: in cents.
      extra:
        x && typeof x === "object"
          ? {
              enabled: Boolean(x.is_enabled),
              limit: num(x.monthly_limit),
              used: num(x.used_credits),
              utilization: num(x.utilization) === null ? null : x.utilization / 100,
              currency: typeof x.currency === "string" ? x.currency : null,
            }
          : null,
      at: now,
    };
  }
  return null;
}

module.exports = { USAGE_ARGS, parseUsage, windowOf, toMs };
