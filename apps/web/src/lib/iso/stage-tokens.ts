/**
 * Pure stage styling token generator.
 * Maps simulation stage id to visual tokens for roads, walls, banners, fountains, and landmark tiers.
 */

import { getStageIndex } from "./layout.ts";

export interface StageStyleTokens {
  stageIndex: number;
  stageId: string;
  stageName: string;
  roadStyle: "dirt" | "cobble" | "paved" | "flagstone";
  wallAndGateType: "none" | "palisade" | "stone_wall" | "gate_tower";
  hasDistrictWalls: boolean;
  hasBanners: boolean;
  hasPlazaFountain: boolean;
  landmarkTier: number;
  houseLevelFloor: number;
}

export function getStageTokens(stageId: string): StageStyleTokens {
  const stageIndex = getStageIndex(stageId);
  const normalized = (stageId || "hamlet").toLowerCase();

  switch (stageIndex) {
    case 0:
      return {
        stageIndex: 0,
        stageId: normalized,
        stageName: "Hamlet",
        roadStyle: "dirt",
        wallAndGateType: "palisade",
        hasDistrictWalls: false,
        hasBanners: false,
        hasPlazaFountain: false,
        landmarkTier: 0,
        houseLevelFloor: 1,
      };
    case 1:
      return {
        stageIndex: 1,
        stageId: normalized,
        stageName: "Village",
        roadStyle: "cobble",
        wallAndGateType: "none",
        hasDistrictWalls: false,
        hasBanners: false,
        hasPlazaFountain: false,
        landmarkTier: 1,
        houseLevelFloor: 1,
      };
    case 2:
      return {
        stageIndex: 2,
        stageId: normalized,
        stageName: "Town",
        roadStyle: "paved",
        wallAndGateType: "stone_wall",
        hasDistrictWalls: true,
        hasBanners: true,
        hasPlazaFountain: false,
        landmarkTier: 1,
        houseLevelFloor: 2,
      };
    case 3:
      return {
        stageIndex: 3,
        stageId: normalized,
        stageName: "City",
        roadStyle: "flagstone",
        wallAndGateType: "gate_tower",
        hasDistrictWalls: true,
        hasBanners: true,
        hasPlazaFountain: true,
        landmarkTier: 2,
        houseLevelFloor: 2,
      };
    default:
      return {
        stageIndex: 4,
        stageId: normalized,
        stageName: "Grand City",
        roadStyle: "flagstone",
        wallAndGateType: "gate_tower",
        hasDistrictWalls: true,
        hasBanners: true,
        hasPlazaFountain: true,
        landmarkTier: 2,
        houseLevelFloor: 3,
      };
  }
}
