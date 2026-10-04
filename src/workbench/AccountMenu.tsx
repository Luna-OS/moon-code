import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronIcon, ExternalIcon } from "../theme/icons";
import { planName } from "../lib/usage";
import type { ClaudeAccount } from "../lib/types";

/** The languages Claude can be asked to answer in (null: the language you write in). */
const LANGUAGES = [
  "English",
  "German",
  "French",
  "Spanish",
  "Italian",
  "Portuguese",
  "Dutch",
  "Polish",
  "Turkish",
  "Ukrainian",
  "Japanese",
  "Korean",
  "Chinese",
];

const LINKS = {
  apps: "https://claude.ai/download",
  docs: "https://code.claude.com/docs",
  moonCode: "https://github.com/Luna-OS/moon-code",
  report: "https://github.com/Luna-OS/moon-code/issues/new",
  moonCodeChanges: "https://github.com/Luna-OS/moon-code/releases",
  claudeCodeChanges: "https://code.claude.com/docs/en/changelog",
  claudeCode: "https://claude.com/product/claude-code",
  privacy: "https://www.anthropic.com/legal/privacy",
  terms: "https://www.anthropic.com/legal/consumer-terms",
  usagePolicy: "https://www.anthropic.com/legal/aup",
  apiKeys: "https://platform.claude.com/settings/keys",
};

type Sub = "language" | "help" | "changes" | "more" | null;

/**
 * The account menu of the activity bar, as in the Claude app: usage, Claude's language, help,
 * upgrading, the apps, what's new, more about Claude, an API key – and signing in or out. Pages of
 * claude.ai open in Moon Code's web tab, everything else in the browser.
 */
export function AccountMenu({
  account,
  language,
  onLanguage,
  onUsage,
  onOpenWeb,
  onOpenExternal,
  onShortcuts,
  onSignIn,
  onSignOut,
  onClose,
}: {
  account: ClaudeAccount | null;
  language: string | null;
  onLanguage: (language: string | null) => void;
  onUsage: () => void;
  onOpenWeb: (url: string) => void;
  onOpenExternal: (url: string) => void;
  onShortcuts: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onClose: () => void;
}) {
  const [sub, setSub] = useState<Sub>(null);
  const box = useRef<HTMLDivElement>(null);

  // Escape or a click elsewhere closes the menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    box.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  const run = (fn: () => void) => () => {
    fn();
    onClose();
  };
  const toggle = (s: Sub) => () => setSub((cur) => (cur === s ? null : s));
  const plan = planName(account?.plan);

  return (
    <div
      ref={box}
      role="menu"
      aria-label="Claude account"
      className="mc-popover fixed bottom-12 left-[52px] z-40 flex max-h-[80vh] w-[280px] flex-col overflow-auto p-1.5 text-[0.8125rem]"
    >
      {account?.loggedIn && (
        <div className="px-2.5 pb-2 pt-1.5">
          <div className="truncate font-semibold">{account.email ?? "Signed in"}</div>
          <div className="text-[0.75rem] text-[var(--mc-text-faint)]">
            {[plan && `${plan} plan`, account.organization].filter(Boolean).join(" · ") ||
              "Claude account"}
          </div>
        </div>
      )}
      <Item onClick={run(onUsage)}>Usage</Item>
      <Item onClick={toggle("language")} open={sub === "language"} hint={language ?? "Automatic"}>
        Claude&apos;s language
      </Item>
      {sub === "language" && (
        <div role="group" aria-label="Claude's language" className="mc-menu-sub">
          {[null, ...LANGUAGES].map((l) => (
            <button
              key={l ?? "auto"}
              type="button"
              role="menuitemradio"
              aria-checked={language === l}
              className="mc-menu-item"
              onClick={run(() => onLanguage(l))}
            >
              {l ?? "Automatic (the language you write in)"}
            </button>
          ))}
        </div>
      )}
      <Item onClick={toggle("help")} open={sub === "help"}>
        Help
      </Item>
      {sub === "help" && (
        <div role="group" aria-label="Help" className="mc-menu-sub">
          <Item onClick={run(() => onOpenExternal(LINKS.docs))} external>
            Claude Code docs
          </Item>
          <Item onClick={run(() => onOpenExternal(LINKS.moonCode))} external>
            Moon Code on GitHub
          </Item>
          <Item onClick={run(onShortcuts)}>All commands and keys</Item>
          <Item onClick={run(() => onOpenExternal(LINKS.report))} external>
            Report a problem
          </Item>
        </div>
      )}
      <div className="mc-menu-sep" role="separator" />
      <Item onClick={run(() => onOpenWeb("https://claude.ai/upgrade"))}>Upgrade plan</Item>
      <Item onClick={run(() => onOpenWeb(LINKS.apps))}>Get apps and extensions</Item>
      <Item onClick={toggle("changes")} open={sub === "changes"}>
        What&apos;s new
      </Item>
      {sub === "changes" && (
        <div role="group" aria-label="What's new" className="mc-menu-sub">
          <Item onClick={run(() => onOpenExternal(LINKS.moonCodeChanges))} external>
            Moon Code releases
          </Item>
          <Item onClick={run(() => onOpenExternal(LINKS.claudeCodeChanges))} external>
            Claude Code changelog
          </Item>
        </div>
      )}
      <Item onClick={toggle("more")} open={sub === "more"}>
        Learn more
      </Item>
      {sub === "more" && (
        <div role="group" aria-label="Learn more" className="mc-menu-sub">
          <Item onClick={run(() => onOpenExternal(LINKS.claudeCode))} external>
            About Claude Code
          </Item>
          <Item onClick={run(() => onOpenExternal(LINKS.usagePolicy))} external>
            Usage policy
          </Item>
          <Item onClick={run(() => onOpenExternal(LINKS.privacy))} external>
            Privacy policy
          </Item>
          <Item onClick={run(() => onOpenExternal(LINKS.terms))} external>
            Terms
          </Item>
        </div>
      )}
      <div className="mc-menu-sep" role="separator" />
      <Item onClick={run(() => onOpenExternal(LINKS.apiKeys))} external hint="Claude Platform">
        Get an API key
      </Item>
      <div className="mc-menu-sep" role="separator" />
      {account?.loggedIn ? (
        <Item onClick={run(onSignOut)}>Sign out</Item>
      ) : (
        <Item onClick={run(onSignIn)}>Sign in to Claude</Item>
      )}
    </div>
  );
}

function Item({
  children,
  onClick,
  open,
  external = false,
  hint,
}: {
  children: ReactNode;
  onClick: () => void;
  /** Set for an item that opens a group below it. */
  open?: boolean;
  external?: boolean;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className="mc-menu-item"
      aria-expanded={open}
      onClick={onClick}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="text-[0.6875rem] text-[var(--mc-text-faint)]">{hint}</span>}
      {external && (
        <span className="text-[var(--mc-text-faint)]">
          <ExternalIcon size={12} />
        </span>
      )}
      {open !== undefined && <ChevronIcon size={13} open={open} />}
    </button>
  );
}
