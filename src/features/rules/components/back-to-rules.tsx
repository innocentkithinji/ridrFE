import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";

export function BackToRules() {
  return (
    <Link
      to="/rules"
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
    >
      <ArrowLeft className="size-4" aria-hidden /> Rules
    </Link>
  );
}
