import { createConnectQueryKey, useMutation } from "@connectrpc/connect-query";
import { AlertService, ContactGroupService, RuleService } from "@ridr/web";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useNavigate } from "react-router";

const listRulesKey = createConnectQueryKey({ schema: RuleService.method.listRules, cardinality: undefined });
const ruleQueries = createConnectQueryKey({ schema: RuleService, cardinality: undefined });
const alertQueries = createConnectQueryKey({ schema: AlertService, cardinality: undefined });
// A scoped user's Contact groups are those their Rules notify, so every
// Rule change refreshes them.
const contactGroupsKey = createConnectQueryKey({
  schema: ContactGroupService.method.listContactGroups,
  cardinality: undefined,
});

function useInvalidate(keys: QueryKey[]) {
  const queryClient = useQueryClient();
  return () => Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

// useCreateRule creates a Rule; it evaluates new Readings at once.
export function useCreateRule() {
  return useMutation(RuleService.method.createRule, {
    onSuccess: useInvalidate([listRulesKey, contactGroupsKey]),
  });
}

// useUpdateRule replaces a Rule's name, selector, timing, Contact groups
// and condition.
export function useUpdateRule() {
  return useMutation(RuleService.method.updateRule, {
    onSuccess: useInvalidate([ruleQueries, contactGroupsKey]),
  });
}

// useDisableRule stops a Rule and resolves its open Alerts, hence the
// Alerts reload. Safe to repeat.
export function useDisableRule() {
  return useMutation(RuleService.method.disableRule, {
    onSuccess: useInvalidate([ruleQueries, alertQueries]),
  });
}

// useEnableRule starts a disabled Rule afresh. Safe to repeat.
export function useEnableRule() {
  return useMutation(RuleService.method.enableRule, {
    onSuccess: useInvalidate([ruleQueries]),
  });
}

// useDeleteRule deletes a Rule, keeping its Alerts, then goes back to
// the list.
export function useDeleteRule() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const reload = useInvalidate([listRulesKey, contactGroupsKey]);
  return useMutation(RuleService.method.deleteRule, {
    onSuccess: async (_answer, { ruleId }) => {
      queryClient.removeQueries({
        queryKey: createConnectQueryKey({
          schema: RuleService.method.getRule,
          input: { ruleId },
          cardinality: "finite",
        }),
      });
      await reload();
      await navigate("/rules");
    },
  });
}
