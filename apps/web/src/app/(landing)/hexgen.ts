/** Deterministic hex-tile atlas: four regions on one continent, joined by land bridges. No randomness at render time. */
export const R = 21;
const SQ3 = Math.sqrt(3);
const W = 26;
const H = 17;

export type RegionId = "warrens" | "hold" | "vale" | "grove";
export type Kind =
  | "sea" | "basalt" | "lava" | "crater" | "rock"
  | "stone" | "ore" | "mount" | "plateau"
  | "grass" | "field" | "forest" | "pond"
  | "glade" | "wood" | "crystal" | "city";

export type Tile = { id: string; x: number; y: number; region: RegionId | "sea"; kind: Kind; v: number };

const hash = (a: number, b: number, s = 0) => {
  const t = Math.sin(a * 127.1 + b * 311.7 + s * 74.7) * 43758.5453;
  return t - Math.floor(t);
};
const smooth = (t: number) => t * t * (3 - 2 * t);
function vnoise(x: number, y: number, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smooth(x - xi), yf = smooth(y - yi);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}

const px = (c: number, r: number) => ({ x: R * SQ3 * (c + (r & 1 ? 0.5 : 0)), y: R * 1.5 * r });

export const CENTERS: Record<RegionId, { c: number; r: number }> = {
  warrens: { c: 5.5, r: 4 },
  hold: { c: 19.5, r: 3 },
  vale: { c: 7, r: 12 },
  grove: { c: 18.5, r: 12 },
};
const IDS = Object.keys(CENTERS) as RegionId[];
export const CITY_PX = Object.fromEntries(IDS.map((id) => [id, px(CENTERS[id].c, CENTERS[id].r)])) as Record<RegionId, { x: number; y: number }>;

const LINKS: [RegionId, RegionId][] = [["warrens", "hold"], ["warrens", "vale"], ["vale", "grove"], ["hold", "grove"]];

function segDist(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

const PICK: Record<RegionId, [number, Kind][]> = {
  warrens: [[0.3, "basalt"], [0.5, "rock"], [0.65, "crater"], [1, "lava"]],
  hold: [[0.28, "stone"], [0.5, "mount"], [0.68, "plateau"], [1, "ore"]],
  vale: [[0.34, "grass"], [0.58, "field"], [0.82, "forest"], [1, "pond"]],
  grove: [[0.32, "glade"], [0.66, "wood"], [0.82, "pond"], [1, "crystal"]],
};

function build(): Tile[] {
  const tiles: Tile[] = [];
  const best: Record<string, { d: number; i: number }> = {};
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const p = px(c, r);
      let near: RegionId = "warrens";
      let nd = Infinity;
      for (const id of IDS) {
        const d = Math.hypot(p.x - CITY_PX[id].x, p.y - CITY_PX[id].y);
        if (d < nd) { nd = d; near = id; }
      }
      const blob = (4.1 + 2.1 * vnoise(c * 0.32, r * 0.32, 5)) * R * SQ3;
      const bridge = LINKS.some(([a, b]) => segDist(p, CITY_PX[a], CITY_PX[b]) < R * 1.35);
      const land = nd < blob || bridge;
      const id = `${c}-${r}`;
      if (!land) {
        tiles.push({ id, ...p, region: "sea", kind: "sea", v: hash(c, r, 1) });
        continue;
      }
      const n = vnoise(c * 0.5, r * 0.5, IDS.indexOf(near) + 9) * 0.7 + hash(c, r, 3) * 0.3;
      const kind = PICK[near].find(([lim]) => n <= lim)![1];
      tiles.push({ id, ...p, region: near, kind, v: hash(c, r, 2) });
      if (!best[near] || nd < best[near].d) best[near] = { d: nd, i: tiles.length - 1 };
    }
  }
  for (const id of IDS) tiles[best[id].i] = { ...tiles[best[id].i], kind: "city" };
  return tiles;
}

export const TILES = build();
export const VIEW = { x: -R * SQ3, y: -R * 1.4, w: W * R * SQ3 + R * SQ3, h: H * R * 1.5 + R * 1.6 };

export function hexPoints(x: number, y: number, r = R - 1): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

function mix(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

const FILL: Record<string, string> = {
  basalt: "#3a2f35", rock: "#54464a", crater: "#2c2429", lava: "#6e2a1b",
  stone: "#7b7468", mount: "#8d8678", plateau: "#a88f5c", ore: "#8a7350",
  grass: "#5f9a46", field: "#c2b25a", forest: "#3f7a3a", pond: "#3d8fb0",
  glade: "#6a58b0", wood: "#4a3a8c", crystal: "#7c62c8",
  sea: "#0e1a2b",
};
const CITY_FILL: Record<RegionId, string> = { warrens: "#6b4a42", hold: "#9c8456", vale: "#7bb260", grove: "#8b76d0" };

export function tileColors(t: Tile): { top: string; side: string } {
  const base = t.kind === "city" ? CITY_FILL[t.region as RegionId] : FILL[t.kind] ?? "#444";
  const amt = (t.v - 0.5) * 0.14;
  return { top: mix(base, amt), side: mix(base, -0.45) };
}

export const ROUTES: { from: RegionId; to: RegionId; cargo: string; bend: number }[] = [
  { from: "vale", to: "grove", cargo: "bread", bend: 30 },
  { from: "hold", to: "warrens", cargo: "ore", bend: -34 },
  { from: "warrens", to: "vale", cargo: "tools", bend: 34 },
  { from: "grove", to: "hold", cargo: "potions", bend: -30 },
];

export function routePath(from: RegionId, to: RegionId, bend: number): string {
  const a = CITY_PX[from], b = CITY_PX[to];
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const cx = mx + (-dy / len) * bend * 3;
  const cy = my + (dx / len) * bend * 3;
  return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
}
