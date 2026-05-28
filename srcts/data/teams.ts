// Static metadata for the 48 teams that qualified for FIFA 2026. Keyed by
// football-data.org team id (as string, since the fixtures pin stores team
// ids as character).
//
// Confederation mapping is FIFA-canonical:
//   UEFA      — Europe
//   CONMEBOL  — South America
//   CONCACAF  — North, Central America & Caribbean
//   AFC       — Asia and Australia
//   CAF       — Africa
//   OFC       — Oceania (excluding AU/NZ — NZ left OFC for AFC? No — NZ is OFC)
//
// Nicknames are the most common English-language nickname; fun facts are
// hand-curated one-liners. Both are optional; missing entries fall back to
// the team name only. Easy to extend.

export type Confederation = "UEFA" | "CONMEBOL" | "CONCACAF" | "AFC" | "CAF" | "OFC";

export interface TeamMeta {
  confederation: Confederation;
  nickname?: string;
  fact?: string;
}

export const CONFEDERATIONS: Record<
  Confederation,
  { name: string; region: string; accent: string }
> = {
  UEFA:     { name: "UEFA",     region: "Europe",                          accent: "var(--ink)" },
  CONMEBOL: { name: "CONMEBOL", region: "South America",                   accent: "var(--mustard)" },
  CONCACAF: { name: "CONCACAF", region: "North & Central America",         accent: "var(--crimson)" },
  AFC:      { name: "AFC",      region: "Asia & Australia",                accent: "var(--pitch)" },
  CAF:      { name: "CAF",      region: "Africa",                          accent: "var(--bronze)" },
  OFC:      { name: "OFC",      region: "Oceania",                         accent: "var(--ink-soft)" },
};

export const CONFEDERATION_ORDER: Confederation[] = [
  "UEFA",
  "CONMEBOL",
  "CONCACAF",
  "CAF",
  "AFC",
  "OFC",
];

