/**
 * What Moon Code does inside the claude.ai page of the cloud tab (run with the webview's
 * executeJavaScript, so it must not use anything from outside the function): it recolours the
 * page. Every CSS custom property that holds a colour – whatever it is called – is read and mapped
 * into the Moon palette (greys become night blue or moonlight, the orange accent becomes
 * lavender, other colours stay). It runs again when stylesheets or the theme change.
 *
 * With `{ test: true }` it only hands back its colour helpers, for the tests.
 */
export interface PageOptions {
  /** Moon Code's theme. */
  theme?: "dark" | "light";
  test?: boolean;
}

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function moonPage(opts: PageOptions) {
  type Format = "hex" | "rgb" | "hsl" | "hsl-triplet" | "rgb-triplet";
  type Parsed = Rgba & { format: Format };

  const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));

  function hslToRgb(h: number, s: number, l: number) {
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 };
  }

  function rgbToHsl(r: number, g: number, b: number) {
    const R = r / 255;
    const G = g / 255;
    const B = b / 255;
    const max = Math.max(R, G, B);
    const min = Math.min(R, G, B);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h: number;
    if (max === R) h = ((G - B) / d + (G < B ? 6 : 0)) * 60;
    else if (max === G) h = ((B - R) / d + 2) * 60;
    else h = ((R - G) / d + 4) * 60;
    return { h, s, l };
  }

  function alphaOf(part: string | undefined): number {
    if (!part) return 1;
    const t = part.trim();
    return t.endsWith("%") ? parseFloat(t) / 100 : parseFloat(t);
  }

  /** A colour from a custom property's value, with the format to write it back in. */
  function parseColor(raw: string): Parsed | null {
    const v = raw.trim().toLowerCase();
    let m = /^#([0-9a-f]{3,8})$/.exec(v);
    if (m) {
      let hex = m[1];
      if (hex.length === 3 || hex.length === 4) hex = [...hex].map((c) => c + c).join("");
      if (hex.length !== 6 && hex.length !== 8) return null;
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
        format: "hex",
      };
    }
    m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+%?))?\s*\)$/.exec(v);
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: alphaOf(m[4]), format: "rgb" };
    m =
      /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%\s*(?:[,/]\s*([\d.]+%?))?\s*\)$/.exec(
        v,
      );
    if (m) {
      const c = hslToRgb(+m[1], +m[2] / 100, +m[3] / 100);
      return { ...c, a: alphaOf(m[4]), format: "hsl" };
    }
    // Tailwind-style parts of a colour: "60 2.7% 14.5%" (used as hsl(var(--x))).
    m = /^([\d.]+)(?:deg)?\s+([\d.]+)%\s+([\d.]+)%(?:\s*\/\s*([\d.]+%?))?$/.exec(v);
    if (m) {
      const c = hslToRgb(+m[1], +m[2] / 100, +m[3] / 100);
      return { ...c, a: alphaOf(m[4]), format: "hsl-triplet" };
    }
    // "31 31 30" (used as rgb(var(--x))).
    m = /^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(?:\s*\/\s*([\d.]+%?))?$/.exec(v);
    if (m && +m[1] <= 255 && +m[2] <= 255 && +m[3] <= 255) {
      return { r: +m[1], g: +m[2], b: +m[3], a: alphaOf(m[4]), format: "rgb-triplet" };
    }
    return null;
  }

  /** The Moon version of a colour (see the comment at the top). */
  function moonify(c: Rgba, theme: "dark" | "light"): Rgba {
    const { h, s, l } = rgbToHsl(c.r, c.g, c.b);
    let H = h;
    let S = s;
    let L = l;
    // How colourful it is (near-white and near-black have a high HSL saturation but no colour).
    const chroma = (Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b)) / 255;
    if (chroma < 0.12) {
      // Greys: night blue in the dark, moonlight when light; text stays as bright as it was.
      if (l < 0.5) {
        H = 248;
        S = theme === "dark" ? 0.5 : 0.3;
        L = theme === "dark" ? clamp(0.055 + l * 0.6) : l;
      } else if (l > 0.9) {
        H = theme === "dark" ? 38 : 260;
        S = theme === "dark" ? 0.58 : 0.45;
      } else {
        H = 249;
        S = theme === "dark" ? 0.32 : 0.22;
      }
    } else if (h < 50 || h >= 335) {
      // Claude's clay orange (and its reds-turned-accents) → lavender.
      H = 249;
      S = Math.max(s, 0.75);
      L = theme === "dark" ? clamp(0.6 + l * 0.35, 0, 0.92) : clamp(l * 0.9, 0.35, 0.6);
    }
    const rgb = hslToRgb(H, S, L);
    return { r: rgb.r, g: rgb.g, b: rgb.b, a: c.a };
  }

  function formatColor(c: Rgba, format: Format): string {
    const r = Math.round(c.r);
    const g = Math.round(c.g);
    const b = Math.round(c.b);
    const a = Math.round(c.a * 1000) / 1000;
    if (format === "rgb-triplet") return a < 1 ? `${r} ${g} ${b} / ${a}` : `${r} ${g} ${b}`;
    if (format === "hsl-triplet") {
      const { h, s, l } = rgbToHsl(r, g, b);
      const t = `${Math.round(h * 10) / 10} ${Math.round(s * 1000) / 10}% ${Math.round(l * 1000) / 10}%`;
      return a < 1 ? `${t} / ${a}` : t;
    }
    if (a < 1) return `rgba(${r}, ${g}, ${b}, ${a})`;
    const hex = (n: number) => n.toString(16).padStart(2, "0");
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  }

  if (opts.test) return { parseColor, moonify, formatColor };

  const w = window as unknown as Record<string, unknown>;
  const theme = opts.theme ?? "dark";
  const doc = document;
  const STYLE_ID = "moon-code-theme";

  /** Every custom property the page's stylesheets define. */
  const names = () => {
    const out = new Set<string>();
    const walk = (rules: CSSRuleList) => {
      for (const rule of Array.from(rules)) {
        const style = (rule as CSSStyleRule).style;
        if (style) {
          for (let i = 0; i < style.length; i++) {
            if (style[i].startsWith("--")) out.add(style[i]);
          }
        }
        const inner = (rule as CSSGroupingRule).cssRules;
        if (inner) walk(inner);
      }
    };
    for (const sheet of Array.from(doc.styleSheets)) {
      if ((sheet.ownerNode as Element | null)?.id === STYLE_ID) continue;
      try {
        walk(sheet.cssRules);
      } catch {
        // a stylesheet from another origin can't be read
      }
    }
    return out;
  };

  const recolor = () => {
    const old = doc.getElementById(STYLE_ID);
    // Read the page's own values, not ours.
    if (old) old.remove();
    const cs = getComputedStyle(doc.documentElement);
    const bodyCs = doc.body ? getComputedStyle(doc.body) : cs;
    const decls: string[] = [];
    for (const name of names()) {
      const value = cs.getPropertyValue(name) || bodyCs.getPropertyValue(name);
      const c = value ? parseColor(value) : null;
      if (c) decls.push(`${name}: ${formatColor(moonify(c, theme), c.format)} !important;`);
    }
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    const bg = theme === "dark" ? "#100d28" : "#f7f4fd";
    style.textContent =
      `:root, html, body, .dark, .light, [data-theme], [data-mode] { ${decls.join(" ")} }` +
      ` html, body { background-color: ${bg} !important; }` +
      ` ::selection { background: ${theme === "dark" ? "#b9aefb55" : "#7d6de033"}; }`;
    (doc.head || doc.documentElement).appendChild(style);
  };

  const state = w.__moonCode as { theme: string; sheets: number } | undefined;
  const sheets = doc.styleSheets.length;
  if (!state || state.theme !== theme || state.sheets !== sheets) {
    recolor();
    w.__moonCode = { theme, sheets: doc.styleSheets.length };
  }
  return true;
}

/** The script for the webview: `moonPage` with these options. */
export const pageScript = (opts: PageOptions) =>
  `(${moonPage.toString()})(${JSON.stringify({ ...opts, test: false })})`;
