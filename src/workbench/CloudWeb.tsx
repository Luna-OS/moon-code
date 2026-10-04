import { useCallback, useEffect, useRef, useState } from "react";
import { AlertIcon, BackIcon, CloudIcon, ExternalIcon, ReloadIcon } from "../theme/icons";
import { pageScript } from "./cloud-page";
import { AXOLOTL_FRAMES } from "../mascot/frames";
import { toRects } from "../mascot/pixels";

/** Axo's pixels for the page (claude.ai's mascot becomes Axo). */
const AXO = toRects(AXOLOTL_FRAMES.idle[0]).map(
  (r) => [r.x, r.y, r.w, r.fill] as [number, number, number, string],
);

/** The <webview> methods and events the cloud tab uses. */
interface WebviewElement extends HTMLElement {
  executeJavaScript(code: string): Promise<unknown>;
  loadURL(url: string): Promise<void>;
  getURL(): string;
  canGoBack(): boolean;
  canGoForward(): boolean;
  goBack(): void;
  goForward(): void;
  reload(): void;
}

/** The webview's session (electron/cloud.cjs): the claude.ai sign-in stays between starts. */
const PARTITION = "persist:claude-web";

/** What the address line shows: the path on claude.ai, or the whole address elsewhere. */
function shortUrl(url: string) {
  try {
    const u = new URL(url);
    return u.hostname === "claude.ai" ? `claude.ai${u.pathname}` : `${u.hostname}${u.pathname}`;
  } catch {
    return url;
  }
}

/**
 * The cloud tab: Claude Code on the web (claude.ai/code) inside Moon Code, so cloud sessions are
 * followed and steered here instead of in a browser or the Claude app. The page runs in Electron's
 * <webview> with its own session; sign-in windows stay in Moon Code, other links go to the
 * browser (electron/main.cjs). In a plain browser (the demo) there is no webview, so the tab says
 * where the page would be.
 */
