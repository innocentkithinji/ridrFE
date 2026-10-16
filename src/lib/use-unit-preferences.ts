import { useQuery as useRpcQuery, useTransport } from "@connectrpc/connect-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CatalogService } from "@ridr/web";
import { useCallback, useMemo } from "react";
import { useCan } from "@/lib/me";
import {
  ridrUnitPreferenceStore,
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

// useUnitPreferenceStore is where this user's preferences live: Ridr,
// for the signed-in user in the active Organisation. The cache is
// cleared on an Organisation switch, like every other.
function useUnitPreferenceStore(): UnitPreferenceStore {
  const transport = useTransport();
  return useMemo(() => ridrUnitPreferenceStore(transport), [transport]);
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

// useWithUnitPreference adds the user's preferred Unit to Query text the
// app writes for them: for metric's Quantity kind, or, for text that may
// return any Metric (no metric given), the one preference the user has.
// A Query takes one `unit` stage, so text over any Metric from a user
// with several preferences is left as written. Wait for `ready` before
// running the text, so the Query doesn't run twice. Without the Catalog
// or the preferences (or on any failure) the text is left as written:
// values show in Ridr's Units.
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
    (queryText: string, metric?: string) => {
      const preferred = chosen ?? [];
      const kind =
        metric === undefined
          ? preferred.length === 1
            ? preferred[0].quantityKind
            : ""
          : (kinds?.find((known) => known.name === metric)?.quantityKind ?? "");
      return withUnitPreference(queryText, kind, preferred);
    },
    [kinds, chosen],
  );
  const ready = !preferences.isPending && !(canListMetrics && metrics.isPending);
  return { ready, apply };
}
