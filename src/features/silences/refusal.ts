import { Code, ConnectError } from "@connectrpc/connect";
import { messageFor } from "@/lib/errors";

// refusalMessage says why Ridr refused a Silence change. A refusal here
// names what to change (such as a selector outside the user's Scope), so
// the server's own words are shown.
export function refusalMessage(error: unknown): string {
  const refusal = ConnectError.from(error);
  if (refusal.code === Code.PermissionDenied && refusal.rawMessage) {
    return refusal.rawMessage;
  }
  return messageFor(refusal);
}
