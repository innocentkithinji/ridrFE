import { createConnectQueryKey, useMutation, useTransport } from "@connectrpc/connect-query";
import { create } from "@bufbuild/protobuf";
import { DashboardService, GetDashboardResponseSchema } from "@ridr/web";
import { useQueryClient } from "@tanstack/react-query";

const listKey = createConnectQueryKey({
  schema: DashboardService.method.listDashboards,
  cardinality: undefined,
});
const serviceKey = createConnectQueryKey({ schema: DashboardService, cardinality: undefined });

// useCreateDashboard creates a Dashboard at version 1, private to the
// user, then reloads the list.
export function useCreateDashboard() {
  const queryClient = useQueryClient();
  return useMutation(DashboardService.method.createDashboard, {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listKey }),
  });
}

// useSaveDashboard saves a new version on top of `baseVersion`, the one
// the user edited. A newer one saved meanwhile is FailedPrecondition; the
// conflict banner (#22) handles it. The saved version shows at once,
// then every Dashboard read reloads.
export function useSaveDashboard() {
  const queryClient = useQueryClient();
  const transport = useTransport();
  return useMutation(DashboardService.method.saveDashboard, {
    onSuccess: (answer, request) => {
      const latest = createConnectQueryKey({
        schema: DashboardService.method.getDashboard,
        input: { dashboardId: request.dashboardId, version: 0 },
        transport,
        cardinality: "finite",
      });
      queryClient.setQueryData(latest, create(GetDashboardResponseSchema, { dashboard: answer.dashboard }));
      return queryClient.invalidateQueries({ queryKey: serviceKey });
    },
  });
}
