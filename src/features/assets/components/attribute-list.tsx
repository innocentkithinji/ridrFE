// AttributeList shows an Asset's Attributes as key=value chips, by key.
export function AttributeList({ attributes }: { attributes: Record<string, string> }) {
  const entries = Object.entries(attributes).toSorted(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) {
    return null;
  }
  return (
    <ul aria-label="Attributes" className="flex flex-wrap gap-1.5">
      {entries.map(([key, value]) => (
        <li
          key={key}
          className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 font-mono text-xs"
        >
          {key}={value}
        </li>
      ))}
    </ul>
  );
}
