import { useMutation } from "@connectrpc/connect-query";
import { ConnectorService } from "@ridr/web";
import { listAdaptersKey, secretMutation, useInvalidate } from "@/features/data-sources/api/keys";

// useCreateWebhookConnector creates a Webhook connector, whose URL (it
// holds the connector's Ingest key) the answer carries once.
export function useCreateWebhookConnector() {
  return useMutation(ConnectorService.method.createWebhookConnector, {
    ...secretMutation,
    onSuccess: useInvalidate(listAdaptersKey),
  });
}
