// Random tournament trivia. Sprinkled in places to keep the app a little
// joyful. Easy to extend over time.

export interface FunFact {
  category: "tournament" | "format" | "history" | "host" | "trivia";
  text: string;
}

export const FUN_FACTS: FunFact[] = [
  {
    category: "format",
    text: "FIFA 2026 is the first 48-team World Cup — 12 groups of 4, with the top 2 plus the 8 best third-placed teams advancing.",
  },
  {
    category: "host",
    text: "It is the first World Cup hosted by three countries: the United States, Mexico, and Canada.",
  },
  {
    category: "tournament",
    text: "There are 104 matches in 2026 — 32 more than in 2022.",
  },
  {
    category: "history",
    text: "Brazil are the only nation to have appeared at every men's World Cup.",
  },
  {
    category: "history",
    text: "Italy and Brazil are the only sides to have lifted the trophy without conceding a goal in the knockout rounds.",
  },
  {
    category: "trivia",
    text: "The original 1930 trophy, the Jules Rimet, was once stolen and recovered by a dog named Pickles.",
  },
  {
    category: "trivia",
    text: "Mexico is the first nation to host (or co-host) three different World Cups: 1970, 1986, and 2026.",
  },
  {
    category: "format",
    text: "Knockout starts at the round of 32 — twice as many knockout matches as in 2022.",
  },
  {
    category: "history",
    text: "The fastest goal in World Cup history was scored by Hakan Şükür in 2002 — 11 seconds in.",
  },
  {
    category: "trivia",
    text: "MetLife Stadium in New Jersey will host the 2026 final.",
  },
];

export function pickRandomFact(facts: FunFact[] = FUN_FACTS): FunFact {
  return facts[Math.floor(Math.random() * facts.length)];
}
