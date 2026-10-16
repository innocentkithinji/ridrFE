import { create } from "@bufbuild/protobuf";
import { createConnectQueryKey, useMutation } from "@connectrpc/connect-query";
import { ConnectorService, GetMappingResponseSchema } from "@ridr/web";
import { useQueryClient } from "@tanstack/react-query";

const getMappingKey = createConnectQueryKey({
  schema: ConnectorService.method.getMapping,
  cardinality: undefined,
});

// useSetMapping saves a Connector's Mapping as a new version. Past
// Readings stay as they were until reprocessed. The answer becomes the
// cached current version at once, so the editor stays open while
// GetMapping reloads (a Connector that had none would otherwise show
// Loading in between).
export function useSetMapping() {
  const queryClient = useQueryClient();
  return useMutation(ConnectorService.method.setMapping, {
    onSuccess: async (answer, request) => {
      const current = createConnectQueryKey({
        schema: ConnectorService.method.getMapping,
        input: { adapterId: request.adapterId },
        cardinality: "finite",
      });
      queryClient.setQueriesData({ queryKey: current }, () =>
        create(GetMappingResponseSchema, { mapping: answer.mapping }),
      );
      await queryClient.invalidateQueries({ queryKey: getMappingKey });
    },
  });
}

// usePreviewMapping reads a sample payload with a Mapping and answers
// what it would make. It saves nothing, so it invalidates nothing.
export function usePreviewMapping() {
  return useMutation(ConnectorService.method.previewMapping);
}
