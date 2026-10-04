/** Files in the editor: viewer addresses, sizes and the hex view. */

/** The address the viewers load a local file from (electron/main.cjs serves moon-file://). */
export const fileUrl = (path: string) => `moon-file://local/${encodeURIComponent(path)}`;

/** 1536 → "1.5 KB" */
export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

/** Rows of a hex view: offset, 16 bytes as hex, and the bytes as text ("." when not printable). */
export function hexRows(data: Uint8Array): { offset: string; hex: string; text: string }[] {
  const rows = [];
  for (let i = 0; i < data.length; i += 16) {
    const chunk = Array.from(data.subarray(i, i + 16));
    rows.push({
      offset: i.toString(16).padStart(8, "0"),
      hex: chunk
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ")
        .padEnd(47, " "),
      text: chunk.map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : ".")).join(""),
    });
  }
  return rows;
}

/** Base64 → bytes. */
export function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** True for Markdown files (they get a preview). */
export const isMarkdown = (path: string) => /\.(md|markdown|mdx)$/i.test(path);
