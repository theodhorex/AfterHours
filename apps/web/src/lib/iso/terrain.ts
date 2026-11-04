/**
 * Deterministic procedural terrain generator for AfterHours isometric world.
 * Generates 48x48 tile grids with meandering rivers, forests, rocks, and sand banks.
 * Flavor ratios adjust dynamically per arc.
 */

import { createRng } from "./rng.ts";

export type TileKind = "grass" | "water" | "forest" | "rock" | "sand";

export interface RiverPoint {
  x: number;
  y: number;
}

export interface TerrainMap {
  size: number;
  tiles: TileKind[][];
  riverPath: RiverPoint[];
  arcId: string;
}

interface ArcTerrainProfile {
  rockClusterCount: number;
  forestClusterCount: number;
  clusterRadiusMin: number;
  clusterRadiusMax: number;
  sandMargin: number;
  riverExtraWidth: number;
}

const ARC_PROFILES: Record<string, ArcTerrainProfile> = {
  goblin_warrens: {
    rockClusterCount: 16,
    forestClusterCount: 6,
    clusterRadiusMin: 2,
    clusterRadiusMax: 4,
    sandMargin: 1,
    riverExtraWidth: 0,
  },
  cave_hold: {
    rockClusterCount: 18,
    forestClusterCount: 5,
    clusterRadiusMin: 2,
    clusterRadiusMax: 4,
    sandMargin: 1,
    riverExtraWidth: 0,
  },
  dino_vale: {
    rockClusterCount: 7,
    forestClusterCount: 10,
    clusterRadiusMin: 2,
    clusterRadiusMax: 5,
    sandMargin: 2,
    riverExtraWidth: 1,
  },
  elf_grove: {
    rockClusterCount: 5,
    forestClusterCount: 22,
    clusterRadiusMin: 3,
    clusterRadiusMax: 5,
    sandMargin: 1,
    riverExtraWidth: 0,
  },
};

/**
 * Procedurally generates terrain map of specified size (default 48).
 */
export function generateTerrain(
  seedString: string,
  arcId: string,
  size = 48
): TerrainMap {
  const rng = createRng(`${seedString}_terrain_${arcId}`);
  const profile = ARC_PROFILES[arcId] ?? ARC_PROFILES.goblin_warrens;

  // Initialize all tiles as grass
  const tiles: TileKind[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => "grass" as TileKind)
  );

  // 1. Generate meandering river crossing from west to east
  const riverPath: RiverPoint[] = [];
  const riverTileSet = new Set<string>();

  // Start river at roughly 1/3 or 2/3 down the map, avoiding direct dead-center
  let currentY = rng.nextInt(size / 4, (size * 3) / 4);
  const riverWidth = 2 + profile.riverExtraWidth;

  for (let x = 0; x < size; x++) {
    // Add wander: move y up/down occasionally
    const wanderRoll = rng.nextInt(0, 100);
    if (wanderRoll < 28 && currentY > 4) {
      currentY -= 1;
    } else if (wanderRoll > 72 && currentY < size - 6) {
      currentY += 1;
    }

    for (let w = 0; w < riverWidth; w++) {
      const ry = currentY + w;
      if (ry >= 0 && ry < size) {
        tiles[ry][x] = "water";
        riverPath.push({ x, y: ry });
        riverTileSet.add(`${x},${ry}`);
      }
    }
  }

  // 2. Add sand banks along river
  if (profile.sandMargin > 0) {
    for (const pt of riverPath) {
      for (let dy = -profile.sandMargin; dy <= profile.sandMargin; dy++) {
        for (let dx = -profile.sandMargin; dx <= profile.sandMargin; dx++) {
          const nx = pt.x + dx;
          const ny = pt.y + dy;
          if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
            if (tiles[ny][nx] !== "water" && rng.chance(70)) {
              tiles[ny][nx] = "sand";
            }
          }
        }
      }
    }
  }

  // Helper to carve circular/organic clusters
  function addCluster(
    clusterType: "rock" | "forest" | "water",
    centerX: number,
    centerY: number,
    radius: number
  ) {
    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = centerX + dx;
        const ny = centerY + dy;
        if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
          // Keep center plaza (size/2 +- 5) clear of huge rock/water blocks
          const distToPlaza = Math.max(Math.abs(nx - size / 2), Math.abs(ny - size / 2));
          if (distToPlaza <= 4 && clusterType !== "forest") {
            continue;
          }

          if (dx * dx + dy * dy <= r2) {
            if (tiles[ny][nx] !== "water") {
              if (rng.chance(85)) {
                tiles[ny][nx] = clusterType;
              }
            }
          }
        }
      }
    }
  }

  // 3. Rock clusters
  for (let i = 0; i < profile.rockClusterCount; i++) {
    const rx = rng.nextInt(2, size - 3);
    const ry = rng.nextInt(2, size - 3);
    const radius = rng.nextInt(profile.clusterRadiusMin, profile.clusterRadiusMax);
    addCluster("rock", rx, ry, radius);
  }

  // 4. Forest clusters
  for (let i = 0; i < profile.forestClusterCount; i++) {
    const fx = rng.nextInt(2, size - 3);
    const fy = rng.nextInt(2, size - 3);
    const radius = rng.nextInt(profile.clusterRadiusMin, profile.clusterRadiusMax);
    addCluster("forest", fx, fy, radius);
  }

  // 5. Special swamp water pools for dino_vale
  if (arcId === "dino_vale") {
    for (let i = 0; i < 4; i++) {
      const px = rng.nextInt(4, size - 5);
      const py = rng.nextInt(4, size - 5);
      addCluster("water", px, py, 2);
    }
  }

  return {
    size,
    tiles,
    riverPath,
    arcId,
  };
}
