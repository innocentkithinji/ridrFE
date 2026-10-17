import type { MqttBridge } from "@ridr/web";

// The credit lines the demo's open data needs wherever it is shown (CC BY
// 4.0), keyed by the broker host they come from.
const credits = [
  {
    matches: (host: string) => host === "mqtt.hsl.fi",
    line: "HSL vehicle positions © Digitransit 2026, CC BY 4.0, received live.",
  },
  {
    matches: (host: string) => host === "digitraffic.fi" || host.endsWith(".digitraffic.fi"),
    line: "Source: Fintraffic / digitraffic.fi, CC BY 4.0.",
  },
];

function hostOf(brokerUrl: string): string {
  try {
    return new URL(brokerUrl).hostname.toLowerCase();
  } catch {
    return "";
  }
}

// creditLines lists the credit lines the bridges that aren't retired
// need, each once.
export function creditLines(bridges: MqttBridge[]): string[] {
  const hosts = bridges
    .filter((b) => b.adapter?.retiredAt === undefined)
    .map((b) => hostOf(b.brokerUrl));
  return credits.filter((c) => hosts.some(c.matches)).map((c) => c.line);
}

// DataCredit shows the credit for the open data these bridges bring in,
// or nothing when none needs one.
export function DataCredit({ bridges }: { bridges: MqttBridge[] }) {
  const lines = creditLines(bridges);
  if (lines.length === 0) return null;
  return (
    <aside aria-label="Data credit" className="text-muted-foreground space-y-0.5 text-xs">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </aside>
  );
}