// Keyed by football-data team id (as string).
export const TEAM_META: Record<string, TeamMeta> = {
  // ---- UEFA (16) ----
  "770":  { confederation: "UEFA", nickname: "Three Lions",   fact: "1966 champions on home soil — their only World Cup title." },
  "773":  { confederation: "UEFA", nickname: "Les Bleus",     fact: "2-time champions (1998, 2018); finalists in 2022." },
  "759":  { confederation: "UEFA", nickname: "Die Mannschaft", fact: "4-time champions: 1954, 1974, 1990, 2014." },
  "760":  { confederation: "UEFA", nickname: "La Roja",       fact: "2010 World Champions — their only title." },
  "765":  { confederation: "UEFA", nickname: "A Seleção",     fact: "Hosted three Euros and a UEFA Nations League final in the past decade." },
  "8601": { confederation: "UEFA", nickname: "Oranje",        fact: "3-time runners-up (1974, 1978, 2010) — never won." },
  "805":  { confederation: "UEFA", nickname: "Red Devils",    fact: "Best finish: 3rd place in 2018." },
  "799":  { confederation: "UEFA", nickname: "Vatreni",       fact: "Reached the 2018 final and 2022 third place — small nation, big results." },
  "788":  { confederation: "UEFA", nickname: "Nati",          fact: "Has reached the round of 16 in the last four World Cups." },
  "803":  { confederation: "UEFA", nickname: "Crescent-Stars", fact: "Best finish: 3rd place in 2002, with future legend Hakan Şükür." },
  "798":  { confederation: "UEFA", nickname: "Lvi",           fact: "1996 Euro runners-up — first major World Cup since 2006." },
  "1060": { confederation: "UEFA", nickname: "Zmajevi",       fact: "Returns to the World Cup after 12 years; only second appearance ever." },
  "792":  { confederation: "UEFA", nickname: "Blågult",       fact: "3-time semi-finalists; produced legends like Henrik Larsson and Zlatan Ibrahimović." },
  "8872": { confederation: "UEFA", nickname: "Løvene",        fact: "First World Cup since 1998 — the Haaland era arrives on the biggest stage." },
  "8873": { confederation: "UEFA", nickname: "Tartan Army",   fact: "First World Cup since 1998 — qualifies after 7 missed tournaments." },
  "816":  { confederation: "UEFA", nickname: "Das Team",      fact: "First World Cup since 1998 — coached by Ralf Rangnick." },

  // ---- CONMEBOL (6) ----
  "764":  { confederation: "CONMEBOL", nickname: "Seleção Canarinho", fact: "5-time champions and the only nation in every World Cup ever." },
  "762":  { confederation: "CONMEBOL", nickname: "La Albiceleste",   fact: "3-time champions; reigning after 2022's penalty-shootout final." },
  "758":  { confederation: "CONMEBOL", nickname: "La Celeste",       fact: "Hosted and won the very first World Cup in 1930." },
  "818":  { confederation: "CONMEBOL", nickname: "Los Cafeteros",    fact: "Best finish: quarter-finals in 2014, led by James Rodríguez." },
  "791":  { confederation: "CONMEBOL", nickname: "La Tri",           fact: "4th World Cup; reached the round of 16 in 2006." },
  "761":  { confederation: "CONMEBOL", nickname: "La Albirroja",     fact: "Best finish: round of 16 in 1986, 1998, 2002 and 2010." },

  // ---- CONCACAF (6) ----
  "771":  { confederation: "CONCACAF", nickname: "Stars and Stripes", fact: "Co-host. Best finish: 3rd at the very first World Cup in 1930." },
  "769":  { confederation: "CONCACAF", nickname: "El Tri",            fact: "Co-host — first nation ever to host three World Cups (1970, 1986, 2026)." },
  "828":  { confederation: "CONCACAF", nickname: "Les Rouges",        fact: "Co-host. First World Cup goal scored in 2022, 36 years after their previous appearance." },
  "1836": { confederation: "CONCACAF", nickname: "La Roja",           fact: "First-ever World Cup appearance was 2018; this is their second." },
  "836":  { confederation: "CONCACAF", nickname: "Les Grenadiers",    fact: "First World Cup appearance since 1974 — back after 52 years." },
  "9460": { confederation: "CONCACAF", nickname: "The Yellow Canaries", fact: "Caribbean island of 150,000 — smallest country ever to qualify." },

  // ---- CAF (10) ----
  "815":  { confederation: "CAF", nickname: "Atlas Lions",          fact: "First African nation to reach a World Cup semi-final, in 2022." },
  "804":  { confederation: "CAF", nickname: "Lions of Teranga",     fact: "Champions of Africa in 2021; quarter-finalists in 2002." },
  "825":  { confederation: "CAF", nickname: "The Pharaohs",         fact: "Record 7-time AFCON champions; first World Cup since 2018." },
  "763":  { confederation: "CAF", nickname: "Black Stars",          fact: "Reached the quarter-finals in 2010 — were a Suárez handball away from a semi." },
  "802":  { confederation: "CAF", nickname: "Eagles of Carthage",   fact: "Famous 0–0 draw with England in 1998 still cited as a Cup classic." },
  "778":  { confederation: "CAF", nickname: "Les Fennecs",          fact: "Most recent AFCON champions; iconic '14 round-of-16 run." },
  "1935": { confederation: "CAF", nickname: "Les Éléphants",        fact: "AFCON champions in 2024 on home soil; led by an iconic 2006 generation." },
  "774":  { confederation: "CAF", nickname: "Bafana Bafana",        fact: "Hosted the 2010 World Cup; first appearance since." },
  "1934": { confederation: "CAF", nickname: "Léopards",             fact: "Returns to the World Cup for the first time since 1974." },
  "1930": { confederation: "CAF", nickname: "Tubarões Azuis",       fact: "Population: ~600,000. First-ever World Cup qualification." },

  // ---- AFC (9) ----
  "766":  { confederation: "AFC", nickname: "Samurai Blue",        fact: "Reached the round of 16 four times; lost on penalties to Croatia in 2022." },
  "772":  { confederation: "AFC", nickname: "Taegeuk Warriors",    fact: "Semi-finalists on home soil in 2002 — best Asian finish ever." },
  "779":  { confederation: "AFC", nickname: "Socceroos",           fact: "AFC member since 2006; reached the round of 16 in 2006 and 2022." },
  "801":  { confederation: "AFC", nickname: "Green Falcons",       fact: "Beat Argentina 2–1 in the 2022 group stage — one of WC history's biggest upsets." },
  "840":  { confederation: "AFC", nickname: "Team Melli",          fact: "6th World Cup; never advanced past the group stage." },
  "8030": { confederation: "AFC", nickname: "The Maroons",         fact: "Hosts in 2022; second-ever World Cup appearance." },
  "8062": { confederation: "AFC", nickname: "Lions of Mesopotamia", fact: "First World Cup appearance — historic milestone for Iraqi football." },
  "8049": { confederation: "AFC", nickname: "Al-Nashama",          fact: "First-ever World Cup qualification — Asian Cup runners-up in 2023." },
  "8070": { confederation: "AFC", nickname: "White Wolves",        fact: "First World Cup since independence — historic for Central Asian football." },

  // ---- OFC (1) ----
  "783":  { confederation: "OFC", nickname: "All Whites",          fact: "First World Cup since 2010 — when they were the only undefeated team." },
};

export function metaForTeam(teamId: string | null | undefined): TeamMeta | null {
  if (!teamId) return null;
  return TEAM_META[teamId] ?? null;
}
