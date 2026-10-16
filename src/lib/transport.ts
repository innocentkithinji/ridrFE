import type { Interceptor, Transport } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import type { Session } from "@/lib/session";

type GetToken = Session["getToken"];

// createRidrTransport returns the transport every Ridr call goes
// through. It asks for a fresh token per call, so short-lived tokens
// just work and the app never stores one.
export function createRidrTransport(
  baseUrl: string,
  getToken: GetToken,
): Transport {
  return createConnectTransport({
    baseUrl,
    interceptors: [bearerToken(getToken)],
  });
}

// bearerToken sends the session token in the Authorization header.
function bearerToken(getToken: GetToken): Interceptor {
  return (next) => async (request) => {
    const token = await getToken();
    if (token) {
      request.header.set("Authorization", `Bearer ${token}`);
    }
    return next(request);
  };
}
