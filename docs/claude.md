# Claude in Moon Code

Moon Code puts **your own Claude Code** next to the editor. It signs in with your Claude account,
works in the folder you have open, and shows your projects, the model and your plan's limits.

## How it works

Moon Code doesn't call the Claude API and never touches your login's tokens. Everything goes through
the official `claude` program, which you install once:

| Step | What Moon Code runs |
| --- | --- |
| Find Claude Code | `claude` on the PATH, `~/.local/bin`, `%APPDATA%\npm` (or the path in Settings) |
| Install it | the official installer in the terminal: `irm https://claude.ai/install.ps1 \| iex` (Windows) |
| Sign in | `claude auth login` in a terminal tab; Moon Code checks `claude auth status --json` until you are in |
| Who is signed in | `claude auth status --json`, plus the e-mail Claude Code keeps in `~/.claude.json` |
| Chat | one `claude -p --input-format stream-json --output-format stream-json --verbose --include-partial-messages` per conversation, in the open folder |
| Limits | the `rate_limit_event` lines of that stream: the 5-hour and the 7-day window, how much is used and when it resets |
| Check limits now | `claude -p "Reply with OK." --model haiku --tools "" --no-session-persistence` – the smallest possible request |
| Sign out | `claude auth logout` |

## GitHub

Moon Code signs in to GitHub through the official GitHub CLI, so it never sees a token either:

| Step | What Moon Code runs |
| --- | --- |
| Find it | `gh` on the PATH, `Program Files\GitHub CLI` (or `/usr/local/bin`, `/opt/homebrew/bin`) |
| Install it | `winget install --id GitHub.cli -e --source winget` (Windows), `brew install gh` (macOS) |
| Sign in | `gh auth login --hostname github.com --web --git-protocol https` in a terminal tab |
| Who is signed in | `gh api user` – the login, the name and the avatar |
| Sign out | `gh auth logout --hostname github.com` in a terminal tab |

## Cloud

The cloud icon in the activity bar opens **Claude Code on the web inside Moon Code**: claude.ai/code
as a tab next to your files (`src/workbench/CloudWeb.tsx`, an Electron `<webview>`), with its own
navigation, sessions and composer – no browser, no Claude app.

- **Moon colours.** On every page, Moon Code runs `src/workbench/cloud-page.ts` in it: every CSS
  custom property that holds a colour (hex, `rgb()`, `hsl()`, or the bare `60 2.7% 14.5%` /
  `31 31 30` parts Tailwind builds colours from) is read, whatever it is called, and set to its
  Moon version – greys become night blue (or moonlight in the day theme), Claude's orange becomes
  lavender, other colours (green, blue, red) stay. It runs again when stylesheets change and every
  few seconds while the tab is shown; the page's light or dark mode follows Moon Code
  (`nativeTheme.themeSource`).
