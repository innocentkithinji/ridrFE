import { FlaskConical } from "lucide-react";
import type { NavItem } from "@/components/layout/nav-types";
import { RequirePermission } from "@/components/require-permission";

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
