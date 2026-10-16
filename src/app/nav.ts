import { BookOpen, Boxes, Cable, ChartLine, KeyRound, ScrollText, Users, UsersRound } from "lucide-react";
import type { NavGroup } from "@/components/layout/nav-types";
import { assetsPath, assetsPermission } from "@/app/routes/assets";
import { auditLogPath, auditLogPermission } from "@/app/routes/audit-log";
import { explorePath, explorePermission } from "@/app/routes/explore";
import { catalogPath, catalogPermission } from "@/app/routes/catalog";
import { contactGroupsPath, contactGroupsPermission } from "@/app/routes/contact-groups";
import { controlledKeysPath, controlledKeysPermission } from "@/app/routes/controlled-keys";
import { teamPath, teamPermission } from "@/app/routes/team";
import { dataSourcesPath, dataSourcesPermission } from "@/app/routes/data-sources";
import { testOnlyNav } from "@/app/routes/test-only";

// The sidebar. Each feature adds its link to its group here, with the
// same Permission that gates its route in router.tsx. A group with no
// link the user may open is hidden, so empty groups cost nothing.
export const nav: NavGroup[] = [
  {
    label: "Monitor", // Home, Alerts, Explore, Dashboards
    items: [{ label: "Explore", to: explorePath, icon: ChartLine, permission: explorePermission }],
  },
  {
    label: "Fleet", // Assets, Unclaimed devices
    items: [{ label: "Assets", to: assetsPath, icon: Boxes, permission: assetsPermission }],
  },
  {
    label: "Alerting", // Rules, Silences, Contact groups
    items: [
      {
        label: "Contact groups",
        to: contactGroupsPath,
        icon: UsersRound,
        permission: contactGroupsPermission,
      },
    ],
  },
  {
    label: "Settings", // Data sources, Catalog, Controlled keys, Team, Audit log
    items: [
      { label: "Data sources", to: dataSourcesPath, icon: Cable, permission: dataSourcesPermission },
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