export function CloudWeb({
  url,
  nonce,
  embedded,
  visible,
  title = null,
  theme = "dark",
  onOpenExternal,
}: {
  url: string;
  /** Changes when the same address should load again. */
  nonce: number;
  /** False in the demo, where there is no <webview>. */
  embedded: boolean;
  visible: boolean;
  /** What the tab shows (the session's task, when Moon Code started it). */
  title?: string | null;
  /** Moon Code's theme: claude.ai is drawn in its colours. */
  theme?: "dark" | "light";
  onOpenExternal: (url: string) => void;
}) {
  const ref = useRef<WebviewElement | null>(null);
  const ready = useRef(false);
  const themeRef = useRef(theme);
  useEffect(() => {
    themeRef.current = theme;
  });
  /** The Moon colours in the page (cloud-page.ts). */
  const tune = useCallback(() => {
    const view = ref.current;
    if (!view || !ready.current) return;
    view.executeJavaScript(pageScript({ theme: themeRef.current, axo: AXO })).catch(() => {});
  }, []);
  useEffect(() => tune(), [theme, tune]);
  // claude.ai builds its pages bit by bit: look again every few seconds while the tab is shown.
  useEffect(() => {
    if (!visible || !embedded) return;
    const t = setInterval(tune, 3000);
    return () => clearInterval(t);
  }, [visible, embedded, tune]);
  /** The address asked for last (it may change before the page is ready). */
  const want = useRef(url);
  const [src] = useState(url);
  const [current, setCurrent] = useState(url);
  const [loading, setLoading] = useState(true);
  const [nav, setNav] = useState({ back: false, forward: false });
  /** Why the page didn't load (no connection, …), shown over it. */
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    const view = ref.current;
    if (!view) return;
    const sync = () => {
      setCurrent(view.getURL());
      setNav({ back: view.canGoBack(), forward: view.canGoForward() });
    };
    const onReady = () => {
      if (!ready.current) {
        ready.current = true;
        if (want.current !== src) void view.loadURL(want.current).catch(() => {});
      }
      sync();
      tune();
    };
    const onStart = () => {
      setLoading(true);
      setFailed(null);
    };
    const onFail = (e: Event) => {
      const { errorCode, errorDescription, isMainFrame } = e as Event & {
        errorCode: number;
        errorDescription: string;
        isMainFrame: boolean;
      };
      // -3 is a load that was replaced by another one.
      if (isMainFrame && errorCode !== -3) setFailed(errorDescription || `error ${errorCode}`);
    };
    const onStop = () => {
      setLoading(false);
      sync();
      tune();
    };
    const onInPage = () => {
      sync();
      tune();
    };
    view.addEventListener("dom-ready", onReady);
    view.addEventListener("did-navigate", sync);
    view.addEventListener("did-navigate-in-page", onInPage);
    view.addEventListener("did-start-loading", onStart);
    view.addEventListener("did-stop-loading", onStop);
    view.addEventListener("did-fail-load", onFail);
    return () => {
      view.removeEventListener("did-fail-load", onFail);
      view.removeEventListener("dom-ready", onReady);
      view.removeEventListener("did-navigate", sync);
      view.removeEventListener("did-navigate-in-page", onInPage);
      view.removeEventListener("did-start-loading", onStart);
      view.removeEventListener("did-stop-loading", onStop);
    };
  }, [src, tune]);

  // A new address (another session, or the same one asked for again) loads in the open page.
  useEffect(() => {
    want.current = url;
    if (ready.current && ref.current) void ref.current.loadURL(url).catch(() => {});
  }, [url, nonce]);

  const shown = embedded ? current : url;

  return (
    // Hidden with visibility rather than display, so the page keeps its size and state.
    <div
      className="absolute inset-0 z-[2] flex flex-col overflow-hidden"
      style={{ visibility: visible ? "visible" : "hidden", background: "var(--mc-editor)" }}
      aria-hidden={!visible}
    >
      <div
        className="mc-section-title shrink-0 border-b border-[var(--mc-border)]"
        style={{ height: "2.4rem", textTransform: "none", letterSpacing: 0 }}
        role="toolbar"
        aria-label="Claude Code on the web"
      >
        {embedded && nav.back && (
          <button
            type="button"
            className="mc-icon-btn"
            style={{ width: 26, height: 26 }}
            aria-label="Back"
            title="Back"
            onClick={() => ref.current?.goBack()}
          >
            <BackIcon />
          </button>
        )}
        <span style={{ color: "var(--mc-accent)" }}>
          <CloudIcon size={15} />
        </span>
        <span className="text-[0.8125rem] font-semibold text-[var(--mc-text)]">
          {title ?? "Claude in the cloud"}
        </span>
        <span
          className="min-w-0 flex-1 truncate text-[0.6875rem] font-normal text-[var(--mc-text-faint)]"
          aria-label="Address"
          title={shown}
        >
          {shortUrl(shown)}
        </span>
        <button
          type="button"
          className="mc-icon-btn"
          style={{ width: 26, height: 26 }}
          aria-label="Reload"
          title="Reload"
          disabled={!embedded}
          onClick={() => ref.current?.reload()}
        >
          <ReloadIcon size={14} />
        </button>
      </div>
      {embedded && loading && <div className="mc-loading-bar" aria-hidden="true" />}
      {embedded && failed && (
        <div className="absolute inset-x-0 bottom-0 top-9 z-[1] flex items-center justify-center p-8">
          <div
            role="alert"
            className="mc-inset flex max-w-[420px] flex-col items-center gap-3 p-6 text-center"
          >
            <span style={{ color: "var(--mc-warning)" }}>
              <AlertIcon size={26} />
            </span>
            <p className="m-0 text-[0.875rem] font-semibold">claude.ai didn&apos;t load</p>
            <p className="m-0 text-[0.8125rem] text-[var(--mc-text-muted)]">{failed}</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="mc-btn mc-btn-sm"
                onClick={() => ref.current?.reload()}
              >
                <ReloadIcon size={12} /> Try again
              </button>
              <button
                type="button"
                className="mc-btn mc-btn-ghost mc-btn-sm"
                onClick={() => onOpenExternal(shown)}
              >
                <ExternalIcon /> Open in the browser
              </button>
            </div>
          </div>
        </div>
      )}
      {embedded ? (
        <webview
          ref={(el) => {
            ref.current = el as WebviewElement | null;
          }}
          src={src}
          partition={PARTITION}
          // As an attribute: React doesn't know it, and the webview reads it when it starts.
          {...{ allowpopups: "true" as unknown as boolean }}
          className="min-h-0 flex-1"
          style={{ display: "flex" }}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="mc-inset flex max-w-[420px] flex-col items-center gap-3 p-6 text-center">
            <span style={{ color: "var(--mc-accent)" }}>
              <CloudIcon size={28} />
            </span>
            <p className="m-0 text-[0.875rem] font-semibold">Claude Code on the web</p>
            <p className="m-0 text-[0.8125rem] text-[var(--mc-text-muted)]">
              In the desktop app, {shortUrl(url)} opens right here, in this tab.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
