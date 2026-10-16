import { StreamLanguage, type StringStream } from "@codemirror/language";

// The Ridr query language for CodeMirror: a tokenizer for highlighting
// (see the backend's reference/query-language.md). Each token is named
// by a standard highlight tag, which classHighlighter turns into a
// `tok-<tag>` class the editor's theme colours:
//
//   sources        measurements, locations, events   tok-typeName
//   keywords       where, range, rollup, and, in...   tok-keyword
//   operators      | and ==                           tok-operator
//   durations      90s, 15m, 6h, 7d                   tok-number
//   strings        "Demo fridge"                      tok-string
//   functions      avg, p95, p99.9                    tok-macroName
//   fields         asset, asset.site, tag.route...    tok-propertyName

export const sources = ["measurements", "locations", "events"];
export const stages = ["where", "range", "rollup", "unit", "limit"];
export const keywords = [...stages, "and", "in", "last", "to", "every", "by", "all"];
export const functions = ["avg", "min", "max", "sum", "count", "first", "last", "p95", "p99"];
export const fields = ["device", "adapter", "asset", "metric", "name"];

const sourceSet = new Set(sources);
const keywordSet = new Set(keywords);
const fieldSet = new Set(fields);
const functionSet = new Set(functions.filter((name) => name !== "last"));
const percentile = /^p\d+(\.\d+)?$/;
const duration = /^\d+[smhd]$/;
// A bare word: no spaces, `|`, `,`, `=`, `"` or parentheses.
const bareWord = /^[^\s|,="()]+/;

function token(stream: StringStream): string | null {
  if (stream.eatSpace()) return null;
  if (stream.eat('"')) {
    let escaped = false;
    for (let next = stream.next(); next !== undefined; next = stream.next()) {
      if (next === '"' && !escaped) return "string";
      escaped = !escaped && next === "\\";
    }
    return "string";
  }
  if (stream.eat("|") || stream.match("==")) return "operator";
  if (stream.eat(/[,()]/)) return "punctuation";
  const word = stream.match(bareWord) as RegExpMatchArray | null;
  if (!word) {
    stream.next();
    return "invalid";
  }
  const text = word[0];
  if (sourceSet.has(text)) return "typeName";
  if (keywordSet.has(text)) return "keyword";
  if (duration.test(text)) return "number";
  if (functionSet.has(text) || percentile.test(text)) return "macroName";
  if (fieldSet.has(text) || text.startsWith("asset.") || text.startsWith("tag.")) {
    return "propertyName";
  }
  return null;
}

export const ridrQueryLanguage = StreamLanguage.define<null>({
  name: "ridr-query",
  startState: () => null,
  token,
});
