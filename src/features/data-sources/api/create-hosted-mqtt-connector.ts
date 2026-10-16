import { useMutation } from "@connectrpc/connect-query";
import { ConnectorService } from "@ridr/web";
import { listAdaptersKey, secretMutation, useInvalidate } from "@/features/data-sources/api/keys";

// useCreateHostedMqttConnector creates a Hosted MQTT connector, whose
// password (an Ingest key) the answer carries once.
export function useCreateHostedMqttConnector() {
  return useMutation(ConnectorService.method.createHostedMqttConnector, {
    ...secretMutation,
    onSuccess: useInvalidate(listAdaptersKey),
  });
}
