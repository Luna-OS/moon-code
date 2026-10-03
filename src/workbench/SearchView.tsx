import { useEffect, useRef, useState } from "react";
import { ChevronIcon, FileIcon } from "../theme/icons";
import { kindColor } from "../lib/languages";
import { resolveIn } from "../lib/paths";
import type { MoonCodeBridge, SearchHit } from "../lib/types";

/** Text search across the open folder, as you type. */
export function SearchView({
  bridge,
  root,
  onOpen,
}: {
  bridge: MoonCodeBridge;
  root: string | null;
  onOpen: (path: string, line: number, column: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [regex, setRegex] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const run = useRef(0);

  useEffect(() => {
    const id = ++run.current;
    if (!root || !query) return;
    const t = setTimeout(() => {
      setBusy(true);
      bridge
        .search(root, { query, caseSensitive, wholeWord, regex })
        .then((h) => {
          if (run.current !== id) return;
          setHits(h);
          setError(null);
        })
        .catch((e: Error) => run.current === id && setError(e.message))
        .finally(() => run.current === id && setBusy(false));
    }, 220);
    return () => clearTimeout(t);
  }, [bridge, root, query, caseSensitive, wholeWord, regex]);

  // Without a query there is nothing to show (the last results stay in state until the next search).
  const shown = root && query ? hits : [];
  const total = shown.reduce((n, h) => n + h.matches.length, 0);
  const toggle = (opt: boolean, set: (v: boolean) => void, label: string, text: string) => (
    <button
      type="button"
      className="mc-icon-btn"
      style={{ width: 24, height: 22, fontSize: 11, fontWeight: 700 }}
      aria-pressed={opt}
      aria-label={label}
      title={label}
      onClick={() => set(!opt)}
    >
      {text}
    </button>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mc-section-title">Search</div>
      <div className="flex flex-col gap-1.5 px-3 pb-2">
        <div
          className="mc-input flex items-center gap-1 pr-1"
          style={{ padding: "0 0.25rem 0 0.6rem" }}
        >
          <input
            className="min-w-0 flex-1 border-0 bg-transparent text-[var(--mc-text)] outline-none"
            style={{ font: "inherit", fontSize: "0.8125rem" }}
            placeholder="Search"
            aria-label="Search the folder"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={!root}
          />
          {toggle(caseSensitive, setCaseSensitive, "Match case", "Aa")}
          {toggle(wholeWord, setWholeWord, "Whole word", "ab")}
          {toggle(regex, setRegex, "Regular expression", ".*")}
        </div>
        <span className="text-[0.6875rem] text-[var(--mc-text-faint)]" aria-live="polite">
          {!root
            ? "Open a folder to search it."
            : error
              ? error
              : busy
                ? "Searching…"
                : query
                  ? `${total} result${total === 1 ? "" : "s"} in ${shown.length} file${shown.length === 1 ? "" : "s"}`
                  : ""}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-1.5 pb-3">
        {root &&
          shown.map((hit) => {
            const open = !collapsed.has(hit.file);
            return (
              <div key={hit.file}>
                <button
                  type="button"
                  className="mc-row"
                  aria-expanded={open}
                  onClick={() =>
                    setCollapsed((s) => {
                      const n = new Set(s);
                      if (n.has(hit.file)) n.delete(hit.file);
                      else n.add(hit.file);
                      return n;
                    })
                  }
                >
                  <ChevronIcon size={12} open={open} />
                  <span style={{ color: kindColor(hit.file) }}>
                    <FileIcon size={14} />
                  </span>
                  <span className="min-w-0 truncate">{hit.file}</span>
                  <span className="mc-chip mc-chip-muted ml-auto">{hit.matches.length}</span>
                </button>
                {open &&
                  hit.matches.map((m) => (
                    <button
                      key={`${m.line}:${m.column}`}
                      type="button"
                      className="mc-row font-[var(--font-mono)] text-[0.75rem]"
                      style={{ paddingLeft: 34 }}
                      onClick={() => onOpen(resolveIn(root, hit.file), m.line, m.column)}
                    >
                      <span className="w-7 shrink-0 text-right text-[var(--mc-text-faint)]">
                        {m.line}
                      </span>
                      <span className="min-w-0 truncate">
                        {m.text.slice(Math.max(0, m.column - 30), m.column - 1)}
                        <mark
                          style={{
                            background:
                              "color-mix(in srgb, var(--color-warning-400) 35%, transparent)",
                            color: "inherit",
                            borderRadius: 3,
                          }}
                        >
                          {m.text.slice(m.column - 1, m.column - 1 + m.length)}
                        </mark>
                        {m.text.slice(m.column - 1 + m.length)}
                      </span>
                    </button>
                  ))}
              </div>
            );
          })}
      </div>
    </div>
  );
}
