import type * as Monaco from "monaco-editor";

/*
 * The editor's colours: the Moon palette from tokens.css, applied to Monaco (Microsoft's
 * open-source code editor). Syntax follows the file-kind colours of Moon Explorer – lavender
 * keywords, mint strings, sky types, peach numbers, the warm warning-gold for constants.
 */

const night = {
  bg: "#100d28",
  surface: "#141030",
  line: "#1a1540",
  text: "#e9e4f7",
  muted: "#8a83b8",
  faint: "#5d5789",
  lavender: "#b9aefb",
  lavenderSoft: "#d6cffd",
  mint: "#7fe3c6",
  sky: "#9ad7f5",
  peach: "#f7b89a",
  gold: "#f3c766",
  error: "#f28b92",
};

const day = {
  bg: "#fcfbff",
  surface: "#f5f2fb",
  line: "#f1edfb",
  text: "#1c1733",
  muted: "#6a6390",
  faint: "#a29cc3",
  lavender: "#5b4bc4",
  lavenderSoft: "#7d6de0",
  mint: "#1d7d65",
  sky: "#2f86b5",
  peach: "#c7663b",
  gold: "#a86b00",
  error: "#c2323d",
};

type Palette = typeof night;

const strip = (hex: string) => hex.replace("#", "");

function rules(p: Palette): Monaco.editor.ITokenThemeRule[] {
  return [
    { token: "", foreground: strip(p.text) },
    { token: "comment", foreground: strip(p.faint), fontStyle: "italic" },
    { token: "keyword", foreground: strip(p.lavender) },
    { token: "keyword.flow", foreground: strip(p.lavender) },
    { token: "storage", foreground: strip(p.lavender) },
    { token: "string", foreground: strip(p.mint) },
    { token: "string.escape", foreground: strip(p.sky) },
    { token: "regexp", foreground: strip(p.peach) },
    { token: "number", foreground: strip(p.peach) },
    { token: "constant", foreground: strip(p.gold) },
    { token: "type", foreground: strip(p.sky) },
    { token: "type.identifier", foreground: strip(p.sky) },
    { token: "identifier", foreground: strip(p.text) },
    { token: "variable", foreground: strip(p.text) },
    { token: "variable.predefined", foreground: strip(p.gold) },
    { token: "function", foreground: strip(p.lavenderSoft) },
    { token: "delimiter", foreground: strip(p.muted) },
    { token: "delimiter.bracket", foreground: strip(p.muted) },
    { token: "operator", foreground: strip(p.sky) },
    { token: "tag", foreground: strip(p.lavender) },
    { token: "metatag", foreground: strip(p.lavender) },
    { token: "attribute.name", foreground: strip(p.sky) },
    { token: "attribute.value", foreground: strip(p.mint) },
    { token: "key", foreground: strip(p.sky) },
    { token: "string.key.json", foreground: strip(p.sky) },
    { token: "string.value.json", foreground: strip(p.mint) },
    { token: "keyword.json", foreground: strip(p.gold) },
    { token: "markup.heading", foreground: strip(p.lavender), fontStyle: "bold" },
    { token: "emphasis", fontStyle: "italic" },
    { token: "strong", fontStyle: "bold" },
    { token: "invalid", foreground: strip(p.error) },
  ];
}

function colors(p: Palette, dark: boolean): Monaco.editor.IColors {
  const a = (hex: string, alpha: string) => `${hex}${alpha}`;
  return {
    "editor.background": p.bg,
    "editor.foreground": p.text,
    "editorLineNumber.foreground": p.faint,
    "editorLineNumber.activeForeground": p.lavenderSoft,
    "editor.lineHighlightBackground": p.line,
    "editor.lineHighlightBorder": p.line,
    "editorCursor.foreground": p.lavenderSoft,
    "editor.selectionBackground": a(p.lavender, dark ? "40" : "33"),
    "editor.inactiveSelectionBackground": a(p.lavender, "22"),
    "editor.selectionHighlightBackground": a(p.lavender, "1f"),
    "editor.wordHighlightBackground": a(p.sky, "1f"),
    "editor.findMatchBackground": a(p.gold, "55"),
    "editor.findMatchHighlightBackground": a(p.gold, "26"),
    "editorBracketMatch.background": a(p.lavender, "26"),
    "editorBracketMatch.border": a(p.lavender, "80"),
    "editorIndentGuide.background1": a(p.lavender, "14"),
    "editorIndentGuide.activeBackground1": a(p.lavender, "40"),
    "editorWhitespace.foreground": a(p.lavender, "26"),
    "editorGutter.background": p.bg,
    "editorWidget.background": p.surface,
    "editorWidget.border": a(p.lavender, "40"),
    "editorSuggestWidget.background": p.surface,
    "editorSuggestWidget.border": a(p.lavender, "40"),
    "editorSuggestWidget.selectedBackground": a(p.lavender, "2e"),
    "editorHoverWidget.background": p.surface,
    "editorHoverWidget.border": a(p.lavender, "40"),
    "input.background": p.bg,
    "input.border": a(p.lavender, "40"),
    focusBorder: a(p.lavender, "99"),
    "list.hoverBackground": a(p.lavender, "14"),
    "list.activeSelectionBackground": a(p.lavender, "2e"),
    "list.highlightForeground": p.lavenderSoft,
    "scrollbarSlider.background": a(p.lavender, "26"),
    "scrollbarSlider.hoverBackground": a(p.lavender, "40"),
    "scrollbarSlider.activeBackground": a(p.lavender, "59"),
    "minimap.background": p.bg,
    "minimapSlider.background": a(p.lavender, "1a"),
    "editorOverviewRuler.border": "#00000000",
    "editorBracketHighlight.foreground1": p.lavender,
    "editorBracketHighlight.foreground2": p.sky,
    "editorBracketHighlight.foreground3": p.mint,
    "editorBracketHighlight.foreground4": p.peach,
    "editorBracketHighlight.foreground5": p.gold,
    "editorBracketHighlight.foreground6": p.lavenderSoft,
    "editorBracketHighlight.unexpectedBracket.foreground": p.error,
    "editorError.foreground": p.error,
    "editorWarning.foreground": p.gold,
    "editorInfo.foreground": p.sky,
  };
}

export const MOON_NIGHT = "moon-night";
export const MOON_DAY = "moon-day";

/** Registers the two Moon themes with Monaco. */
export function defineMoonThemes(monaco: typeof Monaco) {
  monaco.editor.defineTheme(MOON_NIGHT, {
    base: "vs-dark",
    inherit: true,
    rules: rules(night),
    colors: colors(night, true),
  });
  monaco.editor.defineTheme(MOON_DAY, {
    base: "vs",
    inherit: true,
    rules: rules(day),
    colors: colors(day, false),
  });
}
