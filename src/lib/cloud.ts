/** Claude Code on the web: its address and its session links (as in electron/cloud.cjs). */

export const CLAUDE_CODE_WEB = "https://claude.ai/code";

/**
 * A session's ID from what the user typed: the bare ID (session_… / cse_…) or its claude.ai/code
 * link, with or without the scheme or a query string. Null for anything else.
 */
export function sessionRef(input: string): string | null {
  const s = input.trim();
  if (/^(session_|cse_)[A-Za-z0-9]{6,}$/.test(s)) return s;
  const m =
    /^(?:https?:\/\/)?claude\.ai\/code\/((?:session_|cse_)[A-Za-z0-9]{6,})(?:[/?#].*)?$/.exec(s);
  return m ? m[1] : null;
}

export const sessionUrl = (id: string) => `${CLAUDE_CODE_WEB}/${id}`;

/** True for claude.ai/code and its pages: those open in Moon Code's cloud tab. */
export function isClaudeCodeUrl(url: string): boolean {
  return /^https:\/\/claude\.ai\/code(?:[/?#]|$)/.test(url.trim());
}
