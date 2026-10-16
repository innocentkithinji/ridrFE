import type { ControlledKey } from "@ridr/web";

// One Attribute while it is being edited. id keeps React's rows stable
// while keys change.
export type AttributeRow = { id: number; key: string; value: string };

// What may be wrong with one row, by field.
export type AttributeProblem = { key?: string; value?: string };

// Attribute keys are letters, digits, "_" or "-", as Ridr requires.
const keyPattern = /^[A-Za-z0-9_-]+$/;

let nextId = 0;

// newAttributeRow returns an empty row to fill in.
export function newAttributeRow(): AttributeRow {
  return { id: nextId++, key: "", value: "" };
}

// attributeRowsOf turns an Asset's Attributes into rows, sorted by key.
export function attributeRowsOf(attributes: Record<string, string>): AttributeRow[] {
  return Object.entries(attributes)
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({ id: nextId++, key, value }));
}

// attributesOf turns rows back into the map Ridr takes.
export function attributesOf(rows: AttributeRow[]): Record<string, string> {
  return Object.fromEntries(rows.map((row) => [row.key.trim(), row.value]));
}

// allowedValuesOf returns the values a Controlled key allows, or
// undefined for a free key.
export function allowedValuesOf(
  key: string,
  controlledKeys: ControlledKey[],
): string[] | undefined {
  return controlledKeys.find((controlled) => controlled.key === key.trim())?.allowedValues;
}

// attributeProblems checks every row the way Ridr will, so the form can
// say what to fix before saving. Rows with no problem map to {}.
export function attributeProblems(
  rows: AttributeRow[],
  controlledKeys: ControlledKey[],
): AttributeProblem[] {
  const keys = rows.map((row) => row.key.trim());
  return rows.map((row, index) => {
    const key = keys[index];
    const problem: AttributeProblem = {};
    if (!key) {
      problem.key = "Give a key.";
    } else if (!keyPattern.test(key)) {
      problem.key = "Use only letters, digits, _ or -.";
    } else if (keys.indexOf(key) !== index) {
      problem.key = "This key is already used above.";
    }
    const allowed = allowedValuesOf(key, controlledKeys);
    if (allowed && !allowed.includes(row.value)) {
      problem.value = "Choose one of the allowed values.";
    } else if (!row.value.trim()) {
      problem.value = "Give a value.";
    }
    return problem;
  });
}

// hasAttributeProblems tells whether any row needs fixing.
export function hasAttributeProblems(problems: AttributeProblem[]): boolean {
  return problems.some((problem) => problem.key || problem.value);
}
