export function tzGuess(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function formatLocal(
  iso: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
  tz?: string
): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const merged: Intl.DateTimeFormatOptions = tz
    ? { ...opts, timeZone: tz }
    : opts;
  return new Intl.DateTimeFormat(undefined, merged).format(d);
}

export function formatLocalTime(
  iso: string | null | undefined,
  tz?: string
): string {
  return formatLocal(iso, { hour: "2-digit", minute: "2-digit" }, tz);
}

export function formatLocalDate(
  iso: string | null | undefined,
  tz?: string
): string {
  return formatLocal(
    iso,
    { weekday: "short", month: "short", day: "numeric" },
    tz
  );
}

export function countdown(targetIso: string, nowMs: number): string {
  const target = new Date(targetIso).getTime();
  if (isNaN(target)) return "";
  const diff = target - nowMs;
  if (diff <= 0) return "Started";
  const sec = Math.floor(diff / 1000);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;
  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${mins}m`;
  if (mins > 0) return `in ${mins}m ${secs}s`;
  return `in ${secs}s`;
}

export function isPast(iso: string | null | undefined, nowMs: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return false;
  return t <= nowMs;
}
