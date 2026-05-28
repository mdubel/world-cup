import { createContext, useContext, type ReactNode } from "react";
import { useTheme as useThemeImpl } from "@/hooks/useTheme";

type Theme = "light" | "dark";

interface ThemeApi {
  theme: Theme;
  toggle: () => void;
  set: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeApi | null>(null);

export function ThemeProvider({
  serverTheme,
  children,
}: {
  serverTheme: Theme | null | undefined;
  children: ReactNode;
}) {
  // One useTheme instance for the whole app — every consumer shares state,
  // so the standalone toggle and the settings dialog never disagree.
  const value = useThemeImpl({ serverTheme: serverTheme ?? null });
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeApi {
  const v = useContext(ThemeContext);
  if (!v) {
    throw new Error("useThemeContext used outside <ThemeProvider>");
  }
  return v;
}
