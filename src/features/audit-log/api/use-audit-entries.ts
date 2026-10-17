import { useQuery } from "@connectrpc/connect-query";
import { AuditService } from "@ridr/web";
import { requestFrom, type AuditFilters } from "@/features/audit-log/filters";

// useAuditEntries reads the Audit log, newest first. Cached by method
// and request; there are no mutations, so nothing invalidates it.
export function useAuditEntries(filters: AuditFilters) {
  return useQuery(AuditService.method.listAuditEntries, requestFrom(filters));
}
