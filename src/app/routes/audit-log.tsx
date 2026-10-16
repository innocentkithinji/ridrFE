import { AuditService } from "@ridr/web";
import { RequirePermission } from "@/components/require-permission";
import { AuditLogScreen } from "@/features/audit-log/components/audit-log-screen";
import { permissionOf } from "@/lib/me";

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
