import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

interface SpoilersApi {
  /**
   * True when the user has explicitly clicked "Reveal anyway" in any tab.
   * Persists for the session so they don't have to re-click on every tab
   * switch. Resets when the page is reloaded.
   */
  revealed: boolean;
  setRevealed: (next: boolean) => void;
  toggle: () => void;
}

const SpoilersContext = createContext<SpoilersApi | null>(null);

export function SpoilersProvider({ children }: { children: ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <SpoilersContext.Provider
      value={{
        revealed,
        setRevealed,
        toggle: () => setRevealed((r) => !r),
      }}
    >
      {children}
    </SpoilersContext.Provider>
  );
}

export function useSpoilers(): SpoilersApi {
  const v = useContext(SpoilersContext);
  if (!v) {
    throw new Error("useSpoilers used outside <SpoilersProvider>");
  }
  return v;
}
