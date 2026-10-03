import { useCallback, useEffect, useState } from "react";
import {
  ClaudeIcon,
  CloudIcon,
  DownloadIcon,
  ExternalIcon,
  FolderIcon,
  HistoryIcon,
  ReloadIcon,
} from "../theme/icons";
import { timeAgo } from "../lib/format";
import { tildify } from "../lib/paths";
import type {
  ClaudeAccount,
  ClaudeProject,
  ClaudeSession,
  GitHubAccount,
  MoonCodeBridge,
  Repo,
} from "../lib/types";
import { GitHubCard } from "./GitHubCard";

/**
 * Every project you work on with Claude: the folders Claude Code knows on this computer (they
 * appear as soon as you are signed in) and your repositories on GitHub, which clone with a click.
 */
export function ProjectsView({
  bridge,
  account,
  home,
  currentFolder,
  onOpenFolder,
  onResume,
  onSignIn,
  onError,
  github,
  onGitHubSignIn,
  onGitHubSignOut,
  onGitHubInstall,
  onGitHubRefresh,
}: {
  bridge: MoonCodeBridge;
  account: ClaudeAccount | null;
  home: string | null;
  currentFolder: string | null;
  onOpenFolder: (path: string) => void;
  onResume: (project: string, session: ClaudeSession) => void;
  onSignIn: () => void;
  onError: (message: string) => void;
  github: GitHubAccount | null;
  onGitHubSignIn: () => void;
  onGitHubSignOut: () => void;
  onGitHubInstall: () => void;
  onGitHubRefresh: () => void;
}) {
  const [projects, setProjects] = useState<ClaudeProject[] | null>(null);
  const [repos, setRepos] = useState<{ source: string; repos: Repo[] } | null>(null);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Record<string, ClaudeSession[]>>({});
  const [cloning, setCloning] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const signedIn = Boolean(account?.loggedIn);
  const githubLogin = github?.loggedIn ? github.login : null;

  const loadProjects = useCallback(() => {
    if (!signedIn) return;
    bridge
      .claudeProjects()
      .then(setProjects)
      .catch((e: Error) => onError(e.message));
  }, [bridge, signedIn, onError]);

  const loadRepos = useCallback(
    // `login` is only there so that a GitHub sign-in or sign-out lists the repositories again.
    (_login: string | null) => {
      if (!signedIn) return;
      bridge
        .githubRepos()
        .then((r) => {
          setRepos(r);
          setRepoError(null);
        })
        .catch((e: Error) => setRepoError(e.message));
    },
    [bridge, signedIn],
  );

  const load = () => {
    loadProjects();
    loadRepos(githubLogin);
  };

  // Signing in is all it takes: the lists load as soon as the account is there.
  useEffect(loadProjects, [loadProjects]);
  useEffect(() => loadRepos(githubLogin), [loadRepos, githubLogin]);

  const toggleSessions = (p: ClaudeProject) => {
    if (open === p.path) {
      setOpen(null);
      return;
    }
    setOpen(p.path);
    if (!sessions[p.path]) {
      bridge
        .claudeSessions(p.path)
        .then((s) => setSessions((all) => ({ ...all, [p.path]: s })))
        .catch((e: Error) => onError(e.message));
    }
  };

  const cloneAndOpen = async (repo: Repo) => {
    setCloning(repo.name);
    try {
      onOpenFolder(await bridge.githubClone(repo.cloneUrl, repo.name));
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setCloning(null);
    }
  };

  if (!account) {
    return (
      <p className="p-4 text-[0.8125rem] text-[var(--mc-text-muted)]">Looking for Claude Code…</p>
    );
  }
  if (!signedIn) {
    return (
      <div className="flex flex-col gap-3 p-4 text-[0.8125rem] text-[var(--mc-text-muted)]">
        <div className="mc-section-title px-0">Projects</div>
        <p className="m-0">
          Sign in with your Claude account and every project you have worked on with Claude Code
          shows up here, together with your repositories.
        </p>
        <button type="button" className="mc-btn mc-btn-primary" onClick={onSignIn}>
          <ClaudeIcon size={15} /> Sign in with Claude
        </button>
      </div>
    );
  }

  const q = filter.trim().toLowerCase();
  const shownProjects = (projects ?? []).filter((p) => !q || p.name.toLowerCase().includes(q));
  const localNames = new Set((projects ?? []).map((p) => p.name.toLowerCase()));
  const shownRepos = (repos?.repos ?? []).filter(
    (r) => !q || r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mc-section-title">
        <span className="flex-1">Projects</span>
        <button
          type="button"
          className="mc-icon-btn"
          style={{ width: 24, height: 24 }}
          aria-label="Refresh projects"
          title="Refresh"
          onClick={load}
        >
          <ReloadIcon size={14} />
        </button>
      </div>
      <div className="px-3 pb-2">
        <input
          className="mc-input w-full"
          placeholder="Filter projects"
          aria-label="Filter projects"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-1.5 pb-3">
        <h3 className="mc-eyebrow m-0 flex items-center gap-1.5 px-2 pb-1 pt-1">
          <ClaudeIcon size={12} /> With Claude on this computer
        </h3>
        {projects === null && (
          <p className="m-0 px-2 text-[0.75rem] text-[var(--mc-text-faint)]">Loading…</p>
        )}
        {projects?.length === 0 && (
          <p className="m-0 px-2 text-[0.75rem] text-[var(--mc-text-faint)]">
            No projects yet. Open a folder and talk to Claude in it.
          </p>
        )}
        {shownProjects.map((p) => (
          <div key={p.path}>
            <div className="flex items-center">
              <button
                type="button"
                className="mc-row flex-col items-start gap-0 py-1"
                aria-current={currentFolder === p.path}
                disabled={!p.exists}
                title={p.exists ? `Open ${p.path}` : `${p.path} doesn't exist any more`}
                onClick={() => onOpenFolder(p.path)}
                style={{ opacity: p.exists ? 1 : 0.5 }}
              >
                <span className="flex w-full items-center gap-1.5">
                  <span style={{ color: "var(--mc-kind-folder)" }}>
                    <FolderIcon size={15} />
                  </span>
                  <span className="min-w-0 truncate font-medium">{p.name}</span>
                  {p.branch && <span className="mc-chip mc-chip-muted">{p.branch}</span>}
                </span>
                <span className="w-full truncate pl-[21px] text-[0.6875rem] text-[var(--mc-text-faint)]">
                  {tildify(p.path, home)}
                  {p.lastUsed ? ` · ${timeAgo(p.lastUsed)}` : ""}
                </span>
              </button>
              {p.sessionCount > 0 && (
                <button
                  type="button"
                  className="mc-icon-btn"
                  aria-expanded={open === p.path}
                  aria-label={`Conversations in ${p.name}`}
                  title={`${p.sessionCount} conversation${p.sessionCount === 1 ? "" : "s"}`}
                  onClick={() => toggleSessions(p)}
                >
                  <HistoryIcon size={14} />
                </button>
              )}
            </div>
            {open === p.path && (
              <div className="mb-1 ml-5 border-l border-[var(--mc-border)] pl-1">
                {!sessions[p.path] && (
                  <p className="m-0 px-2 text-[0.75rem] text-[var(--mc-text-faint)]">Loading…</p>
                )}
                {sessions[p.path]?.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="mc-row flex-col items-start gap-0 py-1"
                    title="Continue this conversation"
                    onClick={() => onResume(p.path, s)}
                  >
                    <span className="w-full truncate">{s.title ?? "Untitled conversation"}</span>
                    <span className="text-[0.6875rem] text-[var(--mc-text-faint)]">
                      {timeAgo(s.updated)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        <h3 className="mc-eyebrow m-0 flex items-center gap-1.5 px-2 pb-1 pt-4">
          <CloudIcon size={12} /> On GitHub
        </h3>
        <div className="px-1 pb-1.5">
          <GitHubCard
            account={github}
            onSignIn={onGitHubSignIn}
            onSignOut={onGitHubSignOut}
            onInstall={onGitHubInstall}
            onRefresh={onGitHubRefresh}
            onOpen={(url) => void bridge.openExternal(url)}
          />
        </div>
        {repoError && (
          <p className="m-0 px-2 text-[0.75rem] text-[var(--mc-danger)]">{repoError}</p>
        )}
        {!repos && !repoError && (
          <p className="m-0 px-2 text-[0.75rem] text-[var(--mc-text-faint)]">Loading…</p>
        )}
        {repos?.source === "none" && (
          <p className="m-0 px-2 text-[0.75rem] text-[var(--mc-text-faint)]">
            Sign in to the GitHub CLI (gh auth login) or set a GitHub owner in Settings.
          </p>
        )}
        {shownRepos.map((r) => {
          const local = (projects ?? []).find(
            (p) => p.name.toLowerCase() === r.name.toLowerCase() && p.exists,
          );
          return (
            <div key={r.fullName} className="flex items-center">
              <button
                type="button"
                className="mc-row flex-col items-start gap-0 py-1"
                title={local ? `Open ${local.path}` : `Clone ${r.fullName} and open it`}
                disabled={cloning !== null}
                onClick={() => (local ? onOpenFolder(local.path) : void cloneAndOpen(r))}
              >
                <span className="flex w-full items-center gap-1.5">
                  <span className="min-w-0 truncate font-medium">{r.name}</span>
                  {r.private && <span className="mc-chip mc-chip-muted">private</span>}
                  {localNames.has(r.name.toLowerCase()) && (
                    <span className="mc-chip mc-chip-mint">local</span>
                  )}
                  {cloning === r.name && <span className="mc-chip">cloning…</span>}
                </span>
                <span className="w-full truncate text-[0.6875rem] text-[var(--mc-text-faint)]">
                  {[r.language, r.description, r.updated ? timeAgo(r.updated) : ""]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
              {!local && (
                <button
                  type="button"
                  className="mc-icon-btn"
                  aria-label={`Clone ${r.name}`}
                  title="Clone and open"
                  disabled={cloning !== null}
                  onClick={() => void cloneAndOpen(r)}
                >
                  <DownloadIcon size={14} />
                </button>
              )}
              <button
                type="button"
                className="mc-icon-btn"
                aria-label={`${r.name} on GitHub`}
                title="Open on GitHub"
                onClick={() => void bridge.openExternal(r.url)}
              >
                <ExternalIcon />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
