# Recon map: a desktop code editor (Windows)

Scope: the everyday editing loop of a desktop code editor, plus an AI side panel
For: Luna, inside the Luna-OS "Moon" app family
Date: 2026-10-03

Built clean-room: the editor component is Monaco (MIT, used as a library), every screen,
label, icon and colour is Moon Code's own. The feature matrix and parity score are in
`features.csv` (`python3 .claude/skills/replica-diff/parity.py replica/features.csv`).

## Core loop

Open a folder, open files from the tree or by name, edit, save, run things in a terminal –
and ask Claude to read, change and run the code in that folder.

## Screens

| ID | screen | how to reach | key components |
| --- | --- | --- | --- |
| S01 | Workbench | start | title bar, activity bar, side bar, tabs, editor, panel, status bar |
| S02 | Welcome | no file open | open folder, recent folders, keys |
| S03 | Explorer | Ctrl+Shift+E | file tree, new file/folder, rename, delete |
| S04 | Search | Ctrl+Shift+F | query, case / word / regex, results by file |
| S05 | Projects | Ctrl+Shift+O | Claude Code projects, their conversations, GitHub repositories |
| S06 | Claude | Ctrl+L | account, 5-hour and weekly limits, chat, model / permissions / effort |
| S07 | Terminal | Ctrl+` | terminal tabs |
| S08 | Quick open | Ctrl+P, Ctrl+Shift+P | files, commands |
| S09 | Settings | Ctrl+, | theme, font size, wrap, minimap, GitHub owner, clone folder |

## Flows

```
F01 open and edit a file      S02 -> S03 -> S01 (edit, Ctrl+S)
F02 sign in with Claude        S06 "Sign in" -> S07 (claude auth login) -> S06 + S05 filled
F03 ask Claude                 S06 type, Enter -> answer, tool cards, limits update
F04 continue a conversation    S05 history -> S06 resumed in the project's folder
F05 clone a repository         S05 "On GitHub" -> clone -> S03
```

## Out of scope

- The extensions marketplace (a network, not a feature).
- Debugger, source control view and split editors: later (see the missing list of parity.py).
