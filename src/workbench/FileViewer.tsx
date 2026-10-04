import { useEffect, useMemo, useState, type ReactNode } from "react";
import { marked, type Token, type Tokens } from "marked";
import { basename } from "../lib/paths";
import { bytes, fileUrl, fromBase64, hexRows } from "../lib/files";
import type { FileKind, MoonCodeBridge } from "../lib/types";

/**
 * Files that aren't text open here instead of in the code editor: pictures (fit or real size, on
 * a checkerboard), PDFs (Chromium's viewer), sound and video (the players), and anything else
 * binary as a hex view of its first 64 KB. Everything loads from the disk through moon-file://.
 */
export function FileViewer({
  bridge,
  path,
  kind,
  size,
}: {
  bridge: MoonCodeBridge;
  path: string;
  kind: Exclude<FileKind, "text">;
  size: number;
}) {
  const url = fileUrl(path);
  const name = basename(path);
  return (
    <div className="mc-viewer absolute inset-0 flex flex-col">
      {kind === "image" && <ImageView url={url} name={name} size={size} />}
      {kind === "pdf" && <iframe src={url} title={name} className="min-h-0 flex-1 border-0" />}
      {kind === "audio" && (
        <div className="m-auto flex flex-col items-center gap-3">
          <span className="text-[0.875rem] font-semibold">{name}</span>
          {/* Local files don't come with captions. */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={url} controls className="w-[min(520px,80vw)]" aria-label={name} />
          <span className="text-[0.75rem] text-[var(--mc-text-faint)]">{bytes(size)}</span>
        </div>
      )}
      {kind === "video" && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={url} controls className="m-auto max-h-full max-w-full" aria-label={name} />
      )}
      {kind === "binary" && <HexView bridge={bridge} path={path} size={size} />}
    </div>
  );
}

function ImageView({ url, name, size }: { url: string; name: string; size: number }) {
  const [fit, setFit] = useState(true);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  return (
    <>
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-[var(--mc-border)] px-3 text-[0.75rem] text-[var(--mc-text-muted)]">
        <span className="min-w-0 flex-1 truncate">
          {name}
          {dims ? ` · ${dims.w} × ${dims.h}` : ""} · {bytes(size)}
        </span>
        <button
          type="button"
          className="mc-btn mc-btn-ghost mc-btn-sm"
          aria-pressed={!fit}
          onClick={() => setFit((f) => !f)}
        >
          {fit ? "Real size" : "Fit"}
        </button>
      </div>
      <div className="mc-checker min-h-0 flex-1 overflow-auto">
        <img
          src={url}
          alt={name}
          onLoad={(e) =>
            setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
          }
          className={fit ? "m-auto block h-full w-full object-contain p-4" : "m-auto block p-4"}
        />
      </div>
    </>
  );
}

function HexView({ bridge, path, size }: { bridge: MoonCodeBridge; path: string; size: number }) {
  const [data, setData] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    bridge
      .readBytes(path, 64 * 1024)
      .then((r) => !cancelled && setData(fromBase64(r.data)))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [bridge, path]);
  const rows = useMemo(() => (data ? hexRows(data) : []), [data]);
  return (
    <>
      <div className="flex h-9 shrink-0 items-center border-b border-[var(--mc-border)] px-3 text-[0.75rem] text-[var(--mc-text-muted)]">
        {basename(path)} · binary · {bytes(size)}
        {data && data.length < size ? ` · the first ${bytes(data.length)}` : ""}
      </div>
      {error ? (
        <p className="m-auto text-[0.8125rem] text-[var(--mc-danger)]">{error}</p>
      ) : (
        <pre className="mc-hex m-0 min-h-0 flex-1 overflow-auto p-3" aria-label="Bytes">
          {rows.map((r) => (
            <div key={r.offset}>
              <span className="mc-hex-offset">{r.offset}</span> {r.hex}{" "}
              <span className="mc-hex-text">{r.text}</span>
            </div>
          ))}
        </pre>
      )}
    </>
  );
}

/** A Markdown file as a page (GitHub-flavoured). Built from marked's tokens as React elements,
 * so every bit of text stays escaped; raw HTML in the file shows as text. */
