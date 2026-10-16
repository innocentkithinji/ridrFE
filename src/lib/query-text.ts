// Edits to Query text that keep the rest of it as written.

// hasUnitStage tells whether Query text already names a `unit` stage.
export function hasUnitStage(text: string): boolean {
  return splitStages(text).some((stage, index) => index > 0 && /^\s*unit\b/.test(stage));
}

// withUnitStage sets a Query text's `unit` stage to unit, replacing the
// one it has; "" removes it, so values come back as reported.
export function withUnitStage(text: string, unit: string): string {
  const stages = splitStages(text);
  const kept = stages.filter((stage, index) => index === 0 || !/^\s*unit\b/.test(stage));
  const base = kept.join("|").trimEnd();
  return unit ? `${base} | unit ${unit}` : base;
}

// splitStages splits Query text at each `|` outside a quoted string.
function splitStages(text: string): string[] {
  const stages: string[] = [];
  let start = 0;
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted && char === "\\") i++;
    else if (char === '"') quoted = !quoted;
    else if (char === "|" && !quoted) {
      stages.push(text.slice(start, i));
      start = i + 1;
    }
  }
  return [...stages, text.slice(start)];
}
