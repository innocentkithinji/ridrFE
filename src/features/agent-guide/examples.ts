// The Agent guide's examples, written by hand from the Ridr SDKs'
// READMEs and examples (../Ridr/sdk/{go,python,ts}). Keep them in step
// with those when the SDKs change.
//
// {{ADAPTER_ID}}, {{INGEST_KEY}} and {{RIDR_URL}} mark the values the
// guide fills in (see fill.ts).

export type Language = "go" | "python" | "typescript";

export type Example = {
  language: Language;
  label: string;
  // How to get the SDK: shell lines.
  install: string;
  code: string;
};

const go = `// An Agent for the Adapter {{ADAPTER_ID}}: a delivery van that reports
// its fridge temperature, position and door events to Ridr.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"time"

	"github.com/innocentkithinji/ridr/sdk/go/ridr"
)

func main() {
	agent, err := ridr.New(ridr.Config{
		URL:       "{{RIDR_URL}}",
		IngestKey: "{{INGEST_KEY}}",
		// The Manifest: each metric this Agent sends, and its unit.
		Manifest: []ridr.ManifestEntry{
			{Metric: "temperature", Unit: "Cel"},
		},
	})
	if err != nil {
		slog.Error("configure agent", "err", err)
		os.Exit(1)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()
	go agent.Run(ctx) // sends what is queued every second

	tags := map[string]string{"route": "46"}
	agent.QueueMeasurement(ridr.Measurement{
		DeviceID: "van-1",
		Metric:   "temperature",
		Value:    4.2,
		Tags:     tags,
	})
	agent.QueueLocation(ridr.Location{
		DeviceID:  "van-1",
		Latitude:  -1.2921,
		Longitude: 36.8219,
		Accuracy:  ridr.Metres(5),
		Tags:      tags,
	})
	agent.QueueEvent(ridr.Event{
		DeviceID: "van-1",
		Name:     "door_opened",
		Fields:   map[string]string{"door": "rear"},
	})

	<-ctx.Done()
	// The last flush before exit, with a few seconds to finish.
	flushCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := agent.Flush(flushCtx); err != nil {
		slog.Warn("last flush failed", "err", err, "unsent", agent.Queued())
	}
}
`;

const python = `"""An Agent for the Adapter {{ADAPTER_ID}}: a delivery van that reports
its fridge temperature, position and door events to Ridr."""

import threading

import ridr

agent = ridr.Agent(
    ridr.Config(
        url="{{RIDR_URL}}",
        ingest_key="{{INGEST_KEY}}",
        # The Manifest: each metric this Agent sends, and its unit.
        manifest=[ridr.ManifestEntry(metric="temperature", unit="Cel")],
    )
)
stop = threading.Event()
sender = threading.Thread(target=agent.run, args=(stop,))
sender.start()  # sends what is queued every second

tags = {"route": "46"}
agent.queue_measurement(
    ridr.Measurement(
        device_id="van-1", metric="temperature", value=4.2, tags=tags
    )
)
agent.queue_location(
    ridr.Location(
        device_id="van-1",
        latitude=-1.2921,
        longitude=36.8219,
        accuracy=5,
        tags=tags,
    )
)
agent.queue_event(
    ridr.Event(device_id="van-1", name="door_opened", fields={"door": "rear"})
)

stop.set()
sender.join()
try:
    agent.flush()  # last flush before exit
except ridr.RidrError as error:
    print(f"last flush failed, {agent.queued()} unsent: {error}")
`;

const typescript = `// An Agent for the Adapter {{ADAPTER_ID}}: a delivery van that reports
// its fridge temperature, position and door events to Ridr.
import { Agent } from "@ridr/sdk";

const agent = new Agent({
  url: "{{RIDR_URL}}",
  ingestKey: "{{INGEST_KEY}}",
  // The Manifest: each metric this Agent sends, and its unit.
  manifest: [{ metric: "temperature", unit: "Cel" }],
});

const stop = new AbortController();
process.once("SIGINT", () => stop.abort());
const running = agent.run(stop.signal); // sends what is queued every second

const tags = { route: "46" };
agent.queueMeasurement({ deviceId: "van-1", metric: "temperature", value: 4.2, tags });
agent.queueLocation({ deviceId: "van-1", latitude: -1.2921, longitude: 36.8219, accuracy: 5, tags });
agent.queueEvent({ deviceId: "van-1", name: "door_opened", fields: { door: "rear" } });

await running;
try {
  await agent.flush(AbortSignal.timeout(5000)); // last flush before exit
} catch (err) {
  console.warn(\`last flush failed, \${agent.queued()} unsent:\`, err);
}
`;

export const examples: Example[] = [
  {
    language: "go",
    label: "Go",
    install: "go get github.com/innocentkithinji/ridr/sdk/go/ridr",
    code: go,
  },
  {
    language: "python",
    label: "Python",
    install: [
      "# from a checkout of the Ridr repository; needs Python 3.12+",
      "pip install ./ridr/sdk/python",
    ].join("\n"),
    code: python,
  },
  {
    language: "typescript",
    label: "TypeScript",
    install: [
      "# from a checkout of the Ridr repository; needs Node 22+",
      "npm --prefix ridr/sdk/ts ci && npm --prefix ridr/sdk/ts run build",
      "npm install ./ridr/sdk/ts",
    ].join("\n"),
    code: typescript,
  },
];
