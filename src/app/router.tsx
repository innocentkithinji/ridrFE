import { createBrowserRouter, Outlet, RouterProvider, type RouteObject } from "react-router";
import { nav } from "@/app/nav";
import { AppProvider } from "@/app/provider";
import { AgentGuideRoute } from "@/app/routes/agent-guide";
import { AuditLogRoute, auditLogPath } from "@/app/routes/audit-log";
import {
  AdapterRoute,
  DataSourcesRoute,
  dataSourcesPath,
  NewDataSourceRoute,
  newDataSourcePath,
} from "@/app/routes/data-sources";
import { CatalogRoute, catalogPath } from "@/app/routes/catalog";
import { AssetsRoute, assetsPath } from "@/app/routes/assets";
import { ContactGroupsRoute, contactGroupsPath } from "@/app/routes/contact-groups";
import { ControlledKeysRoute, controlledKeysPath } from "@/app/routes/controlled-keys";
import { ExploreRoute, explorePath } from "@/app/routes/explore";
import { HomeRoute } from "@/app/routes/home";
import { LiveQueryDevRoute, liveQueryDevPath } from "@/app/routes/live-query-dev";
import { NotFoundRoute } from "@/app/routes/not-found";
import { PreferencesRoute, preferencesPath } from "@/app/routes/preferences";
import { TeamRoute, teamPath } from "@/app/routes/team";
import { UnclaimedDevicesRoute, unclaimedDevicesPath } from "@/app/routes/unclaimed-devices";
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
  { path: explorePath, element: <ExploreRoute /> },
  { path: assetsPath, element: <AssetsRoute /> },
  { path: unclaimedDevicesPath, element: <UnclaimedDevicesRoute /> },
  { path: contactGroupsPath, element: <ContactGroupsRoute /> },
  { path: catalogPath, element: <CatalogRoute /> },
  { path: controlledKeysPath, element: <ControlledKeysRoute /> },
  { path: teamPath, element: <TeamRoute /> },
  { path: auditLogPath, element: <AuditLogRoute /> },
  { path: preferencesPath, element: <PreferencesRoute /> },
  { path: dataSourcesPath, element: <DataSourcesRoute /> },
  { path: newDataSourcePath, element: <NewDataSourceRoute /> },
  { path: `${dataSourcesPath}/:adapterId`, element: <AdapterRoute /> },
  ...(import.meta.env.DEV
    ? [
        { path: testOnlyPath, element: <TestOnlyGatedRoute /> },
        { path: liveQueryDevPath, element: <LiveQueryDevRoute /> },
      ]
    : []),
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
