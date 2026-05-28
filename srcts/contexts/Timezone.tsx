import { createContext, useContext, type ReactNode } from "react";
import { tzGuess } from "@/lib/time";

const TimezoneContext = createContext<string>("UTC");

export function TimezoneProvider({
  tz,
  children,
}: {
  tz: string | null | undefined;
  children: ReactNode;
}) {
  const value = tz && isValidTimezone(tz) ? tz : tzGuess();
  return (
    <TimezoneContext.Provider value={value}>{children}</TimezoneContext.Provider>
  );
}

export function useUserTz(): string {
  return useContext(TimezoneContext);
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const REGION_ORDER: Record<string, number> = {
  Europe: 0,
  America: 1,
  Africa: 2,
  Asia: 3,
  Australia: 4,
  Pacific: 5,
  Atlantic: 6,
  Indian: 7,
  Antarctica: 8,
  Other: 99,
};

export interface TimezoneGroup {
  region: string;
  zones: string[];
}

/**
 * Returns IANA timezones grouped and sorted by region. Falls back to a small
 * curated list when `Intl.supportedValuesOf` isn't available (older browsers).
 */
export function listTimezones(): TimezoneGroup[] {
  const all = supportedTimezones();
  const groups = new Map<string, string[]>();
  for (const tz of all) {
    const region = tz.includes("/") ? tz.split("/")[0] : "Other";
    if (!groups.has(region)) groups.set(region, []);
    groups.get(region)!.push(tz);
  }
  const out: TimezoneGroup[] = [];
  for (const [region, zones] of groups) {
    zones.sort();
    out.push({ region, zones });
  }
  out.sort(
    (a, b) =>
      (REGION_ORDER[a.region] ?? 50) - (REGION_ORDER[b.region] ?? 50) ||
      a.region.localeCompare(b.region)
  );
  return out;
}

function supportedTimezones(): string[] {
  type IntlWithSupported = typeof Intl & {
    supportedValuesOf?: (key: string) => string[];
  };
  const i = Intl as IntlWithSupported;
  if (typeof i.supportedValuesOf === "function") {
    try {
      return i.supportedValuesOf("timeZone");
    } catch {
      // fall through to fallback below
    }
  }
  return FALLBACK_TIMEZONES;
}

// Curated fallback for older browsers — a useful international subset rather
// than the full IANA list.
const FALLBACK_TIMEZONES: string[] = [
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Warsaw",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Athens",
  "Europe/Helsinki",
  "Europe/Moscow",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "America/Buenos_Aires",
  "America/Bogota",
  "America/Lima",
  "Africa/Cairo",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Africa/Casablanca",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Tehran",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Australia/Sydney",
  "Australia/Perth",
  "Pacific/Auckland",
  "Pacific/Honolulu",
];
