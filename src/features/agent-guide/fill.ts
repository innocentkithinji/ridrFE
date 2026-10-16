// Filling an example's {{MARKERS}} in: with the values the guide was
// given, or with placeholders the reader replaces.

export type GuideValues = {
  ridrUrl: string;
  adapterId?: string;
  ingestKey?: string;
};

// A run of example text; a placeholder is shown apart from the rest.
export type Segment = { text: string; placeholder: boolean };

export const placeholders = {
  ADAPTER_ID: "<ADAPTER_ID>",
  INGEST_KEY: "<INGEST_KEY>",
} as const;

const marker = /\{\{(ADAPTER_ID|INGEST_KEY|RIDR_URL)\}\}/g;

function valueOf(name: string, values: GuideValues): string | undefined {
  if (name === "RIDR_URL") return values.ridrUrl;
  if (name === "ADAPTER_ID") return values.adapterId || undefined;
  return values.ingestKey || undefined;
}

// segments splits a text at its markers, filled or left as placeholders.
export function segments(text: string, values: GuideValues): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(marker)) {
    const [whole, name] = match;
    if (match.index > last) out.push({ text: text.slice(last, match.index), placeholder: false });
    const value = valueOf(name, values);
    out.push(
      value === undefined
        ? { text: placeholders[name as keyof typeof placeholders], placeholder: true }
        : { text: value, placeholder: false },
    );
    last = match.index + whole.length;
  }
  if (last < text.length) out.push({ text: text.slice(last), placeholder: false });
  return out;
}

// fill is the text as the reader copies it.
export function fill(text: string, values: GuideValues): string {
  return segments(text, values)
    .map((segment) => segment.text)
    .join("");
}
