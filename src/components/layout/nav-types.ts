import type { LucideIcon } from "lucide-react";
import type { Permission } from "@/lib/me";

// One link in the sidebar. It shows only when GetMe lists its Permission,
// which must be the same Permission that gates its route.
export type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  permission: Permission;
};

// A titled section of the sidebar; one with no visible links is hidden.
export type NavGroup = {
  label: string;
  items: NavItem[];
};
