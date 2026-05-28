import { useThemeContext } from "@/contexts/Theme";
import { cn } from "@/lib/utils";
import { Moon, Sun } from "lucide-react";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggle } = useThemeContext();
  const dark = theme === "dark";

  return (
    <button
      type='button'
      onClick={toggle}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "h-9 w-9 inline-flex items-center justify-center rounded-sm",
        "border-2 border-paper-edge/40 hover:border-mustard transition-colors",
        "text-paper hover:text-mustard",
        className
      )}
    >
      {dark ? <Sun className='h-4 w-4' /> : <Moon className='h-4 w-4' />}
    </button>
  );
}
