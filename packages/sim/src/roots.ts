import { leaf, node, toHex, fromHex } from "./hash.ts";
import type { Business, CityState, SectorState } from "./types.ts";

/**
 * Sector proof returned by sectorProof(state, idx).
 * Contains the index of the sector being proven, the Merkle roots of the
 * other 5 sectors in increasing index order, and the city_core leaf hash.
 */
export interface SectorProof {
  idx: number;
  sectorRoots: [string, string, string, string, string];
  core: string;
}

/**
 * Helper to normalize numbers to bigints recursively so that canonicalJson
 * does not throw TypeError on numeric state fields (step, stage, idx, insolvent_steps).
 */
function normalizeNumeric(val: unknown): unknown {
  if (val === null || val === undefined) {
    return val;
  }
  if (typeof val === "number") {
    return BigInt(val);
  }
  if (typeof val === "bigint" || typeof val === "string" || typeof val === "boolean") {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(normalizeNumeric);
  }
  if (typeof val === "object") {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      res[k] = normalizeNumeric(v);
    }
    return res;
  }
  return val;
}

function toRawDigest(digest: string | Uint8Array): Uint8Array {
  if (typeof digest === "string") {
    return fromHex(digest);
  }
  return digest;
}

/**
 * Computes leaf hash of a Business per data-contract section 9.
 * Returns a 64-character lowercase hex string.
 */
export function businessLeaf(business: Business): string {
  const norm = {
    id: business.id,
    recipe: business.recipe,
    open: business.open,
    coin: business.coin,
    inventory: business.inventory,
    insolvent_steps: BigInt(business.insolvent_steps),
  };
  return toHex(leaf(norm));
}

/**
 * Computes sector Merkle root per data-contract section 9:
 * businesses_root = H(business_leaf...) in id order
 * sector_leaf = leaf({idx, kind, owner, arc_origin, rules, businesses_root})
 * Returns a 64-character lowercase hex string.
 */
export function sectorRoot(sector: SectorState): string {
  // Sort businesses by id in plain code-unit order. NOT localeCompare: that depends on the
  // machine locale/ICU and would make roots differ across hosts (data-contract section 1/9).
  const sortedBusinesses = [...sector.businesses].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const businessLeaves = sortedBusinesses.map((b) => fromHex(businessLeaf(b)));
  const businesses_root = toHex(node(...businessLeaves));

  const sectorLeafObj = {
    idx: BigInt(sector.idx),
    kind: sector.kind,
    owner: sector.owner,
    arc_origin: sector.arc_origin,
    rules: sector.rules,
    businesses_root,
  };
  return toHex(leaf(sectorLeafObj));
}

/**
 * Computes city core leaf hash per data-contract section 9:
 * city_core = leaf({city_id, arc_id, step, stage, citizens, market, treasury, totals})
 * Returns a 64-character lowercase hex string.
 */
export function cityCore(state: CityState): string {
  const coreObj = {
    city_id: state.city_id,
    arc_id: state.arc_id,
    step: BigInt(state.step),
    stage: BigInt(state.stage),
    citizens: {
      population: state.citizens.population,
      satisfaction_bps: state.citizens.satisfaction_bps,
      purse: state.citizens.purse,
    },
    market: {
      price: state.market.price,
      demand_ema: state.market.demand_ema,
    },
    treasury: state.treasury,
    totals: {
      items: state.totals.items,
      coin: state.totals.coin,
    },
  };
  return toHex(leaf(coreObj));
}

/**
 * Computes city Merkle root per data-contract section 9:
 * city_root = H(sector_root_0, ..., sector_root_5, city_core)
 * Returns a 64-character lowercase hex string.
 */
export function cityRoot(state: CityState): string {
  const sectorDigests = state.sectors.map((s) => fromHex(sectorRoot(s)));
  const coreDigest = fromHex(cityCore(state));
  return toHex(node(...sectorDigests, coreDigest));
}

/**
 * Computes event Merkle root per data-contract section 9:
 * event_root = H(leaf(event_0), ..., leaf(event_n))
 * Returns a 64-character lowercase hex string.
 */
export function eventRoot(events: unknown[]): string {
  if (events.length === 0) {
    return toHex(node());
  }
  const eventLeaves = events.map((e) => leaf(normalizeNumeric(e)));
  return toHex(node(...eventLeaves));
}

/**
 * Computes genesis previous state root per data-contract section 9:
 * prev_state_root at step 0 is leaf({"genesis": city_id, "seed": world_seed})
 * Returns a 64-character lowercase hex string.
 */
export function genesisPrevRoot(cityId: string, worldSeed: string): string {
  return toHex(leaf({ genesis: cityId, seed: worldSeed }));
}

/**
 * Computes next state root per data-contract section 9:
 * state_root(step) = H(prev_state_root, leaf({"step": step}), event_root, city_root)
 * Returns a 64-character lowercase hex string.
 */
export function nextStateRoot(
  prev: string | Uint8Array,
  step: number | bigint,
  eventRootHex: string | Uint8Array,
  cityRootHex: string | Uint8Array
): string {
  const prevDigest = toRawDigest(prev);
  const stepDigest = leaf({ step: BigInt(step) });
  const eventDigest = toRawDigest(eventRootHex);
  const cityDigest = toRawDigest(cityRootHex);
  return toHex(node(prevDigest, stepDigest, eventDigest, cityDigest));
}

/**
 * Produces a Merkle inclusion proof for a sector at index idx.
 * The proof consists of the other 5 sector roots in ascending order and city_core.
 */
export function sectorProof(state: CityState, idx: number): SectorProof {
  if (idx < 0 || idx > 5 || !Number.isInteger(idx)) {
    throw new RangeError(`Sector index must be an integer between 0 and 5, got ${idx}`);
  }

  const otherSectorRoots: string[] = [];
  for (let i = 0; i < 6; i++) {
    if (i !== idx) {
      otherSectorRoots.push(sectorRoot(state.sectors[i]));
    }
  }

  return {
    idx,
    sectorRoots: otherSectorRoots as [string, string, string, string, string],
    core: cityCore(state),
  };
}

/**
 * Verifies a sector proof against a claimed cityRoot.
 * The verifier requires only sectorRootHex, the proof, and the claimed cityRootHex.
 * Returns true if valid, false if invalid, tampered, or malformed.
 */
export function verifySectorProof(
  sectorRootHex: string,
  proof: SectorProof,
  cityRootHex: string
): boolean {
  if (typeof proof !== "object" || proof === null) {
    return false;
  }
  if (!Number.isInteger(proof.idx) || proof.idx < 0 || proof.idx > 5) {
    return false;
  }
  if (!Array.isArray(proof.sectorRoots) || proof.sectorRoots.length !== 5) {
    return false;
  }
  if (typeof proof.core !== "string" || proof.core.length !== 64) {
    return false;
  }
  if (typeof sectorRootHex !== "string" || sectorRootHex.length !== 64) {
    return false;
  }
  if (typeof cityRootHex !== "string" || cityRootHex.length !== 64) {
    return false;
  }

  try {
    const rawSectorDigests: Uint8Array[] = [];
    let otherIdx = 0;
    for (let i = 0; i < 6; i++) {
      if (i === proof.idx) {
        rawSectorDigests.push(fromHex(sectorRootHex));
      } else {
        rawSectorDigests.push(fromHex(proof.sectorRoots[otherIdx++]));
      }
    }
    const coreDigest = fromHex(proof.core);
    const recomputedCityRoot = toHex(node(...rawSectorDigests, coreDigest));
    return recomputedCityRoot === cityRootHex.toLowerCase();
  } catch {
    return false;
  }
}
