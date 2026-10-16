import { BookOpen, KeyRound, ScrollText, Users } from "lucide-react";
import type { NavGroup } from "@/components/layout/nav-types";
import { auditLogPath, auditLogPermission } from "@/app/routes/audit-log";
import { catalogPath, catalogPermission } from "@/app/routes/catalog";
import { controlledKeysPath, controlledKeysPermission } from "@/app/routes/controlled-keys";
import { teamPath, teamPermission } from "@/app/routes/team";
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
    items: [],
  },
  {
    label: "Alerting", // Rules, Silences, Contact groups
    items: [],
  },
  {
    label: "Settings", // Data sources, Catalog, Controlled keys, Team, Audit log
    items: [
      { label: "Catalog", to: catalogPath, icon: BookOpen, permission: catalogPermission },
      {
        label: "Controlled keys",
        to: controlledKeysPath,
        icon: KeyRound,
        permission: controlledKeysPermission,
      },
      { label: "Team", to: teamPath, icon: Users, permission: teamPermission },
      { label: "Audit log", to: auditLogPath, icon: ScrollText, permission: auditLogPermission },
      ...testOnlyNav,
    ],
  },
];
