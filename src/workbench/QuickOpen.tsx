import { useEffect, useMemo, useRef, useState } from "react";
import { FileIcon } from "../theme/icons";
import { fuzzyScore } from "../lib/fuzzy";
import { kindColor } from "../lib/languages";

export interface Command {
  id: string;
  label: string;
  keys?: string;
  run: () => void;
}

/**
 * The quick pick at the top of the window: go to a file (Ctrl+P) or, starting with ">", run a
 * command (Ctrl+Shift+P).
 */
export function QuickOpen({
  files,
  commands,
  initial,
  onOpenFile,
  onClose,
}: {
  files: string[] | null;
  commands: Command[];
  initial: string;
  onOpenFile: (rel: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initial);
  const [index, setIndex] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const isCommand = query.startsWith(">");

  const items = useMemo(() => {
    if (isCommand) {
      const q = query.slice(1).trim();
      return commands
        .map((c) => ({ c, s: fuzzyScore(q, c.label) }))
        .filter((x) => x.s >= 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => ({
          key: x.c.id,
          label: x.c.label,
          hint: x.c.keys ?? "",
          run: x.c.run,
          file: null,
        }));
    }
    return (files ?? [])
      .map((f) => ({ f, s: fuzzyScore(query.trim(), f) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 60)
      .map((x) => {
        const slash = x.f.lastIndexOf("/");
        return {
          key: x.f,
          label: x.f.slice(slash + 1),
          hint: slash > 0 ? x.f.slice(0, slash) : "",
          run: () => onOpenFile(x.f),
          file: x.f,
        };
      });
  }, [query, isCommand, commands, files, onOpenFile]);

  useEffect(() => {
    list.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const pick = (i: number) => {
    const item = items[i];
    if (!item) return;
    onClose();
    item.run();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center pt-12">
      {/* The backdrop closes the picker on a click; Escape does the same from the keyboard. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className="absolute inset-0" onClick={onClose} />
      <div
        role="dialog"
        aria-label={isCommand ? "Commands" : "Go to file"}
        className="mc-popover relative flex h-fit max-h-[60vh] w-[min(620px,92vw)] flex-col overflow-hidden p-1.5"
      >
        <input
          // The picker exists to be typed into.
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          className="mc-input w-full"
          placeholder={
            isCommand
              ? "Type a command"
              : files
                ? "Search files by name (type > for commands)"
                : "Open a folder first (type > for commands)"
          }
          aria-label={isCommand ? "Command" : "File name"}
          role="combobox"
          aria-expanded="true"
          aria-controls="mc-quick-list"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            else if (e.key === "ArrowDown") setIndex((i) => Math.min(items.length - 1, i + 1));
            else if (e.key === "ArrowUp") setIndex((i) => Math.max(0, i - 1));
            else if (e.key === "Enter") pick(index);
            else return;
            e.preventDefault();
          }}
        />
        <div ref={list} id="mc-quick-list" role="listbox" className="mt-1 min-h-0 overflow-auto">
          {items.map((it, i) => (
            <div
              key={it.key}
              role="option"
              tabIndex={-1}
              aria-selected={i === index}
              data-index={i}
              className="mc-menu-item w-full"
              style={{ background: i === index ? "var(--mc-selected)" : undefined }}
              onMouseMove={() => setIndex(i)}
              onClick={() => pick(i)}
              onKeyDown={() => {}}
            >
              {it.file && (
                <span style={{ color: kindColor(it.file) }}>
                  <FileIcon size={14} />
                </span>
              )}
              <span className="shrink-0">{it.label}</span>
              <span className="min-w-0 flex-1 truncate text-right text-[0.75rem] text-[var(--mc-text-faint)]">
                {it.hint}
              </span>
            </div>
          ))}
          {items.length === 0 && (
            <div className="px-3 py-2 text-[0.8125rem] text-[var(--mc-text-muted)]">
              Nothing found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
