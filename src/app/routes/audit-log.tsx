import { lazy } from "react";
import { AuditService } from "@ridr/web";
import { RequirePermission } from "@/components/require-permission";
import { permissionOf } from "@/lib/me";

// Screens load on first visit, keeping them out of the first download.
const AuditLogScreen = lazy(() => import("@/features/audit-log/components/audit-log-screen").then((m) => ({ default: m.AuditLogScreen })));

export const auditLogPath = "/settings/audit-log";

// Whole-Organisation admins only; the same Permission gates the nav link.
export const auditLogPermission = permissionOf(AuditService.method.listAuditEntries);

export function AuditLogRoute() {
  return (
    <RequirePermission permission={auditLogPermission} what="the Audit log">
      <AuditLogScreen />
    </RequirePermission>
  );
}
