import { ClaudeIcon, FolderIcon, ProjectsIcon, FileIcon, NewFileIcon } from "../theme/icons";
import { tildify, basename } from "../lib/paths";

/** The start page when no file is open: open a folder, recent folders, the keys to know. */
export function Welcome({
  recent,
  home,
  folder,
  onOpenFolder,
  onOpenFile,
  onNewFile,
  onOpenRecent,
  onProjects,
  onClaude,
}: {
  recent: string[];
  home: string | null;
  folder: string | null;
  onOpenFolder: () => void;
  onOpenFile?: () => void;
  onNewFile?: () => void;
  onOpenRecent: (path: string) => void;
  onProjects: () => void;
  onClaude: () => void;
}) {
  const keys: [string, string][] = [
    ["Open file", "Ctrl O"],
    ["New file", "Ctrl N"],
    ["Go to file", "Ctrl P"],
    ["Commands", "Ctrl Shift P"],
    ["Claude", "Ctrl L"],
    ["Terminal", "Ctrl `"],
    ["Search in files", "Ctrl Shift F"],
    ["Save", "Ctrl S"],
  ];
  return (
    <div className="relative flex h-full items-center justify-center overflow-auto p-8">
      <div className="flex w-full max-w-[760px] flex-col gap-8">
        <div className="flex items-center gap-4">
          <img src="./moon-code-logo.svg" alt="" width={72} height={72} draggable={false} />
          <div>
            <h1 className="mc-title m-0 text-[2rem] font-semibold tracking-tight">Moon Code</h1>
            <p className="m-0 text-[var(--mc-text-muted)]">
              {folder
                ? `${basename(folder)} is open. Pick a file, or ask Claude.`
                : "Code under the night sky, with Claude at your side."}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <section className="flex flex-col gap-2">
            <h2 className="mc-eyebrow m-0">Start</h2>
            <button type="button" className="mc-row" onClick={onOpenFolder}>
              <span style={{ color: "var(--mc-kind-folder)" }}>
                <FolderIcon size={15} />
              </span>
              Open folder…
            </button>
            {onOpenFile && (
              <button type="button" className="mc-row" onClick={onOpenFile}>
                <span style={{ color: "var(--mc-kind-file)" }}>
                  <FileIcon size={15} />
                </span>
                Open file…
              </button>
            )}
            {onNewFile && (
              <button type="button" className="mc-row" onClick={onNewFile}>
                <span style={{ color: "var(--mc-accent)" }}>
                  <NewFileIcon size={15} />
                </span>
                New file
              </button>
            )}
            <button type="button" className="mc-row" onClick={onProjects}>
              <span style={{ color: "var(--mc-kind-image)" }}>
                <ProjectsIcon size={15} />
              </span>
              Your projects
            </button>
            <button type="button" className="mc-row" onClick={onClaude}>
              <span style={{ color: "var(--mc-claude)" }}>
                <ClaudeIcon size={15} />
              </span>
              Ask Claude
            </button>
            {recent.length > 0 && (
              <>
                <h2 className="mc-eyebrow m-0 mt-4">Recent</h2>
                {recent.slice(0, 6).map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="mc-row"
                    title={r}
                    onClick={() => onOpenRecent(r)}
                  >
                    <span className="shrink-0 font-medium">{basename(r)}</span>
                    <span className="min-w-0 truncate text-[0.75rem] text-[var(--mc-text-faint)]">
                      {tildify(r, home)}
                    </span>
                  </button>
                ))}
              </>
            )}
          </section>
          <section className="mc-glass flex flex-col gap-2 p-4">
            <h2 className="mc-eyebrow m-0">Keys</h2>
            {keys.map(([label, k]) => (
              <div key={label} className="flex items-center justify-between text-[0.8125rem]">
                <span className="text-[var(--mc-text-muted)]">{label}</span>
                <span className="flex gap-1">
                  {k.split(" ").map((p) => (
                    <span key={p} className="mc-kbd">
                      {p}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
