/** Path helpers that work for both "/" and "\" paths (the UI doesn't have Node's path module). */

const SEP = /[\\/]/;

export function basename(p: string): string {
  const parts = p.split(SEP).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : p;
}

export function dirname(p: string): string {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  if (i <= 0) return i === 0 ? p.slice(0, 1) : p;
  // "C:\file" → "C:\"
  if (i === 2 && p[1] === ":") return p.slice(0, 3);
  return p.slice(0, i);
}

/** The separator a path uses. */
export function sepOf(p: string): "/" | "\\" {
  return p.includes("\\") && !p.includes("/") ? "\\" : "/";
}

export function join(dir: string, name: string): string {
  const sep = sepOf(dir);
  return dir.endsWith(sep) ? dir + name : dir + sep + name;
}

/** `file` relative to `root` with "/" (or the full path when it is outside). */
export function relative(root: string, file: string): string {
  const norm = (s: string) => s.replace(/\\/g, "/").replace(/\/+$/, "");
  const r = norm(root);
  const f = norm(file);
  return f.startsWith(`${r}/`) ? f.slice(r.length + 1) : f;
}

/** A relative path ("src/a.ts") under `root`, with the root's separator. */
export function resolveIn(root: string, rel: string): string {
  const sep = sepOf(root);
  return join(root, rel.split("/").join(sep));
}

/** The extension in lower case without the dot ("" when there is none). */
export function extname(p: string): string {
  const name = basename(p);
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** "/home/luna/x" → "~/x" for display. */
export function tildify(p: string, home: string | null): string {
  if (!home) return p;
  if (p === home) return "~";
  const rel = relative(home, p);
  return rel === p.replace(/\\/g, "/").replace(/\/+$/, "") ? p : `~/${rel}`;
}
