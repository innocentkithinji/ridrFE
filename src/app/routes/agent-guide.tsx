import { AgentGuide } from "@/features/agent-guide/components/agent-guide";

// AgentGuideRoute is the public Agent guide: no Session, no Ridr calls,
// placeholders where an Adapter ID and an Ingest key go.
export function AgentGuideRoute() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <AgentGuide />
    </main>
  );
}
