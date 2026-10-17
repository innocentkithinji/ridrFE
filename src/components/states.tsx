import { ConnectError } from "@connectrpc/connect";
import { LoaderCircle, SearchX, ShieldOff, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { messageFor } from "@/lib/errors";

// The states every screen shows besides its data. Use these, never a
// hand-rolled spinner or message, so every screen behaves the same.

type StateFrameProps = {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  role?: "alert" | "status";
};

function StateFrame({ icon, title, children, role }: StateFrameProps) {
  return (
    <section
      role={role}
      className="mx-auto flex max-w-md flex-col items-center gap-2 py-16 text-center"
    >
      <div className="text-muted-foreground">{icon}</div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {children && <div className="text-muted-foreground text-sm">{children}</div>}
    </section>
  );
}

// Loading says what is on its way, as in "Loading your account…".
export function Loading({ what }: { what: string }) {
  return (
    <p
      role="status"
      className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm"
    >
      <LoaderCircle className="size-4 animate-spin" aria-hidden />
      Loading {what}…
    </p>
  );
}

// Empty is what a list or panel shows when there is nothing in it.
export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground py-8 text-center text-sm">{children}</p>;
}

// PermissionDenied is a screen's state when GetMe lacks its Permission,
// or the server refused the load. `by` names what refuses: the user's
// Role (the default) or their Scope.
export function PermissionDenied({ what, by = "Role" }: { what: string; by?: "Role" | "Scope" }) {
  return (
    <StateFrame
      role="alert"
      icon={<ShieldOff className="size-8" aria-hidden />}
      title="No access"
    >
      Your {by} doesn't let you see {what}. Ask an admin for access.
    </StateFrame>
  );
}

type NotFoundProps = {
  what: string;
  // The sentence under the title, as the feature page words it.
  message?: string;
  children?: ReactNode;
};

// NotFound is a detail screen's state when the record is gone or outside
// the user's Scope; the two look the same on purpose.
export function NotFound({ what, message, children }: NotFoundProps) {
  return (
    <StateFrame icon={<SearchX className="size-8" aria-hidden />} title={`${what} not found`}>
      <p>{message ?? "It doesn't exist or isn't yours to see."}</p>
      {children}
    </StateFrame>
  );
}

// ErrorState shows a failed load in place of the data, in the words
// errors.ts picks for its code.
export function ErrorState({ error }: { error: unknown }) {
  return (
    <StateFrame
      role="alert"
      icon={<TriangleAlert className="size-8" aria-hidden />}
      title="Something went wrong"
    >
      {messageFor(ConnectError.from(error))}
    </StateFrame>
  );
}

// QueryState is the part of a query's state QueryView reads; a useQuery
// result is one.
type QueryState<T> = {
  isPending: boolean;
  error: ConnectError | null;
  data: T | undefined;
};

type QueryViewProps<T> = {
  query: QueryState<T>;
  // What is loading, as in "Loading the Alert…".
  what: string;
  // Shown when the query found nothing, or isEmpty says so.
  empty?: ReactNode;
  isEmpty?: (data: T) => boolean;
  children: (data: T) => ReactNode;
};

// QueryView shows a query's loading, error or empty state, so each screen
// writes only what it shows once the data is there. Data once shown stays
// through a background refetch, even one that fails.
export function QueryView<T>(props: QueryViewProps<T>) {
  const { query, isEmpty } = props;
  if (query.isPending) {
    return <Loading what={props.what} />;
  }
  if (query.error && query.data === undefined) {
    return <ErrorState error={query.error} />;
  }
  if (query.data === undefined || isEmpty?.(query.data)) {
    return <Empty>{props.empty}</Empty>;
  }
  return props.children(query.data);
}
