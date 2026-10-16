// Ridr tells a Webhook connector's URL only when it creates the
// connector, and ListAdapters doesn't say which Adapters are Webhook
// connectors. So this browser remembers, per Adapter, the URL's start:
// everything before the Ingest key, which is no secret. A new Ingest key
// then makes a new URL: the start followed by the key.

const storageKey = "ridr.webhook-url-starts";

type Starts = Record<string, string>;

function read(): Starts {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? "{}") as unknown;
    return stored && typeof stored === "object" ? (stored as Starts) : {};
  } catch {
    return {};
  }
}

// rememberWebhookUrl keeps the start of a new Webhook connector's URL,
// which ends with its Ingest key.
export function rememberWebhookUrl(adapterId: string, url: string, ingestKey: string) {
  if (!url.endsWith(ingestKey)) return;
  try {
    const starts = read();
    starts[adapterId] = url.slice(0, url.length - ingestKey.length);
    localStorage.setItem(storageKey, JSON.stringify(starts));
  } catch {
    // Storage is off: new keys show without their URL.
  }
}

// webhookUrlFor builds the URL a new Ingest key gives a Webhook
// connector, or null when this browser doesn't know the Adapter as one.
export function webhookUrlFor(adapterId: string, ingestKey: string): string | null {
  const start = read()[adapterId];
  return start ? start + ingestKey : null;
}
