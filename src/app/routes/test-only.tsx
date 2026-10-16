import { FlaskConical } from "lucide-react";
import type { NavItem } from "@/components/layout/nav-types";
import { RequirePermission } from "@/components/require-permission";
import { AgentGuide } from "@/features/agent-guide/components/agent-guide";

// A route gated by a Permission nobody has, so the end-to-end tests can
// prove a missing Permission hides the link and denies the URL. It
// exists only in the dev server, never in a production build.

const noOne = "ridr.test.TestOnlyService/NobodyHasThis";

export const testOnlyPath = "/test-only/gated";

export const testOnlyNav: NavItem[] = import.meta.env.DEV
  ? [{ label: "Gated test route", to: testOnlyPath, icon: FlaskConical, permission: noOne }]
  : [];

export function TestOnlyGatedRoute() {
  return (
    <RequirePermission permission={noOne} what="the gated test route">
      <p>You should never see this.</p>
    </RequirePermission>
  );
}

// The Agent guide filled in, as the screen shown after an Adapter is
// registered will mount it, so the tests can prove the placeholders give
// way to real values.
export const testOnlyAgentGuidePath = "/test-only/agent-guide";

export function TestOnlyAgentGuideRoute() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <AgentGuide adapterId="adp_test_1" ingestKey="rik_test_secret" />
    </main>
  );
}
