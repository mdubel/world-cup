import { BracketDialog } from "@/components/BracketDialog";
import { BracketSlot } from "@/components/BracketSlot";
import { EmptyState } from "@/components/EmptyState";
import { SpoilerBanner } from "@/components/SpoilerBanner";
import { TeamFlag } from "@/components/TeamFlag";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAppData } from "@/contexts/AppData";
import { useSpoilers } from "@/contexts/Spoilers";
import {
  BRACKET_ROW_SPAN,
  BRACKET_STAGES,
  BRACKET_TOTAL_ROWS,
  STAGE_COLUMN_LABEL,
  buildKnockoutColumns,
  earliestWatchLaterStage,
  stageIndex,
  type BracketStage,
} from "@/lib/bracket";
import { actualAdvancingSide } from "@/lib/fixtures";
import type { Match, PredictionsMap, TrackerMap } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";
import { useMemo, useState } from "react";

interface ColumnProps {
  stage: BracketStage;
  matches: Match[];
  showPicksVsReality: boolean;
  predictions: PredictionsMap;
  tracker: TrackerMap;
  /**
   * When true, every slot in this stage gets `forceMask` regardless of
   * per-slot tracker state — its teams come from feeders the user hasn't
   * watched.
   */
  maskTeams: boolean;
  onSelect: (m: Match) => void;
}

