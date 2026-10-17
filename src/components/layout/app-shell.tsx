import { Suspense } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import type { NavGroup, NavItem } from "@/components/layout/nav-types";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Loading } from "@/components/states";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useIsScoped, useMe } from "@/lib/me";

// AppShell frames every signed-in screen: the sidebar of the links the
// user may open, who and where they are, and the theme toggle.
export function AppShell({ nav }: { nav: NavGroup[] }) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader>
            <span className="px-2 py-1 text-lg font-semibold tracking-tight">Ridr</span>
          </SidebarHeader>
          <SidebarContent>
            <nav aria-label="Main">
              <VisibleNav nav={nav} />
            </nav>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <UserMenu />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="flex h-12 items-center gap-2 border-b px-3">
            <SidebarTrigger />
            <span className="flex-1" />
            <ThemeToggle />
          </header>
          <main className="flex-1 p-4 md:p-6">
            {/* Most route screens load lazily (src/app/routes). */}
            <Suspense fallback={<Loading what="the page" />}>
              <Outlet />
            </Suspense>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

// VisibleNav shows each group's links the user has the Permission for,
// hides links not meant for scoped users from them, and drops groups
// left empty.
function VisibleNav({ nav }: { nav: NavGroup[] }) {
  const permissions = useMe().permissions;
  const scoped = useIsScoped();
  const allowed = (item: NavItem) =>
    permissions.includes(item.permission) && !(scoped && item.hiddenWhenScoped);
  return nav.map((group) => {
    const items = group.items.filter(allowed);
    if (items.length === 0) return null;
    return (
      <SidebarGroup key={group.label}>
        <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
        <SidebarMenu>
          {items.map((item) => (
            <NavEntry key={item.to} item={item} />
          ))}
        </SidebarMenu>
      </SidebarGroup>
    );
  });
}

function NavEntry({ item }: { item: NavItem }) {
  const { pathname } = useLocation();
  const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active}>
        <NavLink to={item.to}>
          <item.icon />
          <span>{item.label}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
