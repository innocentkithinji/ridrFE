import { createConnectQueryKey, useMutation } from "@connectrpc/connect-query";
import { ContactGroupService } from "@ridr/web";
import { useQueryClient } from "@tanstack/react-query";

// The cached ListContactGroups, refetched after every change. Signing
// secrets in a change's answer never reach the cache: only this list is,
// and the server never lists secrets.
const contactGroupsKey = createConnectQueryKey({
  schema: ContactGroupService.method.listContactGroups,
  cardinality: undefined,
});

// useCreateContactGroup adds a Contact group. Its answer carries a
// signingSecret on each webhook Contact whose URL is new to the
// Organisation; show it once and keep it out of the cache.
export function useCreateContactGroup() {
  return useMutation(ContactGroupService.method.createContactGroup, {
    onSuccess: useReloadContactGroups(),
  });
}

// useUpdateContactGroup renames a Contact group and replaces its
// Contacts. Like create, it may issue webhook signing secrets.
export function useUpdateContactGroup() {
  return useMutation(ContactGroupService.method.updateContactGroup, {
    onSuccess: useReloadContactGroups(),
  });
}

// useDeleteContactGroup removes a Contact group. The server refuses with
// FailedPrecondition while any Rule, disabled ones included, notifies it.
export function useDeleteContactGroup() {
  return useMutation(ContactGroupService.method.deleteContactGroup, {
    onSuccess: useReloadContactGroups(),
  });
}

// useRotateWebhookSecret replaces a webhook URL's signing secret, across
// every group that uses the URL. Nothing is cached, so nothing reloads.
export function useRotateWebhookSecret() {
  return useMutation(ContactGroupService.method.rotateWebhookSecret);
}

function useReloadContactGroups() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: contactGroupsKey });
}
