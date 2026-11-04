/**
 * Pure growth model and replay snapshot manager for 2500-year city evolution.
 * Computes deterministic, monotonic road growth, building tiers, sampled citizen sprites,
 * and century-based patina aging.
 */

import type { RoadTile, BuildingLayout, HouseLayout } from "./layout-types.ts";
import {
  createWorld,
  advanceWorld,
  type WorldInstance,
} from "../sim-adapter.ts";
import type { CityState } from "../../../../../packages/sim/src/types.ts";

export interface BusinessItem {
  id: string;
  sectorIdx: number;
  open: boolean;
  insolvent?: boolean;
}

export interface GrowthInput {
  arcId: string;
  stageId?: string;
  stageIndex?: number;
  year: number;
  step?: number;
  population: number;
  businesses: BusinessItem[];
  roads?: RoadTile[];
  buildings?: BuildingLayout[];
  houses?: HouseLayout[];
  plaza?: { x: number; y: number };
}

export interface BuildingSlotView {
  id: string;
  sectorIdx: number;
  tileX: number;
  tileY: number;
  tier: number; // 0..3
  level: number; // 1..4
  open: boolean;
  ruined: boolean;
  isLandmark: boolean;
}

export interface GrowthViewResult {
  builtRoads: RoadTile[];
  buildingSlots: BuildingSlotView[];
  citizenCount: number;
  citizenPositions: Array<{ x: number; y: number }>;
  century: number;
  agingLevel: number; // 0..4
  patinaName: string;
}

const PATINA_NAMES = [
  "Fresh Timber & Stone",
  "Light Weathered Moss",
  "Verdigris & Antique Patina",
  "Historic Gilded Masonry",
  "Ancient Monumental Relics",
] as const;

/**
 * Assigns a static canonical order to road tiles from center outward.
 */
function getRoadTileSortKey(r: RoadTile, plaza: { x: number; y: number }): number {
  const d = Math.abs(r.x - plaza.x) + Math.abs(r.y - plaza.y);
  // Priority: bridge/main avenues first, then lanes, tie-broken by spatial hash
  const kindWeight = r.kind === "main" ? 0 : r.kind === "branch" ? 100 : 200;
  const hash = ((r.x * 37) ^ (r.y * 17)) & 0xff;
  return d * 1000 + kindWeight + hash;
}

/**
 * Pure calculation of the visible city development state.
 * Monotonic: as year, stage, and population advance, roads and buildings never vanish.
 */
export function computeGrowthView(input: GrowthInput): GrowthViewResult {
  const year = Math.max(0, input.year);
  const stageIdx = input.stageIndex ?? 0;
  const pop = Math.max(0, input.population);
  const plaza = input.plaza ?? { x: 20, y: 20 };
  const allRoads = input.roads ?? [];

  // 1. Century and Plateau Aging
  const century = Math.floor(year / 100);
  const agingLevel = Math.min(4, Math.floor(century / 5));
  const patinaName = PATINA_NAMES[agingLevel] ?? PATINA_NAMES[0];

  // 2. Monotonic Road Network Growth
  // Base progress expands from 30% at hamlet to 100% at town/city
  const stageContrib = Math.min(0.4, stageIdx * 0.15);
  const popContrib = Math.min(0.35, (pop / 330) * 0.35);
  const yearContrib = Math.min(0.25, (year / 300) * 0.25);
  const progressRatio = Math.min(1.0, 0.3 + stageContrib + popContrib + yearContrib);

  // Sort roads deterministically from center outward
  const sortedRoads = [...allRoads].sort((a, b) => {
    return getRoadTileSortKey(a, plaza) - getRoadTileSortKey(b, plaza);
  });

  // Always keep at least 12 central road tiles, then grow monotonically with progress
  const minRoads = Math.min(sortedRoads.length, 12);
  const totalRoads = sortedRoads.length;
  const targetCount = Math.max(
    minRoads,
    Math.min(totalRoads, Math.round(minRoads + progressRatio * (totalRoads - minRoads)))
  );

  const builtRoads = sortedRoads.slice(0, targetCount);

  // 3. Building Slots & Tier Progression
  const buildingSlots: BuildingSlotView[] = [];
  const baseTier = Math.min(3, Math.max(0, stageIdx + (year >= 150 ? 1 : 0)));

  for (const b of input.buildings ?? []) {
    const biz = input.businesses.find((x) => x.id === b.id);
    const isOpen = biz ? biz.open && !biz.insolvent : b.open;
    const isRuined = biz ? !biz.open || Boolean(biz.insolvent) : b.ruined;

    // Landmarks get slightly higher tier
    const itemTier = b.isLandmark ? Math.min(3, baseTier) : Math.max(0, baseTier - (stageIdx === 0 ? 1 : 0));

    buildingSlots.push({
      id: b.id,
      sectorIdx: b.sectorIdx,
      tileX: b.tileX,
      tileY: b.tileY,
      tier: itemTier,
      level: itemTier + 1,
      open: isOpen,
      ruined: isRuined,
      isLandmark: Boolean(b.isLandmark),
    });
  }

  // 4. Sampled Citizen Sprites (1 sprite per ~10 citizens, min 2, max 60)
  const citizenCount = Math.max(2, Math.min(60, Math.round(pop / 10)));
  const citizenPositions: Array<{ x: number; y: number }> = [];

  if (builtRoads.length > 0) {
    for (let i = 0; i < citizenCount; i++) {
      // Deterministic stride across built roads
      const idx = (i * 7 + (century % 5)) % builtRoads.length;
      citizenPositions.push({ x: builtRoads[idx].x, y: builtRoads[idx].y });
    }
  }

  return {
    builtRoads,
    buildingSlots,
    citizenCount,
    citizenPositions,
    century,
    agingLevel,
    patinaName,
  };
}

