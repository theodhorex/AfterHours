/**
 * Pure functions for century aging monuments, visual growth decorations,
 * stats strip formatting, and screen reader live region announcements.
 */

export interface CenturyMonumentSpec {
  century: number;
  agingLevel: number; // 0..4
  kind: "well" | "cistern" | "statue" | "obelisk" | "relic_monolith";
  title: string;
  hasRunicGlow: boolean;
  patinaColor: number;
  trimColor: number;
}

const MONUMENT_KINDS = [
  "well",
  "cistern",
  "statue",
  "obelisk",
  "relic_monolith",
] as const;

const MONUMENT_TITLES = [
  "Founding Timber Well",
  "Weathered Stone Cistern",
  "Verdigris Civic Bronze",
  "Gilded Century Obelisk",
  "Ancient Monumental Relic",
] as const;

const PATINA_COLORS = [
  0x8a8275, // Timber / stone
  0x5a7852, // Moss green
  0x42786a, // Verdigris bronze
  0xd4af37, // Gilded gold
  0xb89df5, // Arcane runic
] as const;

const TRIM_COLORS = [
  0x3a3225,
  0x2b4226,
  0x224a40,
  0x8a6f1c,
  0x493478,
] as const;

export function getCenturyMonumentSpec(
  century: number,
  arcId: string
): CenturyMonumentSpec {
  void arcId;
  const clampedCentury = Math.max(0, century);
  const agingLevel = Math.min(4, Math.floor(clampedCentury / 5));

  return {
    century: clampedCentury,
    agingLevel,
    kind: MONUMENT_KINDS[agingLevel],
    title: MONUMENT_TITLES[agingLevel],
    hasRunicGlow: agingLevel >= 4,
    patinaColor: PATINA_COLORS[agingLevel],
    trimColor: TRIM_COLORS[agingLevel],
  };
}

export interface AgeStatsInput {
  year: number;
  season: number;
  stageName: string;
  population: number;
  openBiz: number;
  totalBiz: number;
  satisfaction: number;
  patinaName: string;
}

export interface FormattedAgeStats {
  yearLabel: string;
  seasonName: string;
  stageName: string;
  popLabel: string;
  bizLabel: string;
  satisfactionLabel: string;
  patinaName: string;
}

const SEASONS = ["Spring", "Summer", "Autumn", "Winter"] as const;

export function formatAgeStats(input: AgeStatsInput): FormattedAgeStats {
  const seasonIdx = ((input.season % 4) + 4) % 4;
  return {
    yearLabel: `Year ${input.year} of 2500`,
    seasonName: SEASONS[seasonIdx],
    stageName: input.stageName,
    popLabel: String(input.population),
    bizLabel: `${input.openBiz} / ${input.totalBiz}`,
    satisfactionLabel: `${Math.round(input.satisfaction)}%`,
    patinaName: input.patinaName,
  };
}

export interface LiveRegionInput {
  cityName: string;
  year: number;
  stageName: string;
  prevStageName?: string;
  population: number;
  openBiz: number;
}

export function generateLiveRegionText(input: LiveRegionInput): string {
  if (
    input.prevStageName &&
    input.prevStageName.trim().toLowerCase() !==
      input.stageName.trim().toLowerCase()
  ) {
    return `Year ${input.year}: ${input.cityName} reached ${input.stageName}`;
  }

  return `Year ${input.year}: ${input.stageName}, ${input.population} citizens, ${input.openBiz} open businesses.`;
}
