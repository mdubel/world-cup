import { useShinyInput } from "@posit/shiny-react";
import { useEffect, useRef, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "wc26-theme";

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // localStorage may be unavailable (private mode, etc.)
  }
  return "light";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

// Apply the persisted localStorage theme as early as possible to avoid a flash
// on dark-mode reload. The server-saved profile may then refine it once it
// loads — useTheme handles that.
if (typeof document !== "undefined") {
  applyTheme(readStoredTheme());
}

interface UseThemeOptions {
  /**
   * Server-saved theme from the user profile. When supplied and different
   * from the local theme, takes precedence (cross-device persistence).
   */
  serverTheme?: Theme | null;
}

export function useTheme(options: UseThemeOptions = {}): {
  theme: Theme;
  toggle: () => void;
  set: (t: Theme) => void;
} {
  const { serverTheme } = options;
  const [theme, setTheme] = useState<Theme>(readStoredTheme);
  const [, sendTheme] = useShinyInput<Theme | null>(
    "set_user_theme",
    null,
    { debounceMs: 0, priority: "event" }
  );

  // First time the server hands us a theme, adopt it locally without
  // pushing it back (no echo). After that, local toggles take precedence
  // and are pushed to the server.
  const adoptedFromServer = useRef(false);
  useEffect(() => {
    if (!serverTheme) return;
    if (adoptedFromServer.current) return;
    adoptedFromServer.current = true;
    if (serverTheme !== theme) {
      setTheme(serverTheme);
    }
  }, [serverTheme, theme]);

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const update = (next: Theme) => {
    setTheme(next);
    if (adoptedFromServer.current || serverTheme !== undefined) {
      sendTheme(next);
    }
  };

  return {
    theme,
    toggle: () => update(theme === "dark" ? "light" : "dark"),
    set: update,
  };
}
