import { basename, extname } from "./paths";

/** Monaco language ids by file extension (Monaco's built-in languages). */
const BY_EXT: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  jsonc: "json",
  md: "markdown",
  markdown: "markdown",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  htm: "html",
  xml: "xml",
  svg: "xml",
  yml: "yaml",
  yaml: "yaml",
  py: "python",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  c: "c",
  h: "c",
  cpp: "cpp",
  hpp: "cpp",
  cc: "cpp",
  cs: "csharp",
  php: "php",
  rb: "ruby",
  swift: "swift",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  ps1: "powershell",
  psm1: "powershell",
  bat: "bat",
  cmd: "bat",
  sql: "sql",
  lua: "lua",
  dart: "dart",
  toml: "ini",
  ini: "ini",
  env: "ini",
  dockerfile: "dockerfile",
  graphql: "graphql",
  vue: "html",
  svelte: "html",
};

const BY_NAME: Record<string, string> = {
  dockerfile: "dockerfile",
  makefile: "shell",
  ".gitignore": "ini",
  ".editorconfig": "ini",
};

/** Monaco's language id for a file, "plaintext" when it isn't known. */
export function languageOf(path: string): string {
  const name = basename(path).toLowerCase();
  return BY_NAME[name] ?? BY_EXT[extname(path)] ?? "plaintext";
}

/** Short display names for the status bar. */
const DISPLAY: Record<string, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  json: "JSON",
  markdown: "Markdown",
  css: "CSS",
  scss: "SCSS",
  html: "HTML",
  xml: "XML",
  yaml: "YAML",
  python: "Python",
  rust: "Rust",
  go: "Go",
  csharp: "C#",
  cpp: "C++",
  shell: "Shell",
  powershell: "PowerShell",
  bat: "Batch",
  plaintext: "Plain Text",
};

export function languageName(id: string): string {
  return DISPLAY[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

/** The colour of a file's icon, by kind (the file-kind colours of Moon Explorer). */
export function kindColor(path: string): string {
  const ext = extname(path);
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp"].includes(ext)) {
    return "var(--mc-kind-image)";
  }
  if (["mp3", "wav", "mp4", "mov", "webm", "ogg"].includes(ext)) return "var(--mc-kind-media)";
  if (["zip", "7z", "rar", "gz", "tar", "xz"].includes(ext)) return "var(--mc-kind-archive)";
  if (["md", "txt", "pdf", "lock"].includes(ext)) return "var(--mc-kind-file)";
  if (languageOf(path) !== "plaintext") return "var(--mc-kind-code)";
  return "var(--mc-kind-file)";
}
