import { BranchIcon, ExternalIcon, LogoutIcon, ReloadIcon } from "../theme/icons";
import type { GitHubAccount } from "../lib/types";

/**
 * The GitHub account, through the GitHub CLI: who is signed in, or the button that signs in (in a
 * terminal tab, `gh auth login`), or the one that installs the CLI first.
 */
export function GitHubCard({
  account,
  onSignIn,
  onSignOut,
  onInstall,
  onRefresh,
  onOpen,
}: {
  account: GitHubAccount | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onInstall: () => void;
  onRefresh: () => void;
  onOpen: (url: string) => void;
}) {
  if (!account) {
    return (
      <div className="mc-inset p-2.5 text-[0.75rem] text-[var(--mc-text-faint)]">
        Looking for GitHub…
      </div>
    );
  }
  if (!account.installed) {
    return (
      <div className="mc-inset flex flex-col gap-2 p-2.5 text-[0.75rem] text-[var(--mc-text-muted)]">
        <span>Sign in with GitHub through the GitHub CLI. Install it once:</span>
        <div className="flex gap-1.5">
          <button type="button" className="mc-btn mc-btn-primary mc-btn-sm" onClick={onInstall}>
            Install GitHub CLI
          </button>
          <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" onClick={onRefresh}>
            <ReloadIcon size={12} /> I installed it
          </button>
        </div>
      </div>
    );
  }
  if (!account.loggedIn) {
    return (
      <div className="mc-inset flex items-center gap-2 p-2.5 text-[0.75rem] text-[var(--mc-text-muted)]">
        <span className="min-w-0 flex-1">Your repositories, private ones too, and the cloud.</span>
        <button type="button" className="mc-btn mc-btn-primary mc-btn-sm" onClick={onSignIn}>
          <BranchIcon /> Sign in with GitHub
        </button>
      </div>
    );
  }
  return (
    <div className="mc-inset flex items-center gap-2 p-2" aria-label="GitHub account">
      {account.avatar ? (
        <img src={account.avatar} alt="" width={28} height={28} className="rounded-full" />
      ) : (
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full"
          style={{ background: "var(--mc-selected)", color: "var(--mc-accent)" }}
        >
          <BranchIcon />
        </span>
      )}
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[0.8125rem] font-semibold">@{account.login}</div>
        <div className="truncate text-[0.6875rem] text-[var(--mc-text-muted)]">
          {account.name ? `${account.name} · ` : ""}GitHub
        </div>
      </div>
      {account.url && (
        <button
          type="button"
          className="mc-icon-btn"
          style={{ width: 24, height: 24 }}
          aria-label="Open on GitHub"
          title="Open on GitHub"
          onClick={() => onOpen(account.url ?? "")}
        >
          <ExternalIcon />
        </button>
      )}
      <button
        type="button"
        className="mc-icon-btn"
        style={{ width: 24, height: 24 }}
        aria-label="Sign out of GitHub"
        title="Sign out of GitHub"
        onClick={onSignOut}
      >
        <LogoutIcon size={14} />
      </button>
    </div>
  );
}
