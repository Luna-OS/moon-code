import { useEffect, useLayoutEffect, useRef } from "react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import JsonWorker from "monaco-editor/language/json/json.worker?worker";
import CssWorker from "monaco-editor/language/css/css.worker?worker";
import HtmlWorker from "monaco-editor/language/html/html.worker?worker";
import TsWorker from "monaco-editor/language/typescript/ts.worker?worker";
import { defineMoonThemes, MOON_DAY, MOON_NIGHT } from "../theme/monaco-theme";
import { modelFor, viewStates } from "./monaco-models";

/*
 * The text editor: Monaco, Microsoft's open-source code editor, bundled with the app (nothing loads
 * from the network) and dressed in the Moon themes. One editor, one model per open file, so every
 * tab keeps its undo history, cursor and scroll position.
 */

self.MonacoEnvironment = {
  getWorker(_id: string, label: string) {
    if (label === "json") return new JsonWorker();
    if (label === "css" || label === "scss" || label === "less") return new CssWorker();
    if (label === "html" || label === "handlebars" || label === "razor") return new HtmlWorker();
    if (label === "typescript" || label === "javascript") return new TsWorker();
    return new EditorWorker();
  },
};
defineMoonThemes(monaco);

// Plain checks only: the editor has no project to resolve imports against.
for (const defaults of [
  monaco.typescript.typescriptDefaults,
  monaco.typescript.javascriptDefaults,
]) {
  defaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });
  defaults.setCompilerOptions({
    jsx: monaco.typescript.JsxEmit.ReactJSX,
    target: monaco.typescript.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    allowJs: true,
  });
}

export interface EditorActions {
  save: () => void;
  quickOpen: () => void;
  commands: () => void;
  askClaude: (selection: string) => void;
}

export default function CodeEditor({
  path,
  text,
  language,
  theme,
  fontSize,
  wordWrap,
  minimap,
  reveal,
  actions,
  onChange,
  onCursor,
}: {
  path: string;
  text: string;
  language: string;
  theme: "dark" | "light";
  fontSize: number;
  wordWrap: boolean;
  minimap: boolean;
  /** Jump to a line (and column) once; changes when a search result is picked. */
  reveal: { line: number; column: number; nonce: number } | null;
  actions: EditorActions;
  onChange: (path: string, value: string) => void;
  onCursor: (pos: { line: number; column: number }) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const current = useRef(path);
  const actionsRef = useRef(actions);
  const onChangeRef = useRef(onChange);
  const onCursorRef = useRef(onCursor);
  useLayoutEffect(() => {
    actionsRef.current = actions;
    onChangeRef.current = onChange;
    onCursorRef.current = onCursor;
  });

  // The editor itself, once.
  useEffect(() => {
    if (!host.current) return;
    const ed = monaco.editor.create(host.current, {
      automaticLayout: true,
      fontFamily: '"Cascadia Code", "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace',
      fontLigatures: true,
      fontSize,
      lineHeight: Math.round(fontSize * 1.6),
      smoothScrolling: true,
      cursorBlinking: "smooth",
      cursorSmoothCaretAnimation: "on",
      renderLineHighlight: "all",
      roundedSelection: true,
      padding: { top: 12, bottom: 12 },
      scrollBeyondLastLine: false,
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: "active", indentation: true },
      stickyScroll: { enabled: true },
      theme: theme === "light" ? MOON_DAY : MOON_NIGHT,
      minimap: { enabled: minimap, renderCharacters: false, scale: 1 },
      wordWrap: wordWrap ? "on" : "off",
    });
    editor.current = ed;
    const K = monaco.KeyMod;
    const C = monaco.KeyCode;
    ed.addCommand(K.CtrlCmd | C.KeyS, () => actionsRef.current.save());
    ed.addCommand(K.CtrlCmd | C.KeyP, () => actionsRef.current.quickOpen());
    ed.addCommand(K.CtrlCmd | K.Shift | C.KeyP, () => actionsRef.current.commands());
    ed.addAction({
      id: "moon-code.ask-claude",
      label: "Ask Claude about this",
      contextMenuGroupId: "navigation",
      contextMenuOrder: 0,
      keybindings: [K.CtrlCmd | K.Shift | C.KeyL],
      run: (e) => {
        const sel = e.getSelection();
        const model = e.getModel();
        actionsRef.current.askClaude(sel && model ? model.getValueInRange(sel) : "");
      },
    });
    const sub1 = ed.onDidChangeModelContent(() => {
      onChangeRef.current(current.current, ed.getValue());
    });
    const sub2 = ed.onDidChangeCursorPosition((e) =>
      onCursorRef.current({ line: e.position.lineNumber, column: e.position.column }),
    );
    return () => {
      sub1.dispose();
      sub2.dispose();
      ed.dispose();
      editor.current = null;
    };
    // The options below are applied by their own effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switching files: keep the old one's view state, show the new one's model.
  useEffect(() => {
    const ed = editor.current;
    if (!ed) return;
    const prev = current.current;
    if (prev !== path) viewStates.set(prev, ed.saveViewState());
    current.current = path;
    const model = modelFor(path, text, language);
    if (ed.getModel() !== model) {
      ed.setModel(model);
      const vs = viewStates.get(path);
      if (vs) ed.restoreViewState(vs);
    }
    ed.focus();
    const pos = ed.getPosition();
    if (pos) onCursorRef.current({ line: pos.lineNumber, column: pos.column });
    // `text` only seeds a new model; later edits live in the model.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, language]);

  useEffect(() => {
    monaco.editor.setTheme(theme === "light" ? MOON_DAY : MOON_NIGHT);
  }, [theme]);

  useEffect(() => {
    editor.current?.updateOptions({
      fontSize,
      lineHeight: Math.round(fontSize * 1.6),
      wordWrap: wordWrap ? "on" : "off",
      minimap: { enabled: minimap, renderCharacters: false, scale: 1 },
    });
  }, [fontSize, wordWrap, minimap]);

  useEffect(() => {
    const ed = editor.current;
    if (!ed || !reveal) return;
    ed.revealLineInCenter(reveal.line);
    ed.setPosition({ lineNumber: reveal.line, column: reveal.column });
    ed.focus();
  }, [reveal]);

  return <div ref={host} className="h-full w-full" />;
}