export interface ReplaySnapshot {
  step: number;
  year: number;
  state: CityState;
  stateRoot: string;
}

export interface ReplaySnapshotStore {
  arcId: string;
  seed: string;
  maxStep: number;
  getSnapshotAtOrBefore(step: number): ReplaySnapshot;
  ensureStep(targetStep: number): void;
  getStateAtStep(step: number): { state: CityState; stateRoot: string };
}

/**
 * Creates an in-memory snapshot store that caches simulation snapshots
 * every 40 steps up to step 10000 (2500 years), enabling fast scrubbing.
 */
export function createReplaySnapshotStore(
  arcId: string,
  seed: string,
  cityId?: string
): ReplaySnapshotStore {
  const maxStep = 10000;
  const snapshotInterval = 40;
  const snapshots = new Map<number, ReplaySnapshot>();

  let runningWorld: WorldInstance = createWorld(arcId, seed, cityId);
  snapshots.set(0, {
    step: 0,
    year: 0,
    state: runningWorld.state,
    stateRoot: runningWorld.stateRoot,
  });

  function ensureStep(targetStep: number): void {
    const clamped = Math.max(0, Math.min(maxStep, targetStep));
    const targetSnap = Math.floor(clamped / snapshotInterval) * snapshotInterval;
    while (runningWorld.state.step < targetSnap) {
      runningWorld = advanceWorld(runningWorld, snapshotInterval);
      snapshots.set(runningWorld.state.step, {
        step: runningWorld.state.step,
        year: Math.floor(runningWorld.state.step / 4),
        state: runningWorld.state,
        stateRoot: runningWorld.stateRoot,
      });
    }
  }

  function getSnapshotAtOrBefore(step: number): ReplaySnapshot {
    const clamped = Math.max(0, Math.min(maxStep, step));
    ensureStep(clamped);
    const snapStep = Math.floor(clamped / snapshotInterval) * snapshotInterval;
    const snap = snapshots.get(snapStep);
    if (!snap) {
      return snapshots.get(0)!;
    }
    return snap;
  }

  function getStateAtStep(step: number): { state: CityState; stateRoot: string } {
    const clamped = Math.max(0, Math.min(maxStep, step));
    const snap = getSnapshotAtOrBefore(clamped);
    if (snap.step === clamped) {
      return { state: snap.state, stateRoot: snap.stateRoot };
    }
    // Advance remaining delta (at most 39 steps)
    const delta = clamped - snap.step;
    let tempWorld: WorldInstance = {
      ...runningWorld,
      state: snap.state,
      stateRoot: snap.stateRoot,
    };
    tempWorld = advanceWorld(tempWorld, delta);
    return { state: tempWorld.state, stateRoot: tempWorld.stateRoot };
  }

  return {
    arcId,
    seed,
    maxStep,
    getSnapshotAtOrBefore,
    ensureStep,
    getStateAtStep,
  };
}
