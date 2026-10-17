import { fromJsonString } from "@bufbuild/protobuf";
import { ConnectError } from "@connectrpc/connect";
import { codeFromHttpStatus, codeFromString } from "@connectrpc/connect/protocol-connect";
import {
  ReadingSchema,
  RunQueryResponseSchema,
  type Reading,
  type RunQueryResponse,
} from "@ridr/web";
import { EventSourceParserStream, type EventSourceMessage } from "eventsource-parser/stream";

// The wire side of a Live query: one open of GET /v1/live-query, read as
// Server-Sent Events. useLiveQuery keeps it open and writes it into the
// cache; screens never call this directly.

// LiveEvent is one event of a Live query: its answer at opening, then
// each new Reading (a Measurement, Location or Event).
export type LiveEvent =
  | { type: "result"; result: RunQueryResponse }
  | { type: "reading"; reading: Reading };

export type LiveQueryRequest = {
  baseUrl: string;
  text: string;
  token: string | null;
  signal: AbortSignal;
  // Called once the server has accepted the query, before any event.
  onOpen: () => void;
  onEvent: (event: LiveEvent) => void;
};

// followLiveQuery opens a Live query and passes on its events until the
// server closes it. It throws a ConnectError carrying the server's code
// and message when the server refuses it, such as for a bad query.
// The token goes in a header (fetch, not EventSource), never the URL.
export async function followLiveQuery(request: LiveQueryRequest): Promise<void> {
  const url = new URL("/v1/live-query", request.baseUrl);
  url.searchParams.set("text", request.text);
  const headers = new Headers({ Accept: "text/event-stream" });
  if (request.token) {
    headers.set("Authorization", `Bearer ${request.token}`);
  }
  const response = await fetch(url, { headers, signal: request.signal });
  if (!response.ok || !response.body) {
    throw await errorOf(response);
  }
  request.onOpen();
  const reader = response.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new EventSourceParserStream())
    .getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    const event = toLiveEvent(value);
    if (event) request.onEvent(event);
  }
}

// toLiveEvent decodes an event's one line of protobuf JSON. Comments
// (": ping") never reach here; unknown event types are skipped, so the
// server can add new ones.
function toLiveEvent(message: EventSourceMessage): LiveEvent | null {
  const options = { ignoreUnknownFields: true };
  switch (message.event) {
    case "result":
      return { type: "result", result: fromJsonString(RunQueryResponseSchema, message.data, options) };
    case "reading":
    case "location":
    case "event":
      return { type: "reading", reading: fromJsonString(ReadingSchema, message.data, options) };
    default:
      return null;
  }
}

type ErrorBody = { code?: string; message?: string };

// errorOf reads the Connect error the server refused with, or makes one
// from the HTTP status when the body holds none.
async function errorOf(response: Response): Promise<ConnectError> {
  const byStatus = codeFromHttpStatus(response.status);
  try {
    const body = (await response.json()) as ErrorBody;
    const code = codeFromString(body.code ?? "") ?? byStatus;
    return new ConnectError(body.message ?? response.statusText, code);
  } catch {
    return new ConnectError(response.statusText, byStatus);
  }
}
