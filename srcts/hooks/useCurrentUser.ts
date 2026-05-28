import { useShinyInput, useShinyOutput } from "@posit/shiny-react";
import { useEffect } from "react";
import { tzGuess } from "../lib/time";
import type { CurrentUser } from "../lib/types";

export function useCurrentUser(): CurrentUser | undefined {
  const [user] = useShinyOutput<CurrentUser | undefined>(
    "current_user",
    undefined
  );
  const [, setTz] = useShinyInput<string>("client_tz", "");
  useEffect(() => {
    setTz(tzGuess());
  }, [setTz]);
  return user;
}
