"use strict";
// Turns the lines Claude Code prints with `--output-format stream-json --verbose
// --include-partial-messages` into the few events the Claude panel draws. Pure, so it is tested
// on its own (test/events.test.cjs) with lines in the shapes the CLI really prints.
//
// Events (all have a `kind`):
//   init        { model, sessionId, cwd, permissionMode, version }
//   status      { status }                       – "requesting", …
//   text-delta  { messageId, text }               – a piece of the answer as it streams
//   text        { messageId, text }               – the whole text of an answer block
//   tool-use    { id, name, input }
//   tool-result { toolUseId, isError, text }
//   context     { tokens }                        – tokens the conversation takes up now
//   context-window { tokens }                     – where Claude Code compacts it
//   rate-limit  { status, type, fiveHour, sevenDay, usingOverage }
//   result      { ok, subtype, text, costUsd, durationMs, turns, denials }

/** A rate-limit window as { utilization 0..1, resetsAt ms } or null. */
function windowOf(w) {
  if (!w || typeof w.utilization !== "number") return null;
  return {
    utilization: w.utilization,
    resetsAt: typeof w.resetsAt === "number" ? w.resetsAt * 1000 : null,
  };
}

/** The text of a tool result's content (a string or a list of blocks). */
function resultText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((b) => (b && b.type === "text" ? b.text : b && b.type === "image" ? "[image]" : ""))
    .filter(Boolean)
    .join("\n");
}

const contextTokens = (u) =>
  (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);

/** The UI events in one parsed stream-json message (often none). */
function eventsFrom(msg) {
  if (!msg || typeof msg !== "object") return [];
  switch (msg.type) {
    case "system":
      if (msg.subtype === "init") {
        return [
          {
            kind: "init",
            model: msg.model || null,
            sessionId: msg.session_id || null,
            cwd: msg.cwd || null,
            permissionMode: msg.permissionMode || null,
            version: msg.claude_code_version || null,
          },
        ];
      }
      if (msg.subtype === "status" && msg.status) return [{ kind: "status", status: msg.status }];
      return [];

    case "autocompact_state":
      if (msg.value && typeof msg.value.effective_window === "number") {
        return [{ kind: "context-window", tokens: msg.value.effective_window }];
      }
      return [];

    case "stream_event": {
      const ev = msg.event || {};
      if (msg.parent_tool_use_id) return []; // a subagent's own stream
      if (ev.type === "message_start" && ev.message) {
        const out = [{ kind: "stream-start", messageId: ev.message.id }];
        if (ev.message.usage)
          out.push({ kind: "context", tokens: contextTokens(ev.message.usage) });
        return out;
      }
      if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") {
        return [{ kind: "text-delta", messageId: msg.messageId || null, text: ev.delta.text }];
      }
      return [];
    }

    case "assistant": {
      if (msg.parent_tool_use_id) return [];
      const m = msg.message || {};
      const out = [];
      for (const block of m.content || []) {
        if (block.type === "text" && block.text) {
          out.push({ kind: "text", messageId: m.id || null, text: block.text });
        } else if (block.type === "tool_use") {
          out.push({ kind: "tool-use", id: block.id, name: block.name, input: block.input || {} });
        }
      }
      return out;
    }

    case "user": {
      if (msg.parent_tool_use_id) return [];
      const content = (msg.message && msg.message.content) || [];
      if (!Array.isArray(content)) return [];
      return content
        .filter((b) => b && b.type === "tool_result")
        .map((b) => ({
          kind: "tool-result",
          toolUseId: b.tool_use_id,
          isError: Boolean(b.is_error),
          text: resultText(b.content),
        }));
    }

    case "rate_limit_event": {
      const info = msg.rate_limit_info || {};
      const windows = info.unifiedWindows || {};
      return [
        {
          kind: "rate-limit",
          status: info.status || null,
          type: info.rateLimitType || null,
          fiveHour: windowOf(windows.five_hour),
          sevenDay: windowOf(windows.seven_day),
          usingOverage: Boolean(info.isUsingOverage),
        },
      ];
    }

    case "result":
      return [
        {
          kind: "result",
          ok: !msg.is_error && msg.subtype === "success",
          subtype: msg.subtype || null,
          text: typeof msg.result === "string" ? msg.result : "",
          costUsd: typeof msg.total_cost_usd === "number" ? msg.total_cost_usd : null,
          durationMs: typeof msg.duration_ms === "number" ? msg.duration_ms : null,
          turns: typeof msg.num_turns === "number" ? msg.num_turns : null,
          denials: (msg.permission_denials || []).map((d) => ({
            tool: d.tool_name,
            input: d.tool_input || {},
          })),
        },
      ];

    default:
      return [];
  }
}

/**
 * Splits a stdout stream into lines and hands each parsed JSON line's events to `emit`. Lines
 * that are not JSON (a warning, a crash) are passed on as { kind: "stderr", text }.
 */
function createLineParser(emit) {
  let buffer = "";
  let streamMessageId = null;
  const handle = (line) => {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      emit({ kind: "stderr", text: line });
      return;
    }
    for (const ev of eventsFrom(msg)) {
      // Deltas carry no message id of their own; they belong to the last message_start.
      if (ev.kind === "stream-start") {
        streamMessageId = ev.messageId;
        continue;
      }
      if (ev.kind === "text-delta" && !ev.messageId) ev.messageId = streamMessageId;
      emit(ev);
    }
  };
  return {
    push(chunk) {
      buffer += chunk;
      let nl;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        handle(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
      }
    },
    end() {
      if (buffer) handle(buffer);
      buffer = "";
    },
  };
}

module.exports = { eventsFrom, createLineParser };
