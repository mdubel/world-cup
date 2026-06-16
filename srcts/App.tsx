import { Header } from "@/components/Header";
import { MatchMarquee } from "@/components/MatchMarquee";
import { AdminTab } from "@/components/Tabs/AdminTab";
import { BracketTab } from "@/components/Tabs/BracketTab";
import { GroupsTab } from "@/components/Tabs/GroupsTab";
import { LeaderboardTab } from "@/components/Tabs/LeaderboardTab";
import { RulesTab } from "@/components/Tabs/RulesTab";
import { StatsTab } from "@/components/Tabs/StatsTab";
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
              <div className='-mx-4 sm:mx-0'>
                {/* Single flat tab row, no clusters. Games (was Schedule)
                    is the landing page and now also handles picks — users
                    open the app and can bet inline on each match card. */}
                <TabsList
                  className='
                    bg-paper-soft border-2 border-paper-edge p-1 h-auto
                    rounded-md mx-4 sm:mx-0 w-auto sm:w-full flex
                    flex-wrap gap-1 sm:gap-0
                  '
                >
                  <TabsTrigger
                    value='tracker'
                    className='font-display tracking-wide sm:tracking-wider text-xs sm:text-sm data-[state=active]:bg-ink data-[state=active]:text-paper'
                  >
                    Games
                  </TabsTrigger>
                  <TabsTrigger
                    value='leaderboard'
                    className='font-display tracking-wide sm:tracking-wider text-xs sm:text-sm data-[state=active]:bg-crimson data-[state=active]:text-paper'
                  >
                    Standings
                  </TabsTrigger>
                  <TabsTrigger
                    value='groups'
                    className='font-display tracking-wide sm:tracking-wider text-xs sm:text-sm data-[state=active]:bg-pitch data-[state=active]:text-paper'
                  >
                    Groups
                  </TabsTrigger>
                  <TabsTrigger
                    value='bracket'
                    className='font-display tracking-wide sm:tracking-wider text-xs sm:text-sm data-[state=active]:bg-bronze data-[state=active]:text-paper'
                  >
                    Bracket
                  </TabsTrigger>
                  <TabsTrigger
                    value='stats'
                    className='font-display tracking-wide sm:tracking-wider text-xs sm:text-sm data-[state=active]:bg-paper data-[state=active]:text-ink data-[state=active]:border-2 data-[state=active]:border-ink'
                    title='Pool stats — who picked what, biggest upsets, points over time'
                  >
                    Stats
                  </TabsTrigger>
                  <TabsTrigger
                    value='winner'
                    className='font-display tracking-wide sm:tracking-wider text-xs sm:text-sm data-[state=active]:bg-mustard data-[state=active]:text-ink'
                  >
                    Champion
                  </TabsTrigger>
                  <TabsTrigger
                    value='rules'
                    className='font-display tracking-wide sm:tracking-wider text-xs sm:text-sm data-[state=active]:bg-paper data-[state=active]:text-ink data-[state=active]:border-2 data-[state=active]:border-mustard'
                  >
                    Rules
                  </TabsTrigger>
                  {user?.is_admin && (
                    <TabsTrigger
                      value='admin'
                      className='font-display tracking-wide sm:tracking-wider text-xs sm:text-sm data-[state=active]:bg-ink data-[state=active]:text-mustard data-[state=active]:border-2 data-[state=active]:border-mustard'
                      title='Admin dashboard (visible only to allow-listed admins)'
                    >
                      Admin
                    </TabsTrigger>
                  )}
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
              <TabsContent value='stats'>
                <StatsTab />
              </TabsContent>
              <TabsContent value='rules'>
                <RulesTab />
              </TabsContent>
              <TabsContent value='winner'>
                <TournamentPickTab />
              </TabsContent>
              <TabsContent value='leaderboard'>
                <LeaderboardTab />
              </TabsContent>
              {user?.is_admin && (
                <TabsContent value='admin'>
                  <AdminTab />
                </TabsContent>
              )}
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
