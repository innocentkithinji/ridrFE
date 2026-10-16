import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting } from "@codemirror/language";
import { lintGutter, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { EditorState, type Text } from "@codemirror/state";
import { EditorView, keymap, placeholder as placeholderText } from "@codemirror/view";
import { classHighlighter } from "@lezer/highlight";
import { useEffect, useRef } from "react";
import { fields, functions, keywords, ridrQueryLanguage, sources } from "@/components/query-editor/language";

// QueryEditor is where a Query is written as text: a CodeMirror 6 editor
// with the Ridr query language's highlighting and completions, that
// underlines a QueryProblem where the server reported it and shows its
// message beneath. Explore and Dashboard Widgets both use it. Mod-Enter
// submits.

// QueryProblemAt is where a text Query is wrong, as a QueryProblem says:
// line and column from 1. Read one from an error with queryProblemOf.
export type QueryProblemAt = { message: string; line: number; column: number };

// Words the editor offers besides the language's own, from the Catalog
// and the registry.
export type QueryVocabulary = { metrics?: readonly string[]; assets?: readonly string[] };

type QueryEditorProps = {
  value: string;
  onChange: (text: string) => void;
  onSubmit?: (text: string) => void;
  // Where the last run said the text is wrong; underlined until replaced.
  problem?: QueryProblemAt | null;
  vocabulary?: QueryVocabulary;
  // Names the editor for assistive tech.
  label?: string;
  placeholder?: string;
};

export function QueryEditor({
  value,
  onChange,
  onSubmit,
  problem,
  vocabulary,
  label = "Query",
  placeholder = "measurements | range last 1h",
}: QueryEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  // The latest callbacks and words, read by the editor without rebuilding it.
  const latest = useRef({ onChange, onSubmit, vocabulary });
  latest.current = { onChange, onSubmit, vocabulary };

  useEffect(() => {
    const made = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          keymap.of([
            {
              key: "Mod-Enter",
              run: (editor) => {
                latest.current.onSubmit?.(editor.state.doc.toString());
                return true;
              },
            },
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          ridrQueryLanguage,
          syntaxHighlighting(classHighlighter),
          autocompletion({
            override: [(context) => complete(context, latest.current.vocabulary)],
          }),
          lintGutter(),
          placeholderText(placeholder),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ "aria-label": label, "aria-multiline": "true" }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) latest.current.onChange(update.state.doc.toString());
          }),
          theme,
        ],
      }),
    });
    view.current = made;
    return () => {
      made.destroy();
      view.current = null;
    };
    // The editor is built once; value and problem are pushed in below.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Take a value set from outside, as when the URL changes.
  useEffect(() => {
    const editor = view.current;
    if (!editor || editor.state.doc.toString() === value) return;
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
  }, [value]);

  // Underline the problem, or clear the underline when it goes.
  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    const diagnostics = problem ? [diagnosticAt(editor.state.doc, problem)] : [];
    editor.dispatch(setDiagnostics(editor.state, diagnostics));
  }, [problem]);

  return (
    <div className="flex flex-col gap-1">
      <div
        ref={host}
        data-invalid={problem ? "true" : undefined}
        className="border-input focus-within:border-ring focus-within:ring-ring/50 data-[invalid=true]:border-destructive overflow-hidden rounded-md border font-mono text-sm focus-within:ring-[3px]"
      />
      {problem && (
        <p role="alert" className="text-destructive text-sm">
          Line {problem.line}, column {problem.column}: {problem.message}
        </p>
      )}
    </div>
  );
}

// diagnosticAt marks the word starting at a problem's line and column,
// or the one character there, kept inside the text.
function diagnosticAt(doc: Text, problem: QueryProblemAt): Diagnostic {
  const line = doc.line(Math.min(Math.max(problem.line, 1), doc.lines));
  const from = Math.min(line.from + Math.max(problem.column - 1, 0), line.to);
  const word = /^[^\s|,()]+/.exec(doc.sliceString(from, line.to))?.[0].length ?? 0;
  const to = Math.min(from + Math.max(word, 1), doc.length);
  return { from, to, severity: "error", message: problem.message };
}

function complete(context: CompletionContext, vocabulary?: QueryVocabulary): CompletionResult | null {
  const word = context.matchBefore(/[\w.]+/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  return {
    from: word.from,
    options: [
      ...sources.map((label) => ({ label, type: "type" })),
      ...keywords.map((label) => ({ label, type: "keyword" })),
      ...functions.map((label) => ({ label, type: "function" })),
      ...fields.map((label) => ({ label, type: "property" })),
      ...quoted(vocabulary?.metrics, "constant"),
      ...quoted(vocabulary?.assets, "variable"),
    ],
    validFor: /^[\w.]*$/,
  };
}

// quoted offers names as values: bare when they can be, else quoted.
function quoted(names: readonly string[] = [], type: string) {
  return names.map((name) => ({ label: /^[^\s|,="()]+$/.test(name) ? name : JSON.stringify(name), type }));
}

// Colours follow the app's tokens, so light and dark both work.
const theme = EditorView.theme({
  "&": { backgroundColor: "var(--background)", color: "var(--foreground)" },
  "&.cm-focused": { outline: "none" },
  ".cm-content": { padding: "8px 0", caretColor: "var(--foreground)", minHeight: "4.5rem" },
  ".cm-gutters": { backgroundColor: "var(--muted)", border: "none" },
  ".cm-placeholder": { color: "var(--muted-foreground)" },
  ".cm-lintRange-error": {
    backgroundImage: "none",
    textDecoration: "underline wavy var(--destructive)",
    textUnderlineOffset: "3px",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid var(--border)",
  },
  ".tok-typeName": { color: "var(--query-source)", fontWeight: "600" },
  ".tok-keyword": { color: "var(--query-keyword)" },
  ".tok-operator": { color: "var(--query-operator)", fontWeight: "600" },
  ".tok-number": { color: "var(--query-duration)" },
  ".tok-string": { color: "var(--query-string)" },
  ".tok-macroName": { color: "var(--query-function)" },
  ".tok-propertyName": { color: "var(--query-field)" },
  ".tok-invalid": { color: "var(--destructive)" },
});
