import { useShinyMessageHandler } from "@posit/shiny-react";
import { useEffect } from "react";
import { Toaster as SonnerToaster, toast } from "sonner";
import type { ServerResultMessage } from "@/lib/types";

const REASON_TEXT: Record<string, string> = {
  locked: "Locked at kickoff. Earlier saves were kept.",
  bracket_pending: "Both teams aren't known yet.",
  invalid_pick: "Invalid pick.",
  invalid_advancing_team: "Choose a valid advancing team.",
  invalid_state: "Invalid tracker state.",
  unknown_match: "Unknown match.",
  unknown_team: "Unknown team.",
  no_teams_yet: "Teams aren't loaded yet.",
  missing_match_id: "Missing match.",
  missing_team_id: "Pick a team first.",
  not_authorized: "You're not authorized to do that.",
};

function describeFailure(msg: ServerResultMessage): string {
  if (msg.ok) return "";
  const reason = String(msg.reason ?? "");
  return REASON_TEXT[reason] ?? `Save failed: ${reason}`;
}

export function Toaster() {
  useShinyMessageHandler<ServerResultMessage>("predictionResult", (msg) => {
    if (msg.ok) {
      toast.success("Prediction saved");
    } else {
      toast.error(describeFailure(msg));
    }
  });

  useShinyMessageHandler<ServerResultMessage>("tournamentPickResult", (msg) => {
    if (msg.ok) {
      toast.success("Tournament pick saved");
    } else {
      toast.error(describeFailure(msg));
    }
  });

  useShinyMessageHandler<ServerResultMessage>("trackerResult", (msg) => {
    if (!msg.ok) {
      toast.error(describeFailure(msg));
    }
  });

  useShinyMessageHandler<ServerResultMessage>("refreshResult", (msg) => {
    if (msg.ok) {
      toast.success("Fixtures refreshed");
    } else {
      toast.error(describeFailure(msg));
    }
  });

  useEffect(() => {
    // mount once
  }, []);

  return <SonnerToaster richColors position='bottom-right' />;
}
