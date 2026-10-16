import { ChevronsUpDown, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useMe } from "@/lib/me";
import { useSession } from "@/lib/session";

// UserMenu shows who is signed in, and where, and offers sign-out. The
// session's Organisation switcher sits beside it when it has one.
export function UserMenu() {
  const me = useMe();
  const { organisationSwitcher, signOut } = useSession();
  return (
    <>
      {organisationSwitcher}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton size="lg" aria-label="User menu">
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{me.tenantName}</span>
              <span className="text-muted-foreground truncate text-xs">
                {me.email}
              </span>
            </div>
            <ChevronsUpDown className="ml-auto" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="min-w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="font-medium">{me.email}</div>
            <div className="text-muted-foreground text-xs">{me.tenantName}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void signOut()}>
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
