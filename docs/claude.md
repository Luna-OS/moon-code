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

The **Cloud** view hands work to Claude Code on the web. It needs your Claude account and your GitHub
account, and lists your repositories: the open folder's is picked to begin with, and any other can
be picked instead – Moon Code clones it into the projects folder first (once), because
`claude --cloud` works on the repository of the folder it runs in (the first time, claude.ai/code asks to
connect the repository through Claude's GitHub app). Every action runs your Claude Code:

| Button | What runs |
| --- | --- |
| Start in the cloud | `claude --cloud "<the task>"` in a terminal tab – a new cloud session on the repository |
| Open here | the session in Moon Code's **Cloud tab** |
| Message | `claude -p "<message>" --cloud <session> --output-format json` – queues a follow-up into the session |
| Bring here | `claude --teleport <session>` in a terminal tab, in a checkout of the session's repository |
| Bring one here | `claude --teleport` – pick a cloud session and continue it on this computer |
| Remote Control | `claude --remote-control <folder name>` – steer this session from your phone or claude.ai |
| Ultrareview | `claude ultrareview` – a cloud review of the current branch by several agents |
| All sessions | claude.ai/code in the Cloud tab |

The tasks you start are listed under "Started from Moon Code", each with its session once
`claude --cloud` printed the link. A session link or ID can also be pasted.

### The Cloud tab

Cloud sessions run and are followed **inside Moon Code**, not in a browser or the Claude app:
claude.ai/code opens as a tab next to your files (`src/workbench/CloudWeb.tsx`, an Electron
`<webview>`).

- When `claude --cloud` prints "Open in browser: https://claude.ai/code/session_…", Moon Code
  picks the link up from the terminal (`electron/cloud.cjs`, also from OSC 8 links), remembers it
  with the task and opens the session in the Cloud tab. Links to claude.ai/code clicked in a
  terminal or in the chat open there too.
- The tab has its own browser session (`persist:claude-web`): sign in to claude.ai there once and
  it stays signed in. That sign-in is the website's own; Moon Code doesn't read it.
- It only ever starts on claude.ai, without Node and without a preload. Sign-in windows (Google,
  Apple, GitHub's sign-in and app installation) open as small Moon Code windows with the same
  session; every other link opens in your browser.
- The user agent leaves out Electron's token, since some sign-in pages turn away browsers they
  don't know. If Google's sign-in still refuses, sign in with your email address.
- "Browser" in the tab's toolbar opens the page in your browser after all.

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