function StageColumn({
  stage,
  matches,
  showPicksVsReality,
  predictions,
  tracker,
  maskTeams,
  onSelect,
}: ColumnProps) {
  const span = BRACKET_ROW_SPAN[stage];

  return (
    <div className='flex flex-col min-w-[200px]'>
      <div className='font-display tracking-widest text-xs uppercase text-ink-soft text-center pb-2 border-b border-paper-edge/60 sticky top-0 bg-background z-10'>
        {STAGE_COLUMN_LABEL[stage]}
      </div>
      <div
        className='grid grow pt-2'
        style={{
          gridTemplateRows: `repeat(${BRACKET_TOTAL_ROWS}, minmax(0, 1fr))`,
        }}
      >
        {matches.map((m, idx) => (
          <div
            key={m.match_id}
            className='flex items-center px-1 py-1'
            style={{
              gridRowStart: idx * span + 1,
              gridRowEnd: (idx + 1) * span + 1,
            }}
          >
            <BracketSlot
              match={m}
              prediction={predictions[m.match_id]}
              trackerState={tracker[m.match_id]}
              forceMask={maskTeams}
              showPicksVsReality={showPicksVsReality}
              onClick={() => onSelect(m)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BracketTab() {
  const {
    fixtures: { matches, loaded },
    predictions,
    tracker,
    tournamentPick,
  } = useAppData();
  const { revealed } = useSpoilers();
  const [showPicksVsReality, setShowPicksVsReality] = useState(false);
  const [selected, setSelected] = useState<Match | null>(null);

  const { byStage, thirdPlace } = useMemo(
    () => buildKnockoutColumns(matches),
    [matches]
  );

  // Earliest knockout stage with a WATCH_LATER match. Slots in stages STRICTLY
  // LATER than this need their team identities masked — knowing the home/away
  // team would reveal the upstream feeder's outcome.
  const earliestUnwatched = useMemo(
    () => earliestWatchLaterStage(matches, tracker),
    [matches, tracker]
  );
  const knockoutHasWatchLater = earliestUnwatched !== null;
  const earliestUnwatchedIdx = earliestUnwatched
    ? stageIndex(earliestUnwatched)
    : -1;
  const stageNeedsMask = (stage: BracketStage): boolean => {
    if (revealed) return false;
    if (earliestUnwatchedIdx < 0) return false;
    return stageIndex(stage) > earliestUnwatchedIdx;
  };

  const champion = useMemo(() => {
    const final = byStage.FINAL[0];
    if (!final || final.status !== "FINISHED") return null;
    // Trophy reveals the eventual champion. Suppress when:
    //   - the user marked the final WATCH_LATER, OR
    //   - any earlier knockout match is WATCH_LATER and they haven't revealed.
    if (
      tracker[final.match_id] === "WATCH_LATER" ||
      (knockoutHasWatchLater && !revealed)
    ) {
      return null;
    }
    const advancing = actualAdvancingSide(final);
    if (advancing === "HOME") {
      return {
        team_name: final.home_team_name,
        team_code: final.home_team_code,
        team_crest: final.home_team_crest,
      };
    }
    if (advancing === "AWAY") {
      return {
        team_name: final.away_team_name,
        team_code: final.away_team_code,
        team_crest: final.away_team_crest,
      };
    }
    return null;
  }, [byStage.FINAL, tracker, knockoutHasWatchLater, revealed]);

  if (!loaded) {
    return <EmptyState title='Loading bracket…' />;
  }

  const totalKnockoutMatches = BRACKET_STAGES.reduce(
    (s, stage) => s + byStage[stage].length,
    0
  );

  if (totalKnockoutMatches === 0) {
    return (
      <EmptyState
        title='No knockout fixtures yet'
        description='The bracket fills in as the schedule loads.'
      />
    );
  }

  return (
    <div className='space-y-5'>
      <div className='flex items-baseline justify-between flex-wrap gap-3'>
        <div>
          <h2 className='tournament-title text-2xl text-ink'>
            Knockout <span className='text-crimson'>Ladder</span>
          </h2>
          <p className='text-xs text-ink-soft mt-1'>
            32 → 16 → 8 → 4 → 2 → champion. Click any slot to predict or mark
            it for later.
          </p>
        </div>
        <label className='flex items-center gap-2 text-xs uppercase tracking-widest font-display text-ink-soft cursor-pointer'>
          <Switch
            checked={showPicksVsReality}
            onCheckedChange={setShowPicksVsReality}
          />
          Picks vs reality
        </label>
      </div>

      {knockoutHasWatchLater && (
        <SpoilerBanner description='Filled-in slots reveal the winner of feeder matches. Slots downstream of your unwatched matches are masked until you reveal.' />
      )}

      {/*
        Full-bleed on lg+: break out of the parent's max-w-6xl container so
        the bracket can use the full viewport width on wide screens.
        max-w-screen-2xl caps it on huge monitors so columns don't sprawl.
        On smaller screens fall back to the original horizontal-scroll
        behaviour inside the normal page width.
      */}
      <div className='-mx-4 sm:mx-0 lg:w-screen lg:ml-[calc(-50vw+50%)] lg:mr-[calc(-50vw+50%)]'>
        <div className='lg:max-w-screen-2xl lg:mx-auto lg:px-6'>
          <div className='overflow-x-auto'>
            <div
              className='px-4 sm:px-0'
              style={{ minWidth: "max-content" }}
            >
              <div
                className='grid gap-x-3'
                style={{
                  gridTemplateColumns:
                    "repeat(5, minmax(160px, 1fr)) 140px",
                  minHeight: "1100px",
                }}
              >
            {BRACKET_STAGES.map((stage) => (
              <StageColumn
                key={stage}
                stage={stage}
                matches={byStage[stage]}
                showPicksVsReality={showPicksVsReality}
                predictions={predictions}
                tracker={tracker}
                maskTeams={stageNeedsMask(stage)}
                onSelect={setSelected}
              />
            ))}

            {/* Trophy column */}
            <div className='flex flex-col'>
              <div className='font-display tracking-widest text-xs uppercase text-ink-soft text-center pb-2 border-b border-paper-edge/60 sticky top-0 bg-background z-10'>
                Champion
              </div>
              <div className='grow flex items-center justify-center pt-2'>
                <div
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-sm w-full",
                    "border-2 border-mustard bg-mustard/10",
                    "shadow-[0_3px_0_var(--ink)]"
                  )}
                >
                  <Trophy
                    className='h-12 w-12 text-mustard'
                    strokeWidth={1.5}
                  />
                  {champion ? (
                    <>
                      <TeamFlag
                        crest={champion.team_crest}
                        code={champion.team_code}
                        name={champion.team_name}
                        size='lg'
                      />
                      <span className='font-display tracking-wide text-sm text-center'>
                        {champion.team_name}
                      </span>
                      <span className='font-display tracking-widest uppercase text-[9px] text-mustard'>
                        World Champions
                      </span>
                    </>
                  ) : tournamentPick && tournamentPick.team_id ? (
                    <>
                      <span className='font-display tracking-widest uppercase text-[9px] text-ink-soft'>
                        Your pick
                      </span>
                      <span className='font-display tracking-wide text-sm text-center'>
                        {tournamentPick.team_name ?? tournamentPick.team_id}
                      </span>
                    </>
                  ) : (
                    <span className='font-display tracking-widest uppercase text-[9px] text-ink-soft text-center leading-relaxed'>
                      Pick yours in the
                      <br />
                      Champion tab
                    </span>
                  )}
                </div>
              </div>
            </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {thirdPlace && (
        <Card className='border-paper-edge bg-paper'>
          <CardContent className='p-4 flex items-center gap-4 flex-wrap'>
            <div>
              <div className='font-display tracking-widest text-xs uppercase text-bronze'>
                Third place
              </div>
              <div className='text-xs text-ink-soft mt-0.5'>
                Consolation playoff for the losing semi-finalists.
              </div>
            </div>
            <div className='ml-auto w-full sm:w-[280px]'>
              <BracketSlot
                match={thirdPlace}
                prediction={predictions[thirdPlace.match_id]}
                trackerState={tracker[thirdPlace.match_id]}
                /*
                 * Third-place's teams come from the two losing semi-finalists,
                 * so if any of the SFs (or earlier rounds) is WATCH_LATER, its
                 * matchup itself is a spoiler. Mask whenever the user has any
                 * unwatched knockout match.
                 */
                forceMask={knockoutHasWatchLater && !revealed}
                showPicksVsReality={showPicksVsReality}
                onClick={() => setSelected(thirdPlace)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <BracketDialog
        match={selected}
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </div>
  );
}