- **Axo instead of Clawd.** The same script swaps claude.ai's mascot – an `<svg>` drawn mostly in
  the clay orange, or a picture named like it – for Axo, built rect by rect with DOM calls (no
  HTML parsing, which claude.ai's Trusted Types may forbid), and turns other orange drawings
  lavender. A `MutationObserver` does it again when the page draws them anew.
- **Stars.** At night a fixed layer of Moon Code's stars lies over the page with
  `mix-blend-mode: screen`, so it only shows on the dark surfaces.
- **No browser chrome.** A Moon header with a reload button; only when the page can't load does it
  offer the browser.
- **Sign-in stays.** The tab has its own browser session (`persist:claude-web`): sign in to
  claude.ai there once. That sign-in is the website's own; Moon Code doesn't read it.
- **Safe.** It only ever starts on claude.ai, without Node and without a preload. Sign-in windows
  (Google, Apple, GitHub's sign-in and app installation) open as small Moon Code windows with the
  same session; every other link opens in your browser. The user agent leaves out Electron's token,
  since some sign-in pages turn away browsers they don't know.
- **Links land here.** When `claude --cloud` prints "Open in browser: https://claude.ai/code/session_…"
  in a terminal, Moon Code picks the link up (`electron/cloud.cjs`, also from OSC 8 links) and
  opens the session in the tab. claude.ai/code links clicked in a terminal or in the chat open
  there too.

## Usage

The **Usage** tab (account menu → Usage, or "Claude: Show usage") shows the plan's usage like
the Claude app: the current 5-hour session, the week, the weekly per-model windows and the extra
usage, with a warning when the pace since the window started runs out before its reset
(`src/lib/usage.ts`).

- The numbers come from Claude Code's own `/usage` (`claude -p /usage --output-format stream-json
  --verbose --no-session-persistence --strict-mcp-config`, `electron/claude/usage.cjs`), which
  reads them from claude.ai without asking the model, so it costs no usage. Moon Code asks every
  30 seconds while the Usage tab is in front, every 3 minutes otherwise, and when the window comes
  back to the front.
- Every answer in the Claude panel carries the limits too (`rate_limit_event`), so they move while
  Claude works.
- When `/usage` has no plan numbers (an older Claude Code), the tab uses the limits from the
  answers and checks them itself every 10 minutes while it is open (one tiny Haiku message).
- "Upgrade plan", "Buy more usage" and "Manage" open claude.ai's pages in Moon Code's web tab.

## Account menu

The person at the bottom of the activity bar opens the menu of the Claude app: Usage, Claude's
language (added to the chat as `--append-system-prompt "Always answer the user in <language>…"`),
Help, Upgrade plan, Get apps and extensions, What's new, Learn more, Get an API key and Sign out.
claude.ai pages open in the web tab, the rest in the browser.

## Skills

The **Skills** view (`electron/claude/skills.cjs`) lists the open project's skills
(`.claude/skills`) and your personal ones (`~/.claude/skills`) with the name and description from
each SKILL.md. "+" makes a new skill with a SKILL.md to fill in; "Install from GitHub" downloads the
repository's archive (`api.github.com/repos/<owner>/<repo>/tarball`, or `gh api` for a private
one; no git needed, `electron/tar.cjs` unpacks it) into a temporary folder and copies every folder
with a SKILL.md into `~/.claude/skills` – only the linked folder's for a `…/tree/<branch>/<folder>`
link; "Use" puts `/name` into the message to Claude; "Remove" moves a skill to the
recycle bin.

## Pictures and files

The paperclip in the Claude panel (or dropping files on the message box, or pasting a screenshot)
adds attachments to the next message (`electron/claude/attachments.cjs`). Each is saved in Moon
Code's data folder (`attachments/<chat>/`, pruned after 30 days), which the chat may read
(`--add-dir`); the message lists every saved file with its path, and pictures (PNG, JPEG, GIF,
WebP up to 5 MB) also go into the message itself as image blocks, so Claude sees them at once.
Files up to 25 MB are taken.

## Axo

Axo, the white pixel axolotl in the Claude panel, shows what Claude is up to: asleep (not signed
in), waiting (it blinks), coding (it types on its moon laptop, and the line next to it says what
Claude is doing – "Editing src/App.tsx…"), and done (it cheers for a moment). Settings can hide it.

## Projects

After you sign in, **Projects** lists:

- **With Claude on this computer** – every folder Claude Code has had a conversation in (from
  `~/.claude/projects`) and the projects in `~/.claude.json`, newest first, with the branch. The
  clock button lists a project's conversations; picking one opens the folder and **continues that
  conversation** (`--resume`).
- **On GitHub** – your repositories: through the GitHub CLI when `gh` is signed in (private ones
  too), otherwise the public repositories of the owner set in Settings (`Luna-OS` by default). A
  click clones a repository into the projects folder (`~/Moon Code Projects`) and opens it.

## The panel

- **Account card**: e-mail, plan (Pro / Max / …), Claude Code version, the two limits as moons,
  and "Check now".
- **Model**: Default (what your plan uses), Opus 5.5, Sonnet 5.5, Haiku 4.5, Fable 5.1.
- **Permissions**: Ask, Edit files (the default), Plan only, Do everything. When Claude wanted to
  run something that needs your OK, the chat says what it was; **Allow and continue** adds exactly
  that (for example `Bash(npm test)`) to the conversation's allowed tools and lets Claude go on.
- **Effort**: Default, Low … Max (`--effort`).
- **@file**: mentions the open file. In the editor, select code and press **Ctrl+Shift+L** (or
  right-click → "Ask Claude about this") to bring it into the message box.
- The status bar shows the model, how much of the context the conversation uses and both limits.

Changing the model, the permissions or the folder restarts Claude Code with `--resume`, so the
conversation goes on with the new settings.
