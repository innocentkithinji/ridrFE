import { Code, ConnectError } from "@connectrpc/connect";
import { QueryProblemSchema, type QueryProblem } from "@ridr/web";

// messageFor turns an API error into a sentence for the screen.
export function messageFor(error: ConnectError): string {
  switch (error.code) {
    case Code.Unauthenticated:
      return "Your session has ended. Sign in again.";
    case Code.PermissionDenied:
      return "You don't have access to this.";
    case Code.NotFound:
      return "It no longer exists.";
    case Code.InvalidArgument:
    case Code.FailedPrecondition:
    case Code.AlreadyExists:
    case Code.ResourceExhausted:
      return error.rawMessage; // the server explains what to change
    case Code.Unavailable:
      return "Ridr can't be reached. Check your connection.";
    default:
      return "Something went wrong. Try again.";
  }
}

// refusalMessage says why Ridr refused a change. A PermissionDenied on
// a change names what to change (such as a value outside the user's
// Scope), so the server's own words are shown; anything else reads as
// messageFor does.
export function refusalMessage(error: unknown): string {
  const refusal = ConnectError.from(error);
  if (refusal.code === Code.PermissionDenied && refusal.rawMessage) {
    return refusal.rawMessage;
  }
  return messageFor(refusal);
}

// isRefusal tells whether the server refused the caller, as opposed to
// failing; retrying a refusal with the same access won't help.
export function isRefusal(error: unknown): boolean {
  const code = ConnectError.from(error).code;
  return code === Code.PermissionDenied || code === Code.Unauthenticated;
}

// What Ridr says, with PermissionDenied, when no Tenant stands for the
// active Organisation: it tells that apart from a user who isn't a member.
const notSetUpMessage = "organisation is not set up in Ridr";

// isOrganisationNotSetUp tells whether Ridr refused the call because the
// active Organisation has no Tenant yet.
export function isOrganisationNotSetUp(error: unknown): boolean {
  const refusal = ConnectError.from(error);
  return (
    refusal.code === Code.PermissionDenied &&
    refusal.rawMessage === notSetUpMessage
  );
}

// Codes for a request that is wrong as sent, so it fails again unchanged.
const wrongRequest = [
  Code.InvalidArgument,
  Code.NotFound,
  Code.ResourceExhausted,
  Code.FailedPrecondition,
];

// retryWontHelp tells whether sending the same request again would fail
// the same way: a refusal, or a request the user must change first.
export function retryWontHelp(error: unknown): boolean {
  const code = ConnectError.from(error).code;
  return isRefusal(error) || wrongRequest.includes(code);
}

// queryProblemOf reads where a Query is wrong from the error RunQuery,
// ExplainQuery, a Dashboard save or a Live query failed with: the
// QueryProblem Ridr sends with InvalidArgument, or null.
export function queryProblemOf(error: unknown): QueryProblem | null {
  if (!error) return null;
  const failed = ConnectError.from(error);
  if (failed.code !== Code.InvalidArgument) return null;
  return failed.findDetails(QueryProblemSchema)[0] ?? null;
}

// isTooCostly tells whether Ridr refused to run a Query because of a
// cost limit; its rawMessage names the limit.
export function isTooCostly(error: unknown): boolean {
  return !!error && ConnectError.from(error).code === Code.ResourceExhausted;
}
