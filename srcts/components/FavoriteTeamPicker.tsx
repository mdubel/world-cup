import { TeamFlag } from "@/components/TeamFlag";
import { useAppData } from "@/contexts/AppData";
import {
  CONFEDERATIONS,
  CONFEDERATION_ORDER,
  metaForTeam,
  type Confederation,
} from "@/data/teams";
import type { Team } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

/**
 * Compact two-part control rendered in the SettingsDialog. The left side is a
 * flag tile that shows the currently-picked team (or an empty rectangle when
 * none), and the right side is a confederation-grouped native <select> that
 * mirrors the timezone picker pattern in the same dialog.
 */
export function FavoriteTeamPicker() {
  const {
    fixtures: { teams },
    favoriteTeam,
    favoriteTeamId,
    setFavoriteTeam,
  } = useAppData();

  const grouped = useMemo(() => {
    const out = new Map<Confederation, Team[]>();
    for (const c of CONFEDERATION_ORDER) out.set(c, []);
    const unknown: Team[] = [];
    for (const t of teams) {
      const meta = metaForTeam(t.team_id);
      if (meta) out.get(meta.confederation)!.push(t);
      else unknown.push(t);
    }
    for (const arr of out.values()) arr.sort((a, b) =>
      a.team_name.localeCompare(b.team_name)
    );
    unknown.sort((a, b) => a.team_name.localeCompare(b.team_name));
    return { byConfederation: out, unknown };
  }, [teams]);

  return (
    <div className='space-y-2'>
      <div className='flex items-center gap-3'>
        {/* Flag tile — empty rectangle when no pick */}
        <div
          className={cn(
            "shrink-0 h-12 w-16 inline-flex flex-col items-center justify-center gap-0.5",
            "rounded-sm border-2 bg-paper",
            favoriteTeam ? "border-mustard" : "border-paper-edge border-dashed"
          )}
        >
          {favoriteTeam ? (
            <>
              <TeamFlag
                crest={favoriteTeam.team_crest}
                code={favoriteTeam.team_code}
                name={favoriteTeam.team_name}
                size='xs'
                framed={false}
              />
              <span className='font-display tracking-wider text-[10px] text-ink leading-none'>
                {favoriteTeam.team_code ?? "—"}
              </span>
            </>
          ) : (
            <span className='font-display tracking-widest text-[10px] text-ink-soft'>
              none
            </span>
          )}
        </div>

        <select
          value={favoriteTeamId ?? ""}
          onChange={(e) => setFavoriteTeam(e.target.value || null)}
          className={cn(
            "flex-1 rounded-sm border-2 border-paper-edge bg-paper",
            "px-3 py-2 text-sm font-display tracking-wide",
            "focus:outline-none focus:border-ink"
          )}
          aria-label='Favorite team'
        >
          <option value=''>— No favorite —</option>
          {CONFEDERATION_ORDER.map((conf) => {
            const list = grouped.byConfederation.get(conf) ?? [];
            if (list.length === 0) return null;
            return (
              <optgroup key={conf} label={CONFEDERATIONS[conf].name}>
                {list.map((t) => (
                  <option key={t.team_id} value={t.team_id}>
                    {t.team_name}
                    {t.team_code ? ` (${t.team_code})` : ""}
                  </option>
                ))}
              </optgroup>
            );
          })}
          {grouped.unknown.length > 0 && (
            <optgroup label='Other'>
              {grouped.unknown.map((t) => (
                <option key={t.team_id} value={t.team_id}>
                  {t.team_name}
                  {t.team_code ? ` (${t.team_code})` : ""}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>
      {favoriteTeam && (
        <p className='text-xs text-ink-soft'>
          Matches featuring{" "}
          <span className='font-display tracking-wide text-ink'>
            {favoriteTeam.team_name}
          </span>{" "}
          get a gold highlight and a celebratory note after the final whistle.
        </p>
      )}
    </div>
  );
}
