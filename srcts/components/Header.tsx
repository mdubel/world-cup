import { SettingsDialog } from "@/components/SettingsDialog";
import { TeamFlag } from "@/components/TeamFlag";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { useAppData } from "@/contexts/AppData";
import { useThemeContext } from "@/contexts/Theme";
import { useUserTz } from "@/contexts/Timezone";
import type { CurrentUser } from "@/lib/types";
import type { ReactNode } from "react";

interface HeaderProps {
  user?: CurrentUser;
}

/**
 * Tiny two-line "label / value" block matched in style to the existing
 * "Times in {tz}" display. Used for the theme, timezone, and favorite-team
 * summaries in the header so users can see their current settings without
 * opening the gear menu.
 */
function SummaryBlock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className='hidden md:flex flex-col items-end text-[10px] tracking-wider uppercase text-paper-edge leading-tight'>
      <span>{label}</span>
      <span className='font-mono text-paper normal-case tracking-normal text-xs flex items-center gap-1'>
        {children}
      </span>
    </div>
  );
}

export function Header({ user }: HeaderProps) {
  const tz = useUserTz();
  const { theme } = useThemeContext();
  const { favoriteTeam } = useAppData();

  return (
    <header className='relative bg-ink text-paper border-b-4 border-mustard'>
      {/* Top tri-color accent strip */}
      <div className='h-1.5 w-full grid grid-cols-3'>
        <div className='bg-crimson' />
        <div className='bg-mustard' />
        <div className='bg-pitch' />
      </div>
      <div className='max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-4'>
        <div className='flex items-baseline gap-3 min-w-0'>
          <div>
            <h1 className='tournament-title text-2xl sm:text-4xl text-paper'>
              <span className='text-mustard'>FIFA</span> 2026
            </h1>
            <p className='hidden sm:block font-display text-sm tracking-[0.3em] text-paper-edge -mt-1'>
              World&nbsp;Cup&nbsp;·&nbsp;Office&nbsp;Pool
            </p>
          </div>
        </div>
        <div className='flex items-center gap-2 sm:gap-4 shrink-0'>
          {/* Settings summaries — left-to-right: Theme · Times · Team */}
          <SummaryBlock label='Theme'>
            {theme === "dark" ? "Dark" : "Light"}
          </SummaryBlock>
          <SummaryBlock label='Times in'>{tz}</SummaryBlock>
          <SummaryBlock label='Team'>
            {favoriteTeam ? (
              <>
                <TeamFlag
                  crest={favoriteTeam.team_crest}
                  code={favoriteTeam.team_code}
                  name={favoriteTeam.team_name}
                  size='xs'
                  framed={false}
                />
                <span className='font-display tracking-wide text-paper'>
                  {favoriteTeam.team_code ?? "—"}
                </span>
              </>
            ) : (
              <span className='text-paper-edge italic'>none</span>
            )}
          </SummaryBlock>

          {user ? (
            <div className='flex items-center gap-2 min-w-0'>
              <Badge className='bg-mustard text-ink hover:bg-mustard font-display tracking-wide text-xs sm:text-sm px-2 sm:px-3 py-1 max-w-[40vw] sm:max-w-none truncate'>
                {user.display_name}
              </Badge>
              {user.is_dev && (
                <Badge
                  variant='outline'
                  className='border-paper-edge text-paper-edge text-[10px] hidden sm:inline-flex'
                >
                  dev
                </Badge>
              )}
            </div>
          ) : (
            <span className='text-xs text-paper-edge'>Loading…</span>
          )}
          <ThemeToggle />
          <SettingsDialog user={user} />
        </div>
      </div>
    </header>
  );
}
