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
