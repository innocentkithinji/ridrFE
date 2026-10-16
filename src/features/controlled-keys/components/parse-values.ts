// parseValues splits what the user typed into values: comma-separated,
// trimmed, blanks dropped. Case is kept; values are case-sensitive.
export function parseValues(text: string): string[] {
  return text
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value !== "");
}
