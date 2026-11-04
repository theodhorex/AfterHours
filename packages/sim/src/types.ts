/**
 * Simulation domain types and data contracts per docs/data-contract.md (sections 4, 5, 10, 11).
 * Erasable TypeScript only: interfaces and type aliases, no enums or namespaces.
 */

// --- Data Contract Section 5: Simulation State ---

export interface Business {
  id: string;
  recipe: string;
  open: boolean;
  coin: bigint;
  inventory: Record<string, bigint>;
  insolvent_steps: number;
}

export interface SectorState {
  idx: number;
  kind: string;
  owner: string | null;
  arc_origin: string;
  businesses: Business[];
  rules: unknown[];
}

export interface CityState {
  city_id: string;
  arc_id: string;
  step: number;
  world_seed: string;
  stage: number;
  sectors: [SectorState, SectorState, SectorState, SectorState, SectorState, SectorState];
  citizens: {
    population: bigint;
    satisfaction_bps: bigint;
    purse: bigint;
  };
  market: {
    price: Record<string, bigint>;
    demand_ema: Record<string, bigint>;
  };
  treasury: bigint;
  totals: {
    items: Record<string, bigint>;
    coin: bigint;
  };
}

// Checkpoint types live in checkpoint.ts (they mirror the Rust contract structs).

// --- Data Contract Section 11: Events ---

export interface SimEvent {
  event: string;
  city_id: string;
  step: number;
  [key: string]: unknown;
}

// --- Data Contract Section 4: Arc File Definitions ---

export interface ArcItem {
  id: string;
  base_price: bigint;
  tier: string;
}

export interface ArcSector {
  idx: number;
  kind: string;
  name: string;
}

export interface ArcRecipe {
  id: string;
  sector: number;
  inputs: Record<string, bigint>;
  outputs: Record<string, bigint>;
  wage: bigint;
  max_per_run_per_business: bigint;
}

export interface ArcNeed {
  item: string;
  per_capita_milli: bigint;
  alt: string[];
  satisfaction_weight: bigint;
}

export interface ArcCitizens {
  start_population: bigint;
  needs: ArcNeed[];
}

export interface ArcStage {
  id: string;
  min_population: bigint;
  max_businesses_per_sector: bigint;
}

export interface ArcEffect {
  kind: string;
  recipe?: string;
  sector?: number;
  bps?: bigint;
  [key: string]: unknown;
}

export interface ArcEventDef {
  id: string;
  weight: bigint;
  duration_steps: bigint;
  effects: ArcEffect[];
}

export interface ArcGenesis {
  coin_per_business: bigint;
  coin_citizens: bigint;
  starting_businesses: Record<string, bigint>;
}

export interface ArcFile {
  id: string;
  name: string;
  server: string;
  version: number;
  items: ArcItem[];
  sectors: ArcSector[];
  recipes: ArcRecipe[];
  citizens: ArcCitizens;
  stages: ArcStage[];
  events: ArcEventDef[];
  genesis: ArcGenesis;
}
