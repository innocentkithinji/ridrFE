import { AppRouter } from "@/app/router";
import { ThemeProvider } from "@/lib/theme";

// App is the router inside the theme. The session and its providers wrap
// the signed-in routes (router.tsx), so public routes need no sign-in.
export function App() {
  return (
    <ThemeProvider>
      <AppRouter />
    </ThemeProvider>
  );
}
