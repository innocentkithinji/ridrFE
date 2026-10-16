import { createContext, useContext, type ReactNode } from "react";

// A signed-in user acting in one Organisation. Clerk provides it, or the
// dev token locally; the rest of the app never knows which.
export type Session = {
  // Changes when the user or their active Organisation changes.
  key: string;
  // A fresh token for every call; never store it.
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
  // A control to change Organisation, or null when there is one only.
  organisationSwitcher: ReactNode;
};

const SessionContext = createContext<Session | null>(null);

export const SessionProvider = SessionContext.Provider;

// useSession returns the active session; it exists below the sign-in gate.
export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error("useSession must be used below a SessionProvider");
  }
  return session;
}
