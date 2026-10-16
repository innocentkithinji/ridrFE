import { Role, type Scope } from "@ridr/web";

// The Roles a member may hold, from least to most access.
export const roles = [Role.VIEWER, Role.EDITOR, Role.ADMIN] as const;

const roleLabels: Record<Role, string> = {
  [Role.UNSPECIFIED]: "Unknown",
  [Role.VIEWER]: "Viewer",
  [Role.EDITOR]: "Editor",
  [Role.ADMIN]: "Admin",
};

// roleLabel names a Role for the screen: "Viewer", "Editor", "Admin".
export function roleLabel(role: Role): string {
  return roleLabels[role];
}

// scopeText describes a Scope in one line, as "mode: bus, tram; site:
// nairobi", or "Whole Organisation" when it has no conditions.
export function scopeText(scope: Scope | undefined): string {
  const conditions = scope?.conditions ?? [];
  if (conditions.length === 0) {
    return "Whole Organisation";
  }
  return conditions.map((c) => `${c.key}: ${c.values.join(", ")}`).join("; ");
}

// The roles and Permissions each grants, beside every Role picker.
export const permissionsTableUrl =
  "https://github.com/innocentkithinji/ridr/blob/main/docs/frontend/reference/permissions.md";
