import { ConnectError } from "@connectrpc/connect";
import type { ReactNode } from "react";
import { messageFor } from "@/lib/errors";

type FormErrorProps = {
  id: string;
  error: unknown;
  // More to say after the server's reason, such as a usage count.
  children?: ReactNode;
};

// FormError shows, beside a form, why the server refused its change.
export function FormError({ id, error, children }: FormErrorProps) {
  if (!error) {
    return null;
  }
  return (
    <p id={id} role="alert" className="text-destructive text-sm">
      {messageFor(ConnectError.from(error))}
      {children}
    </p>
  );
}
