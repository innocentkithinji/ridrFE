import {
  Bell,
  BellOff,
  BookOpen,
  Boxes,
  Cable,
  ChartLine,
  CircleDashed,
  KeyRound,
  ScrollText,
  SlidersHorizontal,
  Users,
  UsersRound,
} from "lucide-react";
import type { NavGroup } from "@/components/layout/nav-types";
import { alertsPath, alertsPermission } from "@/app/routes/alerts";
import { assetsPath, assetsPermission } from "@/app/routes/assets";
import { auditLogPath, auditLogPermission } from "@/app/routes/audit-log";
import { explorePath, explorePermission } from "@/app/routes/explore";
import { catalogPath, catalogPermission } from "@/app/routes/catalog";
import { preferencesPath, preferencesPermission } from "@/app/routes/preferences";
import { contactGroupsPath, contactGroupsPermission } from "@/app/routes/contact-groups";
import { controlledKeysPath, controlledKeysPermission } from "@/app/routes/controlled-keys";
import { silencesPath, silencesPermission } from "@/app/routes/silences";
import { teamPath, teamPermission } from "@/app/routes/team";
import { dataSourcesPath, dataSourcesPermission } from "@/app/routes/data-sources";
import { testOnlyNav } from "@/app/routes/test-only";
import { unclaimedDevicesPath, unclaimedDevicesPermission } from "@/app/routes/unclaimed-devices";

// The sidebar. Each feature adds its link to its group here, with the
// same Permission that gates its route in router.tsx. A group with no
// link the user may open is hidden, so empty groups cost nothing.
export const nav: NavGroup[] = [
  {
    label: "Monitor", // Home, Alerts, Explore, Dashboards
    items: [
      { label: "Alerts", to: alertsPath, icon: Bell, permission: alertsPermission },
      { label: "Explore", to: explorePath, icon: ChartLine, permission: explorePermission },
    ],
  },
  {
    label: "Fleet", // Assets, Unclaimed devices
    items: [
      { label: "Assets", to: assetsPath, icon: Boxes, permission: assetsPermission },
      {
        label: "Unclaimed devices",
        to: unclaimedDevicesPath,
        icon: CircleDashed,
        permission: unclaimedDevicesPermission,
        // No Scope admits a Device with no Asset, so the list is always
        // empty for a scoped user.
        hiddenWhenScoped: true,
      },
    ],
  },
  {
    label: "Alerting", // Rules, Silences, Contact groups
    items: [
      { label: "Silences", to: silencesPath, icon: BellOff, permission: silencesPermission },
      {
        label: "Contact groups",
        to: contactGroupsPath,
        icon: UsersRound,
        permission: contactGroupsPermission,
      },
    ],
  },
  {
    label: "Settings", // Data sources, Catalog, Controlled keys, Team, Audit log, Preferences
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
      {
        label: "Preferences",
        to: preferencesPath,
        icon: SlidersHorizontal,
        permission: preferencesPermission,
      },
      ...testOnlyNav,
    ],
  },
];
