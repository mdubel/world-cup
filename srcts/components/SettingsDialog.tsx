import { FavoriteTeamPicker } from "@/components/FavoriteTeamPicker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useThemeContext } from "@/contexts/Theme";
import { isValidTimezone, listTimezones, useUserTz } from "@/contexts/Timezone";
import { useShinyInput } from "@posit/shiny-react";
import { Settings as SettingsIcon } from "lucide-react";
import { useMemo } from "react";
import { tzGuess } from "@/lib/time";
import type { CurrentUser } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SettingsDialogProps {
  user?: CurrentUser;
  className?: string;
}

export function SettingsDialog({ user, className }: SettingsDialogProps) {
  const activeTz = useUserTz();
  const { theme, set: setTheme } = useThemeContext();
  const [, sendTz] = useShinyInput<string | null>("set_user_tz", null, {
    debounceMs: 0,
    priority: "event",
  });

  const groups = useMemo(() => listTimezones(), []);
  const detected = useMemo(() => tzGuess(), []);

  const handleTzChange = (next: string) => {
    if (!next || !isValidTimezone(next)) return;
    sendTz(next);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type='button'
          aria-label='Settings'
          title='Settings'
          className={cn(
            "h-9 w-9 inline-flex items-center justify-center rounded-sm",
            "border-2 border-paper-edge/40 hover:border-mustard transition-colors",
            "text-paper hover:text-mustard",
            className
          )}
        >
          <SettingsIcon className='h-4 w-4' />
        </button>
      </DialogTrigger>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle className='font-display tracking-widest text-2xl text-crimson'>
            Settings
          </DialogTitle>
          <DialogDescription>
            These preferences are saved to your profile and follow you across
            devices.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-5 pt-2'>
          <section className='space-y-2'>
            <Label
              htmlFor='wc26-tz'
              className='font-display tracking-widest uppercase text-xs'
            >
              Timezone
            </Label>
            <select
              id='wc26-tz'
              value={activeTz}
              onChange={(e) => handleTzChange(e.target.value)}
              className={cn(
                "w-full rounded-sm border-2 border-paper-edge bg-paper",
                "px-3 py-2 text-sm font-mono",
                "focus:outline-none focus:border-ink"
              )}
            >
              {groups.map((g) => (
                <optgroup key={g.region} label={g.region}>
                  {g.zones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div className='flex items-center justify-between text-xs text-ink-soft'>
              <span>
                All match times will be shown in{" "}
                <span className='font-mono text-ink'>{activeTz}</span>.
              </span>
              {activeTz !== detected && (
                <button
                  type='button'
                  onClick={() => handleTzChange(detected)}
                  className='underline font-display tracking-widest text-[10px] uppercase'
                >
                  Use device tz ({detected})
                </button>
              )}
            </div>
          </section>

          <section className='space-y-2'>
            <Label className='font-display tracking-widest uppercase text-xs'>
              Your team
            </Label>
            <FavoriteTeamPicker />
          </section>

          <section className='space-y-2'>
            <Label className='font-display tracking-widest uppercase text-xs'>
              Theme
            </Label>
            <div className='flex items-center justify-between p-3 rounded-sm border-2 border-paper-edge bg-paper'>
              <div>
                <div className='font-display tracking-wide text-base'>
                  {theme === "dark" ? "Dark" : "Light"} mode
                </div>
                <div className='text-xs text-ink-soft'>
                  {theme === "dark"
                    ? "Dim cream is replaced with deep navy."
                    : "Cream paper backgrounds, navy ink."}
                </div>
              </div>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={(checked) =>
                  setTheme(checked ? "dark" : "light")
                }
              />
            </div>
          </section>

          {user?.id && (
            <p className='text-[10px] uppercase tracking-widest text-ink-soft text-center font-display pt-2 border-t border-paper-edge/60'>
              Signed in as <span className='text-ink'>{user.display_name}</span>
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
