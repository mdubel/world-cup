import { FunFactStrip } from "@/components/FunFactStrip";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Crown,
  ExternalLink,
  ScrollText,
  Trophy,
} from "lucide-react";

const LEGO_SET_URL =
  "https://www.lego.com/pl-pl/product/fifa-world-cup-official-trophy-43020";
const LEGO_SET_NUMBER = "43020";

interface ScoringRow {
  pick: string;
  outcome: string;
  pts: number;
  note: string;
}

const GROUP_SCORING: ScoringRow[] = [
  { pick: "Home wins", outcome: "Home wins", pts: 3, note: "Exact match" },
  { pick: "Home wins", outcome: "Draw",      pts: 1, note: "Picked winner, was draw" },
  { pick: "Home wins", outcome: "Away wins", pts: 0, note: "Wrong winner" },
  { pick: "Draw",      outcome: "Home wins", pts: 1, note: "Picked draw, was winner" },
  { pick: "Draw",      outcome: "Draw",      pts: 3, note: "Exact match" },
  { pick: "Draw",      outcome: "Away wins", pts: 1, note: "Picked draw, was winner" },
  { pick: "Away wins", outcome: "Home wins", pts: 0, note: "Wrong winner" },
  { pick: "Away wins", outcome: "Draw",      pts: 1, note: "Picked winner, was draw" },
  { pick: "Away wins", outcome: "Away wins", pts: 3, note: "Exact match" },
];

interface KOExample {
  pick: string;
  outcome: string;
  base: number;
  bonus: number;
  why: string;
}

const KO_EXAMPLES: KOExample[] = [
  {
    pick: "Home wins regulation",
    outcome: "Home wins in 90 min",
    base: 3,
    bonus: 1,
    why: "Exact regulation outcome + Home advances",
  },
  {
    pick: "Home wins regulation",
    outcome: "Draw → Home wins on penalties",
    base: 1,
    bonus: 1,
    why: "Wrong regulation outcome, but you correctly named the team that advanced",
  },
  {
    pick: "Home wins regulation",
    outcome: "Draw → Away wins on penalties",
    base: 1,
    bonus: 0,
    why: "Wrong regulation outcome, wrong advancing team",
  },
  {
    pick: "Draw → PKs, Away advances",
    outcome: "Draw → Away wins on penalties",
    base: 3,
    bonus: 1,
    why: "Exact regulation + Away advances",
  },
  {
    pick: "Draw → PKs, Home advances",
    outcome: "Draw → Away wins on penalties",
    base: 3,
    bonus: 0,
    why: "Exact regulation, but the wrong PK winner",
  },
  {
    pick: "Home wins regulation",
    outcome: "Away wins in 90 min",
    base: 0,
    bonus: 0,
    why: "Wrong winner",
  },
];

function PointsCell({ value, accent }: { value: number; accent?: boolean }) {
  return (
    <span
      className={cn(
        "font-mono font-bold text-sm tabular-nums",
        accent
          ? value === 3 || value === 4
            ? "text-pitch"
            : value === 1 || value === 2
              ? "text-mustard"
              : "text-ink-soft"
          : "text-ink"
      )}
    >
      {value}
    </span>
  );
}

function SectionHeading({
  number,
  title,
}: {
  number: string;
  title: React.ReactNode;
}) {
  return (
    <div className='flex items-baseline gap-3 mb-3'>
      <span className='font-display text-3xl text-mustard tracking-widest'>
        {number}
      </span>
      <h3 className='font-display tracking-widest uppercase text-lg text-ink'>
        {title}
      </h3>
    </div>
  );
}

