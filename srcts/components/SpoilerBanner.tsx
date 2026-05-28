import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSpoilers } from "@/contexts/Spoilers";
import { Eye, EyeOff } from "lucide-react";

interface SpoilerBannerProps {
  title?: string;
  description?: string;
}

/**
 * Reusable "Spoilers ahead" banner. Wired to the global SpoilersContext so
 * clicking Reveal in one tab opts in across all the others for the session.
 */
export function SpoilerBanner({
  title = "Spoilers ahead.",
  description = "Some of your matches are unwatched. Results may be visible here.",
}: SpoilerBannerProps) {
  const { revealed, toggle } = useSpoilers();
  return (
    <Card className='border-mustard/60 bg-mustard/10'>
      <CardContent className='py-3 px-4 flex flex-wrap items-center justify-between gap-3'>
        <div className='text-sm flex items-start gap-3'>
          <Eye className='h-5 w-5 text-mustard mt-0.5 shrink-0' />
          <div>
            <p className='font-display tracking-wider'>{title}</p>
            <p className='text-ink-soft text-xs mt-0.5'>{description}</p>
          </div>
        </div>
        <Button
          size='sm'
          variant={revealed ? "outline" : "default"}
          onClick={toggle}
          className='font-display tracking-wider'
        >
          {revealed ? (
            <>
              <EyeOff className='h-4 w-4 mr-1.5' /> Hide again
            </>
          ) : (
            <>
              <Eye className='h-4 w-4 mr-1.5' /> Reveal anyway
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
