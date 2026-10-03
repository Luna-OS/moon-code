# Moon Code – instructions for agents

## Language: English only

Everything in this repository and in the app is written in **English**, even when a request,
issue or task description is written in German (or any other language): translate the intent, and
write the result in English. That covers the app UI (labels, menus, dialogs, toasts, tooltips,
`aria-label`s, placeholders, sample data), the code (identifiers, comments, log messages, test
names), files and docs, and git (commit messages, PR titles and descriptions).

Before opening a pull request, check your changes for umlauts and German words:

```sh
git diff origin/main --name-only | xargs grep -n -P "[\x{C4}\x{D6}\x{DC}\x{E4}\x{F6}\x{FC}\x{DF}]"
```

## The Moon look

Moon Code is one of the Luna-OS Moon apps. `src/theme/tokens.css` keeps the family's `@theme`
palette value for value (see `docs/theme.md`); components use the `--mc-*` variables and the
`.mc-*` classes, never raw colours. The editor's colours live in `src/theme/monaco-theme.ts`, the
terminal's in `src/workbench/TerminalView.tsx`. Keep all three in step when the palette changes.

## Claude

Moon Code never calls the Claude API itself and never reads the login's tokens: it runs the user's
Claude Code CLI (`electron/claude/`). Chats use `claude -p --input-format stream-json
--output-format stream-json --verbose --include-partial-messages`; `electron/claude/events.cjs`
turns its lines into the panel's events and is tested with lines in the shapes the CLI prints. See
`docs/claude.md`.

## Checks before a pull request

All of these must pass:

```sh
npm run build
npm run lint
npm test
npx prettier --check .
```

## Skills

`.claude/skills/replica-*` is the Replica skill pack (MIT, Jake Schincariol). `replica/` holds its
recon map and feature matrix for Moon Code.
