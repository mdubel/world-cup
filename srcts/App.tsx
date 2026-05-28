import { Header } from "@/components/Header";
import { MatchMarquee } from "@/components/MatchMarquee";
import { BracketTab } from "@/components/Tabs/BracketTab";
import { GroupsTab } from "@/components/Tabs/GroupsTab";
import { LeaderboardTab } from "@/components/Tabs/LeaderboardTab";
import { PredictionsTab } from "@/components/Tabs/PredictionsTab";
import { RulesTab } from "@/components/Tabs/RulesTab";
import { TournamentPickTab } from "@/components/Tabs/TournamentPickTab";
import { TrackerTab } from "@/components/Tabs/TrackerTab";
import { Toaster } from "@/components/Toaster";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppDataProvider } from "@/contexts/AppData";
import { SpoilersProvider } from "@/contexts/Spoilers";
import { ThemeProvider } from "@/contexts/Theme";
import { TimezoneProvider } from "@/contexts/Timezone";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export function App() {
  const user = useCurrentUser();

  return (
    <TooltipProvider>
     <ThemeProvider serverTheme={user?.theme ?? null}>
      <TimezoneProvider tz={user?.tz ?? null}>
      <SpoilersProvider>
      <AppDataProvider user={user}>
        <div className='min-h-screen bg-background'>
          <Header user={user} />
          <MatchMarquee />
          <main className='max-w-6xl mx-auto px-4 sm:px-6 py-6'>
            <Tabs defaultValue='tracker' className='space-y-5'>
              <div className='-mx-4 sm:mx-0 overflow-x-auto'>
                <TabsList
                  className='
                    bg-paper-soft border-2 border-paper-edge p-1 h-auto
                    rounded-md mx-4 sm:mx-0 w-fit sm:w-full flex gap-0
                  '
                >
                  {/*
                    Two visually-distinct clusters:
                    - Follow: schedule, groups, bracket (tournament watching)
                    - Pool:   picks, champion, standings (betting/scoring)
                    Vertical divider separates them; on >= sm the pool cluster
                    is pushed to the right edge.
                  */}
                  <div
                    className='flex'
                    aria-label='Tournament tracking'
                  >
                    <TabsTrigger
                      value='tracker'
                      className='font-display tracking-wider data-[state=active]:bg-ink data-[state=active]:text-paper'
                    >
                      Schedule
                    </TabsTrigger>
                    <TabsTrigger
                      value='groups'
                      className='font-display tracking-wider data-[state=active]:bg-pitch data-[state=active]:text-paper'
                    >
                      Groups
                    </TabsTrigger>
                    <TabsTrigger
                      value='bracket'
                      className='font-display tracking-wider data-[state=active]:bg-bronze data-[state=active]:text-paper'
                    >
                      Bracket
                    </TabsTrigger>
                  </div>

                  <div
                    aria-hidden='true'
                    className='w-px self-stretch bg-paper-edge mx-2 my-1'
                  />

                  <div
                    className='flex sm:ml-auto'
                    aria-label='Office pool'
                  >
                    <TabsTrigger
                      value='rules'
                      className='font-display tracking-wider data-[state=active]:bg-paper data-[state=active]:text-ink data-[state=active]:border-2 data-[state=active]:border-mustard'
                    >
                      Rules
                    </TabsTrigger>
                    <TabsTrigger
                      value='predictions'
                      className='font-display tracking-wider data-[state=active]:bg-ink data-[state=active]:text-paper'
                    >
                      Picks
                    </TabsTrigger>
                    <TabsTrigger
                      value='winner'
                      className='font-display tracking-wider data-[state=active]:bg-mustard data-[state=active]:text-ink'
                    >
                      Champion
                    </TabsTrigger>
                    <TabsTrigger
                      value='leaderboard'
                      className='font-display tracking-wider data-[state=active]:bg-crimson data-[state=active]:text-paper'
                    >
                      Standings
                    </TabsTrigger>
                  </div>
                </TabsList>
              </div>
              <TabsContent value='tracker'>
                <TrackerTab />
              </TabsContent>
              <TabsContent value='groups'>
                <GroupsTab />
              </TabsContent>
              <TabsContent value='bracket'>
                <BracketTab />
              </TabsContent>
              <TabsContent value='rules'>
                <RulesTab />
              </TabsContent>
              <TabsContent value='predictions'>
                <PredictionsTab />
              </TabsContent>
              <TabsContent value='winner'>
                <TournamentPickTab />
              </TabsContent>
              <TabsContent value='leaderboard'>
                <LeaderboardTab />
              </TabsContent>
            </Tabs>
          </main>
          <Toaster />
        </div>
      </AppDataProvider>
      </SpoilersProvider>
      </TimezoneProvider>
     </ThemeProvider>
    </TooltipProvider>
  );
}