export function MarkdownView({ text, onLink }: { text: string; onLink: (href: string) => void }) {
  const tokens = useMemo(() => marked.lexer(text, { gfm: true }), [text]);
  return (
    <div className="mc-markdown absolute inset-0 overflow-auto px-10 py-8">
      <Blocks tokens={tokens} onLink={onLink} />
    </div>
  );
}

type Tok = Token & { tokens?: Token[] };

function Blocks({ tokens, onLink }: { tokens: Token[]; onLink: (href: string) => void }) {
  return (
    <>
      {tokens.map((t, i) => (
        <Block key={i} token={t as Tok} onLink={onLink} />
      ))}
    </>
  );
}

function Block({ token: t, onLink }: { token: Tok; onLink: (href: string) => void }): ReactNode {
  const inline = (tokens?: Token[]) => <Inline tokens={tokens ?? []} onLink={onLink} />;
  switch (t.type) {
    case "heading": {
      const H = `h${(t as Tokens.Heading).depth}` as "h1";
      return <H>{inline(t.tokens)}</H>;
    }
    case "paragraph":
      return <p>{inline(t.tokens)}</p>;
    case "text":
      return <p>{t.tokens ? inline(t.tokens) : (t as Tokens.Text).text}</p>;
    case "code":
      return (
        <pre>
          <code>{(t as Tokens.Code).text}</code>
        </pre>
      );
    case "blockquote":
      return (
        <blockquote>
          <Blocks tokens={t.tokens ?? []} onLink={onLink} />
        </blockquote>
      );
    case "list": {
      const list = t as Tokens.List;
      const items = list.items.map((item, i) => (
        <li key={i}>
          {item.task && <input type="checkbox" checked={Boolean(item.checked)} readOnly disabled />}
          {item.tokens.map((x, j) =>
            x.type === "text" ? (
              <Inline key={j} tokens={(x as Tok).tokens ?? [x]} onLink={onLink} />
            ) : (
              <Block key={j} token={x as Tok} onLink={onLink} />
            ),
          )}
        </li>
      ));
      return list.ordered ? <ol start={Number(list.start) || 1}>{items}</ol> : <ul>{items}</ul>;
    }
    case "table": {
      const table = t as Tokens.Table;
      return (
        <table>
          <thead>
            <tr>
              {table.header.map((c, i) => (
                <th key={i} style={{ textAlign: table.align[i] ?? undefined }}>
                  {inline(c.tokens)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, r) => (
              <tr key={r}>
                {row.map((c, i) => (
                  <td key={i} style={{ textAlign: table.align[i] ?? undefined }}>
                    {inline(c.tokens)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    case "hr":
      return <hr />;
    case "html":
      return <pre>{(t as Tokens.HTML).text}</pre>;
    default:
      return null;
  }
}

function Inline({ tokens, onLink }: { tokens: Token[]; onLink: (href: string) => void }) {
  return (
    <>
      {tokens.map((raw, i) => {
        const t = raw as Tok;
        const kids = () => <Inline tokens={t.tokens ?? []} onLink={onLink} />;
        switch (t.type) {
          case "strong":
            return <strong key={i}>{kids()}</strong>;
          case "em":
            return <em key={i}>{kids()}</em>;
          case "del":
            return <del key={i}>{kids()}</del>;
          case "codespan":
            return <code key={i}>{(t as Tokens.Codespan).text}</code>;
          case "br":
            return <br key={i} />;
          case "link": {
            const href = (t as Tokens.Link).href;
            return (
              <a
                key={i}
                href={href}
                title={href}
                onClick={(e) => {
                  e.preventDefault();
                  if (/^https?:\/\//.test(href)) onLink(href);
                }}
              >
                {kids()}
              </a>
            );
          }
          case "image":
            return (
              <span key={i} className="mc-markdown-image">
                [{(t as Tokens.Image).text || "image"}]
              </span>
            );
          case "text":
            return t.tokens ? (
              <span key={i}>{kids()}</span>
            ) : (
              <span key={i}>{decode((t as Tokens.Text).text)}</span>
            );
          case "escape":
            return <span key={i}>{(t as Tokens.Escape).text}</span>;
          default:
            return <span key={i}>{"raw" in t ? String(t.raw) : ""}</span>;
        }
      })}
    </>
  );
}

/** marked hands text with HTML entities (&amp;, &#39;…); React escapes it again, so decode them. */
function decode(text: string) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}
