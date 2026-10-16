import { useQuery as useRpcQuery } from "@connectrpc/connect-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CatalogService } from "@ridr/web";
import { useCallback, useMemo } from "react";
import { useCan, useMe } from "@/lib/me";
import {
  browserUnitPreferenceStore,
  withUnitPreference,
  type UnitPreferenceStore,
} from "@/lib/unit-preferences";

// Hooks over the signed-in user's Unit preferences. Every screen that
// writes Queries for the user (Explore, Asset detail, Home, Dashboards)
// goes through useWithUnitPreference.

// Preferences change rarely.
const preferencesStaleTime = 5 * 60_000;

// unitPreferencesKey matches the cached list, to refetch it after a change.
export const unitPreferencesKey = ["unitPreferences"] as const;

// useUnitPreferenceStore is where this user's preferences live. Browser
// storage today; PreferenceService once Ridr serves it (ridr#53).
function useUnitPreferenceStore(): UnitPreferenceStore {
  const { tenantId, userId } = useMe();
  return useMemo(() => browserUnitPreferenceStore({ tenantId, userId }), [tenantId, userId]);
}

// useUnitPreferences lists the user's preferences, one per Quantity kind.
export function useUnitPreferences() {
  const store = useUnitPreferenceStore();
  return useQuery({
    queryKey: unitPreferencesKey,
    queryFn: () => store.list(),
    staleTime: preferencesStaleTime,
  });
}

// useSetUnitPreference chooses the Unit for one Quantity kind.
export function useSetUnitPreference() {
  const store = useUnitPreferenceStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quantityKind, unit }: { quantityKind: string; unit: string }) =>
      store.set(quantityKind, unit),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: unitPreferencesKey }),
  });
}

// useClearUnitPreference goes back to the Unit Readings were reported in.
export function useClearUnitPreference() {
  const store = useUnitPreferenceStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (quantityKind: string) => store.clear(quantityKind),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: unitPreferencesKey }),
  });
}

// useWithUnitPreference adds the user's preferred Unit for a Metric's
// Quantity kind to Query text the app writes for them. Wait for `ready`
// before running the text, so the Query doesn't run twice. Without the
// Catalog (or on any failure) the text is left as written: values show
// in Ridr's Units.
export function useWithUnitPreference() {
  const canListMetrics = useCan(CatalogService.method.listMetrics);
  const metrics = useRpcQuery(
    CatalogService.method.listMetrics,
    {},
    { staleTime: preferencesStaleTime, enabled: canListMetrics },
  );
  const preferences = useUnitPreferences();
  const kinds = metrics.data?.metrics;
  const chosen = preferences.data;

  const apply = useCallback(
    (queryText: string, metric: string) => {
      const kind = kinds?.find((known) => known.name === metric)?.quantityKind ?? "";
      return withUnitPreference(queryText, kind, chosen ?? []);
    },
    [kinds, chosen],
  );
  const ready = !preferences.isPending && !(canListMetrics && metrics.isPending);
  return { ready, apply };
}
