import { Check, Copy } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { fill, segments, type GuideValues } from "@/components/agent-guide/fill";

type CodeBlockProps = {
  text: string;
  values: GuideValues;
  // The copy button's name, as in "Copy example".
  copyLabel: string;
};

// CodeBlock shows example text with its placeholders marked, and copies
// it as the reader would paste it.
export function CodeBlock({ text, values, copyLabel }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    await navigator.clipboard.writeText(fill(text, values));
    setCopied(true);
  }

  return (
    <div className="bg-muted relative rounded-lg border">
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2"
        onClick={() => void copy()}
      >
        {copied ? <Check /> : <Copy />}
        {copied ? "Copied" : copyLabel}
      </Button>
      <pre className="overflow-x-auto p-4 pr-28 font-mono text-sm leading-relaxed">
        <code>
          {segments(text, values).map((segment, i) =>
            segment.placeholder ? (
              <Placeholder key={i}>{segment.text}</Placeholder>
            ) : (
              segment.text
            ),
          )}
        </code>
      </pre>
    </div>
  );
}

// Placeholder marks a value the reader must put in, so it stands out
// from the code around it.
export function Placeholder({ children }: { children: ReactNode }) {
  return <mark className="rounded bg-amber-200 px-1 font-semibold text-amber-950 dark:bg-amber-400/25 dark:text-amber-200">{children}</mark>;
}
