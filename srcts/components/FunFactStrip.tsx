import { FUN_FACTS, type FunFact, pickRandomFact } from "@/data/funFacts";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { useState } from "react";

interface FunFactStripProps {
  facts?: FunFact[];
  className?: string;
}

/**
 * Decorative trivia strip. Picks a random fact on mount and offers a re-roll
 * button so the user can browse a few without leaving the page.
 */
export function FunFactStrip({ facts = FUN_FACTS, className }: FunFactStripProps) {
  const [fact, setFact] = useState<FunFact>(() => pickRandomFact(facts));

  const reroll = () => {
    if (facts.length <= 1) return;
    let next = pickRandomFact(facts);
    // Avoid showing the same fact twice in a row when there are alternatives.
    while (next.text === fact.text) {
      next = pickRandomFact(facts);
    }
    setFact(next);
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 rounded-sm",
        "bg-mustard/15 border-2 border-mustard/40",
        "text-sm leading-relaxed",
        className
      )}
    >
      <Sparkles className='h-4 w-4 mt-0.5 text-mustard shrink-0' />
      <p className='flex-1 text-ink'>
        <span className='font-display tracking-widest text-mustard text-xs uppercase mr-2'>
          Did you know
        </span>
        {fact.text}
      </p>
      <button
        type='button'
        onClick={reroll}
        className='text-[10px] uppercase tracking-widest font-display text-ink-soft hover:text-ink underline shrink-0'
      >
        Another
      </button>
    </div>
  );
}
