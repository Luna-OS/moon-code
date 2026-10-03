import * as monaco from "monaco-editor";

/** The editor's models (one per open file) and the view state each tab left behind. */

export const viewStates = new Map<string, monaco.editor.ICodeEditorViewState | null>();
const uriOf = (path: string) => monaco.Uri.file(path);

/** The model of a file, made on first use with its saved text. */
export function modelFor(path: string, text: string, language: string) {
  const uri = uriOf(path);
  const existing = monaco.editor.getModel(uri);
  if (existing) return existing;
  return monaco.editor.createModel(text, language, uri);
}

/** Forgets a closed file's model and view state. */
export function disposeModel(path: string) {
  monaco.editor.getModel(uriOf(path))?.dispose();
  viewStates.delete(path);
}
