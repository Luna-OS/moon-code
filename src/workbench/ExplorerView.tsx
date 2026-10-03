import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import {
  ChevronIcon,
  FileIcon,
  FolderIcon,
  NewFileIcon,
  NewFolderIcon,
  ReloadIcon,
} from "../theme/icons";
import { basename, dirname, join } from "../lib/paths";
import { kindColor } from "../lib/languages";
import type { DirEntry, MoonCodeBridge } from "../lib/types";

type Pending = { kind: "file" | "folder"; dir: string } | { kind: "rename"; path: string } | null;

/** The open folder as a tree: open files, make, rename and delete files and folders. */
export function ExplorerView({
  bridge,
  root,
  activePath,
  onOpenFile,
  onOpenFolder,
  onRenamed,
  onDeleted,
  onError,
}: {
  bridge: MoonCodeBridge;
  root: string | null;
  activePath: string | null;
  onOpenFile: (path: string) => void;
  onOpenFolder: () => void;
  onRenamed: (from: string, to: string) => void;
  onDeleted: (path: string) => void;
  onError: (message: string) => void;
}) {
  const [children, setChildren] = useState<Record<string, DirEntry[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);

  const load = useCallback(
    async (dir: string) => {
      try {
        const entries = await bridge.readDir(dir);
        setChildren((c) => ({ ...c, [dir]: entries }));
      } catch (e) {
        onError((e as Error).message);
      }
    },
    [bridge, onError],
  );

  // The view is remounted for another folder (key={root} in App), so this runs once per folder.
  useEffect(() => {
    if (!root) return;
    let cancelled = false;
    bridge
      .readDir(root)
      .then((entries) => !cancelled && setChildren((c) => ({ ...c, [root]: entries })))
      .catch((e: Error) => onError(e.message));
    return () => {
      cancelled = true;
    };
  }, [bridge, root, onError]);

  const refresh = () => {
    if (!root) return;
    void load(root);
    for (const d of expanded) void load(d);
  };

  const toggle = (dir: string) => {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(dir)) n.delete(dir);
      else {
        n.add(dir);
        if (!children[dir]) void load(dir);
      }
      return n;
    });
  };

  /** The folder new items go into: the selected folder, the selected file's folder, or the root. */
  const targetDir = () => {
    if (!root) return null;
    if (!selected) return root;
    const isDir = Object.values(children).some((list) =>
      list.some((e) => e.path === selected && e.isDir),
    );
    return isDir ? selected : dirname(selected);
  };

  const startNew = (kind: "file" | "folder") => {
    const dir = targetDir();
    if (!dir) return;
    if (dir !== root && !expanded.has(dir)) toggle(dir);
    setPending({ kind, dir });
  };

  const commit = async (name: string) => {
    const p = pending;
    setPending(null);
    if (!p || !name.trim()) return;
    try {
      if (p.kind === "rename") {
        const to = join(dirname(p.path), name.trim());
        if (to === p.path) return;
        await bridge.rename(p.path, to);
        onRenamed(p.path, to);
        await load(dirname(p.path));
        setSelected(to);
      } else {
        const target = join(p.dir, name.trim());
        if (p.kind === "file") await bridge.createFile(target);
        else await bridge.createFolder(target);
        await load(p.dir);
        setSelected(target);
        if (p.kind === "file") onOpenFile(target);
      }
    } catch (e) {
      onError((e as Error).message);
    }
  };

  const remove = async (entry: DirEntry) => {
    if (!window.confirm(`Move "${entry.name}" to the recycle bin?`)) return;
    try {
      await bridge.trash(entry.path);
      onDeleted(entry.path);
      await load(dirname(entry.path));
    } catch (e) {
      onError((e as Error).message);
    }
  };

  const onRowKey = (e: KeyboardEvent, entry: DirEntry) => {
    if (e.key === "F2") {
      e.preventDefault();
      setPending({ kind: "rename", path: entry.path });
    } else if (e.key === "Delete") {
      e.preventDefault();
      void remove(entry);
    }
  };

  const renderInput = (depth: number, initial: string, isDir: boolean) => (
    <div className="flex items-center gap-1 py-0.5" style={{ paddingLeft: 8 + depth * 12 }}>
      <span style={{ color: isDir ? "var(--mc-kind-folder)" : "var(--mc-kind-file)" }}>
        {isDir ? <FolderIcon size={15} /> : <FileIcon size={15} />}
      </span>
      <input
        // A new name is typed right away.
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        className="mc-input w-full"
        style={{ height: "1.5rem" }}
        aria-label={isDir ? "Folder name" : "File name"}
        defaultValue={initial}
        onFocus={(e) => {
          const dot = initial.lastIndexOf(".");
          e.currentTarget.setSelectionRange(0, dot > 0 ? dot : initial.length);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") void commit(e.currentTarget.value);
          if (e.key === "Escape") setPending(null);
        }}
        onBlur={(e) => void commit(e.currentTarget.value)}
      />
    </div>
  );

  const renderDir = (dir: string, depth: number): React.ReactNode => {
    const list = children[dir];
    return (
      <>
        {pending &&
          pending.kind !== "rename" &&
          pending.dir === dir &&
          renderInput(depth, "", pending.kind === "folder")}
        {list?.map((entry) => {
          const open = expanded.has(entry.path);
          if (pending?.kind === "rename" && pending.path === entry.path) {
            return <div key={entry.path}>{renderInput(depth, entry.name, entry.isDir)}</div>;
          }
          return (
            <div key={entry.path} role="none">
              <button
                type="button"
                role="treeitem"
                aria-expanded={entry.isDir ? open : undefined}
                aria-selected={selected === entry.path || activePath === entry.path}
                className="mc-row"
                style={{ paddingLeft: 6 + depth * 12 }}
                title={entry.path}
                onClick={() => {
                  setSelected(entry.path);
                  if (entry.isDir) toggle(entry.path);
                  else onOpenFile(entry.path);
                }}
                onKeyDown={(e) => onRowKey(e, entry)}
              >
                <span className="w-3.5 text-[var(--mc-text-faint)]">
                  {entry.isDir && <ChevronIcon size={12} open={open} />}
                </span>
                <span
                  style={{ color: entry.isDir ? "var(--mc-kind-folder)" : kindColor(entry.path) }}
                >
                  {entry.isDir ? <FolderIcon size={15} open={open} /> : <FileIcon size={15} />}
                </span>
                <span className="min-w-0 truncate">{entry.name}</span>
              </button>
              {entry.isDir && open && <div role="group">{renderDir(entry.path, depth + 1)}</div>}
            </div>
          );
        })}
      </>
    );
  };

  if (!root) {
    return (
      <div className="flex flex-col gap-3 p-4 text-[0.8125rem] text-[var(--mc-text-muted)]">
        <p className="m-0">No folder is open.</p>
        <button type="button" className="mc-btn mc-btn-primary" onClick={onOpenFolder}>
          Open folder…
        </button>
        <p className="m-0 text-[0.75rem]">Or pick one of your Claude projects in Projects.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mc-section-title">
        <span className="min-w-0 flex-1 truncate" title={root}>
          {basename(root)}
        </span>
        <button
          type="button"
          className="mc-icon-btn"
          style={{ width: 24, height: 24 }}
          aria-label="New file"
          title="New file"
          onClick={() => startNew("file")}
        >
          <NewFileIcon size={14} />
        </button>
        <button
          type="button"
          className="mc-icon-btn"
          style={{ width: 24, height: 24 }}
          aria-label="New folder"
          title="New folder"
          onClick={() => startNew("folder")}
        >
          <NewFolderIcon size={14} />
        </button>
        <button
          type="button"
          className="mc-icon-btn"
          style={{ width: 24, height: 24 }}
          aria-label="Refresh"
          title="Refresh"
          onClick={refresh}
        >
          <ReloadIcon size={14} />
        </button>
      </div>
      <div role="tree" aria-label="Files" className="min-h-0 flex-1 overflow-auto px-1.5 pb-3">
        {renderDir(root, 0)}
      </div>
      <p className="m-0 px-3 pb-2 text-[0.6875rem] text-[var(--mc-text-faint)]">
        F2 renames, Delete moves to the recycle bin.
      </p>
    </div>
  );
}
