import { Boxes } from "lucide-react";
import { assetsPermission } from "@/app/routes/assets";
import type { NavGroup } from "@/components/layout/nav-types";
import { testOnlyNav } from "@/app/routes/test-only";

// The sidebar. Each feature adds its link to its group here, with the
// same Permission that gates its route in router.tsx. A group with no
// link the user may open is hidden, so empty groups cost nothing.
export const nav: NavGroup[] = [
  {
    label: "Monitor", // Home, Alerts, Explore, Dashboards
    items: [],
  },
  {
    label: "Fleet", // Assets, Unclaimed devices
    items: [{ label: "Assets", to: "/assets", icon: Boxes, permission: assetsPermission }],
  },
  {
    label: "Alerting", // Rules, Silences, Contact groups
    items: [],
  },
  {
    label: "Settings", // Data sources, Catalog, Controlled keys, Team, Audit log
    items: [...testOnlyNav],
  },
];
