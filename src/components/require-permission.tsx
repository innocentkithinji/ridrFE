import type { ReactNode } from "react";
import { PermissionDenied } from "@/components/states";
import { useHasPermission, type Permission } from "@/lib/me";

type RequirePermissionProps = {
  // The route's gating Permission, from permissionOf(Service.method.x).
  permission: Permission;
  // What the route shows, for the denied message: "Alerts", "Rules"...
  what: string;
  children: ReactNode;
};

// RequirePermission gates a route: without its Permission the user sees
// the permission-denied state at the URL instead of the screen.
export function RequirePermission(props: RequirePermissionProps) {
  if (!useHasPermission(props.permission)) {
    return <PermissionDenied what={props.what} />;
  }
  return props.children;
}
