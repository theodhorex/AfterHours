/**
 * Meme Mayors data & procedural portrait specifications.
 * 100% fictional parody characters only — no real people, no real names or faces.
 * Kept pure with zero dependencies for Node tests and React UI.
 */

export interface MayorPortraitPalette {
  skin: string;
  accent: string;
  eyes: string;
  hat?: string;
  background: string;
  outline: string;
}

export type MayorArchetype = "goblin" | "dwarf" | "dino" | "elf";

export interface MayorPortraitSpec {
  archetype: MayorArchetype;
  palette: MayorPortraitPalette;
  features: {
    earStyle: "pointy_long" | "tucked" | "crested" | "slender_high";
    eyebrowTilt: number; // degrees
    mouthStyle: "wide_smirk" | "bushy_beard" | "toothy_grin" | "serene_smile";
    hasMonocle?: boolean;
    hasCrown?: boolean;
    hasHelmet?: boolean;
  };
}

export interface Mayor {
  id: string; // arcId matching world
  name: string;
  title: string;
  tagline: string;
  charisma: number; // 0..100
  catchphrases: [string, string, string];
  portraitSpec: MayorPortraitSpec;
}

export const MAYORS: Record<string, Mayor> = {
  goblin_warrens: {
    id: "goblin_warrens",
    name: "Gromlet Breadhoarder III",
    title: "Supreme High Bargainer & Chief Dough Officer",
    tagline: "Why tax the citizens when you can simply inflate the yeast?",
    charisma: 94,
    catchphrases: [
      "A crust in the vault is worth ten in the oven!",
      "I promise 200% more bubbles in every loaf by next season.",
      "Audits are merely financial fan fiction anyway.",
    ],
    portraitSpec: {
      archetype: "goblin",
      palette: {
        skin: "#5a8c43",
        accent: "#d4a24e",
        eyes: "#ffe17d",
        hat: "#993d28",
        background: "#1c2219",
        outline: "#2b3b20",
      },
      features: {
        earStyle: "pointy_long",
        eyebrowTilt: 15,
        mouthStyle: "wide_smirk",
        hasMonocle: true,
      },
    },
  },

  cave_hold: {
    id: "cave_hold",
    name: "Baron Balthazar Oresniffer",
    title: "Underlord of Deep Shafts & Mineral Audits",
    tagline: "Solid as basalt, twice as stubborn, and proudly allergic to sunshine.",
    charisma: 82,
    catchphrases: [
      "If it cannot be chiseled into bedrock, it is not a legally binding contract.",
      "Deep mining builds character, resilience, and exceptionally sturdy shinbones.",
      "I never trust any coin that does not bruise your toes when dropped.",
    ],
    portraitSpec: {
      archetype: "dwarf",
      palette: {
        skin: "#c79e7b",
        accent: "#3a6078",
        eyes: "#63cdda",
        hat: "#7f8c8d",
        background: "#1a1e24",
        outline: "#34495e",
      },
      features: {
        earStyle: "tucked",
        eyebrowTilt: -8,
        mouthStyle: "bushy_beard",
        hasHelmet: true,
      },
    },
  },

  dino_vale: {
    id: "dino_vale",
    name: "Magistrate Rexford von Scales",
    title: "Grand Carnosaur Sovereign of the Great Basin",
    tagline: "A tiny pair of arms, but a monstrous appetite for municipal deregulation.",
    charisma: 88,
    catchphrases: [
      "Raw steak prices are up, but so is our collective jaw strength!",
      "Remember: herbivores browse, but predators balance the ledger.",
      "Never contest a land survey against someone whose teeth outnumber your council.",
    ],
    portraitSpec: {
      archetype: "dino",
      palette: {
        skin: "#2e7d56",
        accent: "#c0392b",
        eyes: "#f39c12",
        hat: "#27ae60",
        background: "#17231c",
        outline: "#14402b",
      },
      features: {
        earStyle: "crested",
        eyebrowTilt: 10,
        mouthStyle: "toothy_grin",
        hasMonocle: false,
      },
    },
  },

  elf_grove: {
    id: "elf_grove",
    name: "Lord Zephyr Leafwhisper",
    title: "First Botanical Chancellor & Tree-Root Arbitrator",
    tagline: "Governing in harmony with the canopy since three centuries before you were hatched.",
    charisma: 91,
    catchphrases: [
      "Let us convene a polite 40-year symposium before pruning that branch.",
      "Photosynthesis is the only truly sound and unforgeable monetary policy.",
      "I have already foreseen your fiscal deficit in the falling autumn leaves.",
    ],
    portraitSpec: {
      archetype: "elf",
      palette: {
        skin: "#d8c4b6",
        accent: "#8e44ad",
        eyes: "#a8e6cf",
        hat: "#2ecc71",
        background: "#1b241e",
        outline: "#27ae60",
      },
      features: {
        earStyle: "slender_high",
        eyebrowTilt: -4,
        mouthStyle: "serene_smile",
        hasCrown: true,
      },
    },
  },
};

export const MAYOR_DECREES: Record<string, string[]> = {
  goblin_warrens: [
    "Decree #1: Mandatory 15% increase in mushroom seasoning across all tavern soups.",
    "Decree #2: Anyone caught hoarding cold dough shall be sentenced to 3 seasons of bakery duty.",
    "Decree #3: Official city currency shall smell lightly of freshly baked rye bread.",
    "Decree #4: Squeaking boots are now subsidized to alert shopkeepers to eager customers.",
  ],
  cave_hold: [
    "Decree #1: Daylight saving time is permanently outlawed beneath 500 meters depth.",
    "Decree #2: All stone anvils must ring in the key of F-sharp to maintain miner morale.",
    "Decree #3: Whistling in magma chambers is punishable by mandatory pickaxe polishing.",
    "Decree #4: Beard length shall be counted as valid collateral for tavern credit.",
  ],
  dino_vale: [
    "Decree #1: Tail-wagging clearances must be maintained in all market thoroughfares.",
    "Decree #2: Roaring after sunset is restricted to designated canyon acoustics zones.",
    "Decree #3: Amber tokens are officially deemed tastier than gold coins.",
    "Decree #4: Stegosaurus back-plate waxing is now a tax-deductible grooming expense.",
  ],
  elf_grove: [
    "Decree #1: Tree roots have right-of-way over all municipal cart traffic.",
    "Decree #2: Loud sighs during council poetry readings are strictly frowned upon.",
    "Decree #3: Blossoms falling on private property must be returned to communal soil.",
    "Decree #4: Daylight belongs to the photosynthesis reserve; please speak softly.",
  ],
};

/**
 * Get mayor by arc ID with goblin_warrens as default fallback.
 */
export function getMayorByArc(arcId: string): Mayor {
  return MAYORS[arcId] ?? MAYORS.goblin_warrens;
}

/**
 * Deterministically select a decree line from the city year without RNG.
 */
export function getMayorDecree(mayor: Mayor, year: number): string {
  const decrees = MAYOR_DECREES[mayor.id] ?? MAYOR_DECREES.goblin_warrens;
  const safeYear = Math.abs(Math.floor(year));
  const index = safeYear % decrees.length;
  return decrees[index];
}
