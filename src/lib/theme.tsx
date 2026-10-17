import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// The theme the user chose; "system" follows the operating system.
export type ThemeChoice = "light" | "dark" | "system";

type Theme = {
  choice: ThemeChoice;
  // What is showing now: the choice, or the system's when it is "system".
  resolved: "light" | "dark";
  choose: (choice: ThemeChoice) => void;
};

const storageKey = "ridr.theme";
const darkQuery = "(prefers-color-scheme: dark)";

const ThemeContext = createContext<Theme | null>(null);

// ThemeProvider follows the system's light or dark setting until the user
// picks one, and remembers that pick in this browser. It holds no
// Organisation data, so it sits above the session.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<ThemeChoice>(readChoice);
  const systemDark = useSystemDark();
  const resolved =
    choice === "system" ? (systemDark ? "dark" : "light") : choice;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  const choose = useCallback((next: ThemeChoice) => {
    setChoice(next);
    localStorage.setItem(storageKey, next);
  }, []);

  const theme = useMemo(
    () => ({ choice, resolved, choose }),
    [choice, resolved, choose],
  );
  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error("useTheme must be used below a ThemeProvider");
  }
  return theme;
}

function readChoice(): ThemeChoice {
  const stored = localStorage.getItem(storageKey);
  return stored === "light" || stored === "dark" ? stored : "system";
}

function useSystemDark(): boolean {
  const [dark, setDark] = useState(() => matchMedia(darkQuery).matches);
  useEffect(() => {
    const query = matchMedia(darkQuery);
    const onChange = () => setDark(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return dark;
}
