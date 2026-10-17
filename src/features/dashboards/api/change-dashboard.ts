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
// editor then offers to reload it or save on top of it. The saved
// version shows at once, then every Dashboard read reloads.
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

// useRestoreDashboardVersion saves an earlier version again as the
// newest, then every Dashboard read reloads.
export function useRestoreDashboardVersion() {
  const queryClient = useQueryClient();
  return useMutation(DashboardService.method.restoreDashboardVersion, {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: serviceKey }),
  });
}

// useShareDashboard shares a Dashboard with the Organisation or makes it
// private again; only its owner may.
export function useShareDashboard() {
  const queryClient = useQueryClient();
  return useMutation(DashboardService.method.shareDashboard, {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: serviceKey }),
  });
}

// useDeleteDashboard deletes a Dashboard and every version. Its detail's
// cache entries go, so nothing refetches a Dashboard that is gone, and
// the list reloads. The caller then navigates to the list.
export function useDeleteDashboard() {
  const queryClient = useQueryClient();
  return useMutation(DashboardService.method.deleteDashboard, {
    onSuccess: (_answer, request) => {
      const input = { dashboardId: request.dashboardId };
      const { getDashboard, listDashboardVersions } = DashboardService.method;
      queryClient.removeQueries({ queryKey: createConnectQueryKey({ schema: getDashboard, input, cardinality: undefined }) });
      queryClient.removeQueries({
        queryKey: createConnectQueryKey({ schema: listDashboardVersions, input, cardinality: undefined }),
      });
      return queryClient.invalidateQueries({ queryKey: listKey });
    },
  });
}
