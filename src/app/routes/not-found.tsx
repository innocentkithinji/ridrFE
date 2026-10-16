import { Link } from "react-router";
import { NotFound } from "@/components/states";

// NotFoundRoute catches unknown URLs inside the shell, so the user keeps
// the sidebar and a way back.
export function NotFoundRoute() {
  return (
    <NotFound what="Page">
      <Link to="/" className="underline">
        Go home
      </Link>
    </NotFound>
  );
}
