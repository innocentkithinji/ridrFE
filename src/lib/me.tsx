import type { DescMethod } from "@bufbuild/protobuf";
import { createConnectQueryKey } from "@connectrpc/connect-query";
import { AccessService, type GetMeResponse } from "@ridr/web";
import { createContext, useContext, type ReactNode } from "react";

// A Permission as GetMe lists it: the fully qualified procedure name,
// such as "ridr.v1.AlertService/ListAlerts". Make one with permissionOf.
export type Permission = string;

const MeContext = createContext<GetMeResponse | null>(null);

// MeContextProvider hands the loaded GetMe answer to useMe below it.
export const MeContextProvider = MeContext.Provider;

// meKey matches the cached GetMe, to reload it after access may change.
export const meKey = createConnectQueryKey({
  schema: AccessService.method.getMe,
  cardinality: undefined,
});

// useMe returns the signed-in user's GetMe answer.
export function useMe(): GetMeResponse {
  const me = useContext(MeContext);
  if (!me) {
    throw new Error("useMe must be used below a MeProvider");
  }
  return me;
}

// permissionOf names the Permission to call method. Deriving it from the
// generated method makes a typo a type error.
export function permissionOf(method: DescMethod): Permission {
  return `${method.parent.typeName}/${method.name}`;
}

// useHasPermission tells whether GetMe lists permission. The server
// works the list out, so a missing Permission is a call it would refuse.
export function useHasPermission(permission: Permission): boolean {
  return useMe().permissions.includes(permission);
}

// useCan tells whether the user may call method.
export function useCan(method: DescMethod): boolean {
  return useHasPermission(permissionOf(method));
}

// useIsScoped tells whether the user sees only some Assets.
export function useIsScoped(): boolean {
  const scope = useMe().scope;
  return (scope?.conditions.length ?? 0) > 0;
}

type CanProps = { method: DescMethod; children: ReactNode };

// Can shows its children only to users with method's Permission. Hide
// actions this way; never disable them.
export function Can({ method, children }: CanProps) {
  return useCan(method) ? children : null;
}
