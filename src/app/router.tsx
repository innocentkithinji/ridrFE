import { createBrowserRouter, Outlet, RouterProvider, type RouteObject } from "react-router";
import { nav } from "@/app/nav";
import { AppProvider } from "@/app/provider";
import { AgentGuideRoute } from "@/app/routes/agent-guide";
import { AuditLogRoute, auditLogPath } from "@/app/routes/audit-log";
import { CatalogRoute, catalogPath } from "@/app/routes/catalog";
import { ControlledKeysRoute, controlledKeysPath } from "@/app/routes/controlled-keys";
import { HomeRoute } from "@/app/routes/home";
import { NotFoundRoute } from "@/app/routes/not-found";
import { TeamRoute, teamPath } from "@/app/routes/team";
import {
  TestOnlyAgentGuideRoute,
  testOnlyAgentGuidePath,
  TestOnlyGatedRoute,
  testOnlyPath,
} from "@/app/routes/test-only";
import { AppShell } from "@/components/layout/app-shell";

// Routes inside the shell, signed in. Each feature adds its routes here,
// each element wrapped in <RequirePermission> with its route's Permission
// (the same one as its nav link in nav.ts).
const shellRoutes: RouteObject[] = [
  { index: true, element: <HomeRoute /> },
  { path: catalogPath, element: <CatalogRoute /> },
  { path: controlledKeysPath, element: <ControlledKeysRoute /> },
  { path: teamPath, element: <TeamRoute /> },
  { path: auditLogPath, element: <AuditLogRoute /> },
  ...(import.meta.env.DEV ? [{ path: testOnlyPath, element: <TestOnlyGatedRoute /> }] : []),
  { path: "*", element: <NotFoundRoute /> },
];

const router = createBrowserRouter([
  // Public routes go here, outside the session.
  { path: "/docs/agents", element: <AgentGuideRoute /> },
  ...(import.meta.env.DEV
    ? [{ path: testOnlyAgentGuidePath, element: <TestOnlyAgentGuideRoute /> }]
    : []),
  {
    // Everything below is one session: switching Organisation or signing
    // out rebuilds it from an empty cache.
    element: (
      <AppProvider>
        <Outlet />
      </AppProvider>
    ),
    children: [{ element: <AppShell nav={nav} />, children: shellRoutes }],
  },
]);

// AppRouter maps URLs to screens.
export function AppRouter() {
  return <RouterProvider router={router} />;
}
