import { createBrowserRouter, Outlet, RouterProvider, type RouteObject } from "react-router";
import { nav } from "@/app/nav";
import { AppProvider } from "@/app/provider";
import { HomeRoute } from "@/app/routes/home";
import { NotFoundRoute } from "@/app/routes/not-found";
import { TestOnlyGatedRoute, testOnlyPath } from "@/app/routes/test-only";
import { AppShell } from "@/components/layout/app-shell";

// Routes inside the shell, signed in. Each feature adds its routes here,
// each element wrapped in <RequirePermission> with its route's Permission
// (the same one as its nav link in nav.ts).
const shellRoutes: RouteObject[] = [
  { index: true, element: <HomeRoute /> },
  ...(import.meta.env.DEV ? [{ path: testOnlyPath, element: <TestOnlyGatedRoute /> }] : []),
  { path: "*", element: <NotFoundRoute /> },
];

const router = createBrowserRouter([
  // Public routes (such as the Agent guide) go here, outside the session.
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