export function RulesTab() {
  return (
    <div className='space-y-5'>
      {/* Top heading */}
      <div className='flex items-start justify-between flex-wrap gap-3'>
        <div>
          <h2 className='tournament-title text-2xl text-ink'>
            The <span className='text-crimson'>Rules</span>
          </h2>
          <p className='text-xs text-ink-soft mt-1 max-w-md'>
            Everything you need to know about voting, scoring, and the prize.
          </p>
        </div>
        <ScrollText className='h-10 w-10 text-crimson hidden sm:block' />
      </div>

      {/* 01 — How predictions work */}
      <Card className='border-paper-edge bg-paper overflow-hidden'>
        <div className='h-1 w-full grid grid-cols-3'>
          <div className='bg-crimson' />
          <div className='bg-mustard' />
          <div className='bg-pitch' />
        </div>
        <CardContent className='p-5'>
          <SectionHeading number='01' title='How predictions work' />
          <ul className='text-sm text-ink space-y-2 leading-relaxed pl-1'>
            <li>
              <span className='font-display tracking-wider uppercase text-mustard text-xs mr-2'>
                When
              </span>
              You can submit a prediction for any match{" "}
              <strong>before its kickoff</strong>. Predictions are freely
              editable until kickoff; the last save wins. After kickoff the
              match is locked.
            </li>
            <li>
              <span className='font-display tracking-wider uppercase text-mustard text-xs mr-2'>
                Where
              </span>
              Picks made in the <strong>Bracket</strong> tab and the{" "}
              <strong>Picks</strong> tab are the same prediction — they sync
              live, so it doesn't matter which surface you use.
            </li>
            <li>
              <span className='font-display tracking-wider uppercase text-mustard text-xs mr-2'>
                Times
              </span>
              Every kickoff is shown in your timezone. You can change your
              timezone in Settings (⚙ in the header) and it follows you across
              devices.
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* 02 — Group stage scoring */}
      <Card className='border-paper-edge bg-paper'>
        <CardContent className='p-5'>
          <SectionHeading number='02' title='Group-stage scoring' />
          <p className='text-sm text-ink-soft mb-3'>
            For every group match you predict one of three outcomes: Home wins,
            Draw, or Away wins.
          </p>
          <div className='overflow-x-auto rounded-sm border-2 border-paper-edge'>
            <table className='w-full text-sm'>
              <thead className='bg-ink text-paper'>
                <tr className='text-left'>
                  <th className='py-2 px-3 font-display tracking-widest uppercase text-xs'>
                    Your pick
                  </th>
                  <th className='py-2 px-3 font-display tracking-widest uppercase text-xs'>
                    Actual outcome
                  </th>
                  <th className='py-2 px-3 font-display tracking-widest uppercase text-xs text-right'>
                    Points
                  </th>
                  <th className='py-2 px-3 font-display tracking-widest uppercase text-xs hidden sm:table-cell'>
                    Why
                  </th>
                </tr>
              </thead>
              <tbody>
                {GROUP_SCORING.map((row, idx) => (
                  <tr
                    key={`${row.pick}-${row.outcome}`}
                    className={cn(
                      "border-t border-paper-edge/40",
                      idx % 2 === 1 && "bg-paper-soft/50"
                    )}
                  >
                    <td className='py-2 px-3 font-display tracking-wide'>
                      {row.pick}
                    </td>
                    <td className='py-2 px-3 font-display tracking-wide'>
                      {row.outcome}
                    </td>
                    <td className='py-2 px-3 text-right'>
                      <PointsCell value={row.pts} accent />
                    </td>
                    <td className='py-2 px-3 text-ink-soft text-xs hidden sm:table-cell'>
                      {row.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className='text-xs text-ink-soft mt-2 italic'>
            Maximum per group match: <strong>3 points</strong>.
          </p>
        </CardContent>
      </Card>

      {/* 03 — Knockout scoring */}
      <Card className='border-paper-edge bg-paper'>
        <CardContent className='p-5'>
          <SectionHeading number='03' title='Knockout-stage scoring' />
          <p className='text-sm text-ink-soft mb-3'>
            For every knockout match you pick the result <em>after</em> 90 +
            extra time (Home wins, Away wins, or Draw → penalties). If you pick{" "}
            <strong>Draw</strong>, you also name which team you think advances
            on penalties.
          </p>

          <ol className='text-sm text-ink space-y-2 pl-1 mb-4'>
            <li>
              <span className='font-display tracking-wider uppercase text-mustard text-xs mr-2'>
                Base
              </span>
              Same <strong>3 / 1 / 0</strong> scoring as the group stage, on
              the regulation + extra-time outcome.
            </li>
            <li>
              <span className='font-display tracking-wider uppercase text-mustard text-xs mr-2'>
                Bonus
              </span>
              <strong>+1 point</strong> if the team you named to advance
              actually advanced — whether through regulation, extra time, or
              penalties.
            </li>
          </ol>

          <div className='overflow-x-auto rounded-sm border-2 border-paper-edge'>
            <table className='w-full text-sm'>
              <thead className='bg-ink text-paper'>
                <tr className='text-left'>
                  <th className='py-2 px-3 font-display tracking-widest uppercase text-xs'>
                    Your pick
                  </th>
                  <th className='py-2 px-3 font-display tracking-widest uppercase text-xs'>
                    Actual outcome
                  </th>
                  <th className='py-2 px-3 font-display tracking-widest uppercase text-xs text-right'>
                    Base
                  </th>
                  <th className='py-2 px-3 font-display tracking-widest uppercase text-xs text-right'>
                    Bonus
                  </th>
                  <th className='py-2 px-3 font-display tracking-widest uppercase text-xs text-right'>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {KO_EXAMPLES.map((row, idx) => (
                  <tr
                    key={idx}
                    className={cn(
                      "border-t border-paper-edge/40",
                      idx % 2 === 1 && "bg-paper-soft/50"
                    )}
                  >
                    <td className='py-2 px-3 font-display tracking-wide'>
                      {row.pick}
                    </td>
                    <td className='py-2 px-3 font-display tracking-wide'>
                      {row.outcome}
                    </td>
                    <td className='py-2 px-3 text-right'>
                      <PointsCell value={row.base} accent />
                    </td>
                    <td className='py-2 px-3 text-right'>
                      <PointsCell value={row.bonus} accent />
                    </td>
                    <td className='py-2 px-3 text-right'>
                      <span className='font-mono font-bold text-base tabular-nums text-ink'>
                        {row.base + row.bonus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className='text-xs text-ink-soft mt-2 italic'>
            Maximum per knockout match:{" "}
            <strong>4 points</strong> (3 base + 1 bonus).
          </p>
        </CardContent>
      </Card>

      {/* 04 — Tournament champion */}
      <Card className='border-paper-edge bg-paper'>
        <CardContent className='p-5'>
          <SectionHeading
            number='04'
            title={
              <>
                Tournament champion{" "}
                <span className='text-mustard'>(+26)</span>
              </>
            }
          />
          <div className='flex items-start gap-4'>
            <div className='flex items-center justify-center h-16 w-16 rounded-sm bg-mustard/15 border-2 border-mustard shrink-0'>
              <Crown className='h-8 w-8 text-mustard' strokeWidth={1.5} />
            </div>
            <ul className='text-sm text-ink space-y-2 leading-relaxed flex-1'>
              <li>
                One pick per person, made on the <strong>Champion</strong>{" "}
                tab. Locks at the <strong>kickoff of the opening match</strong>{" "}
                (2026-06-11).
              </li>
              <li>
                <span className='font-display tracking-wider uppercase text-mustard text-xs mr-2'>
                  Award
                </span>
                <strong>+26 points</strong> if your team lifts the trophy. 0
                otherwise.
              </li>
              <li>
                Until lock, you can change your pick freely — try out
                different countries while you're deciding. Each country tile
                in the picker shows a quick fun fact on hover.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* 04b — Tie-breaker */}
      <Card className='border-paper-edge bg-paper'>
        <CardContent className='p-5'>
          <SectionHeading number='05' title='Tie-breaker' />
          <p className='text-sm text-ink leading-relaxed'>
            When two or more players end the tournament with the same total,
            the higher rank goes to whoever has the most{" "}
            <strong>exact predictions</strong> — that is, matches where you
            scored the maximum (3 pts in a group match, or 4 pts in a knockout
            match with the right advancing team). The Standings table shows
            this count in the "Exact" column.
          </p>
          <p className='text-xs text-ink-soft mt-3 italic'>
            If two players are still tied on exact predictions, the higher
            rank goes alphabetically by display name. (Unlikely, but we need
            a rule.)
          </p>
        </CardContent>
      </Card>

      {/* 05 — The prize */}
      <Card className='border-mustard ring-2 ring-mustard/40 bg-paper overflow-hidden relative'>
        {/* gold shimmer accent reused from the podium */}
        <div className='absolute inset-0 wc26-gold-shimmer pointer-events-none' />
        <div className='h-1 w-full grid grid-cols-3 relative'>
          <div className='bg-crimson' />
          <div className='bg-mustard' />
          <div className='bg-pitch' />
        </div>
        <CardContent className='p-5 relative'>
          <SectionHeading number='06' title='The Prize' />
          <div className='flex items-start gap-4 flex-wrap'>
            <div className='flex items-center justify-center h-20 w-20 rounded-sm bg-mustard/15 border-2 border-mustard shrink-0'>
              <Trophy className='h-10 w-10 text-mustard' strokeWidth={1.5} />
            </div>
            <div className='flex-1 min-w-[240px]'>
              <p className='font-display tracking-wide text-2xl text-ink leading-tight'>
                LEGO® FIFA World Cup Official Trophy
              </p>
              <p className='font-mono text-[11px] text-ink-soft mt-1 tracking-wider'>
                Set #{LEGO_SET_NUMBER}
              </p>
              <p className='text-sm text-ink-soft mt-2'>
                Awarded to the player with the highest total at the end of the
                tournament. Ties are broken on exact-prediction count — see
                section 05 above.
              </p>
              <a
                href={LEGO_SET_URL}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-sm border-2 border-mustard bg-paper hover:bg-mustard hover:text-ink text-ink font-display tracking-wider uppercase text-xs transition-colors'
              >
                View on LEGO.com
                <ExternalLink className='h-3.5 w-3.5' />
              </a>
            </div>
          </div>

          <div className='mt-4 flex items-start gap-3 p-3 rounded-sm bg-crimson/10 border-2 border-crimson/40'>
            <AlertTriangle className='h-5 w-5 text-crimson mt-0.5 shrink-0' />
            <div className='text-sm'>
              <p className='font-display tracking-widest uppercase text-xs text-crimson mb-1'>
                Minimum adoption required
              </p>
              <p className='text-ink leading-relaxed'>
                At least <strong>26 people</strong> need to make predictions in
                both the <strong>group stage</strong> and the{" "}
                <strong>knockout stage</strong> for the trophy to be sponsored.
                Below that threshold, the prize will not be awarded — though
                bragging rights are still very much on the line.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <FunFactStrip />
    </div>
  );
}
