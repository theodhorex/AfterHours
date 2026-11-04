export interface BuildingLayout {
  id: string;
  name: string;
  recipe: string;
  sectorIdx: number;
  tileX: number;
  tileY: number;
  level: number;
  ruined: boolean;
  open: boolean;
  isLandmark?: boolean;
  facing?: "N" | "E" | "S" | "W";
}

export interface HouseLayout {
  id: string;
  tileX: number;
  tileY: number;
  level: number;
  districtIdx?: number;
  facing?: "N" | "E" | "S" | "W";
}

export interface RoadTile {
  x: number;
  y: number;
  isBridge: boolean;
  kind?: "main" | "branch" | "lane" | "path" | "bridge";
  isSidewalk?: boolean;
  hasCrosswalk?: boolean;
  hasLamp?: boolean;
  isJunction?: boolean;
}

export interface SidewalkTile {
  x: number;
  y: number;
  roadX?: number;
  roadY?: number;
}

export interface SupportingBuilding {
  id: string;
  sectorIdx: number;
  kind: string;
  tileX: number;
  tileY: number;
  facing?: "N" | "E" | "S" | "W";
}

export interface MarketStall {
  id: string;
  itemId: string;
  tileX: number;
  tileY: number;
}

export interface RuralFeature {
  id: string;
  kind: "farmland" | "orchard" | "fence" | "well" | "pond";
  tileX: number;
  tileY: number;
}

export interface PropLayout {
  id: string;
  kind: string;
  tileX: number;
  tileY: number;
}

export interface BlockLayout {
  id: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  sectorIdx?: number;
}

export interface SectorZone {
  idx: number;
  kind: string;
  name: string;
  centerX: number;
  centerY: number;
  tiles: Array<{ x: number; y: number }>;
}

export interface CityLayout {
  sectors: SectorZone[];
  buildings: BuildingLayout[];
  houses: HouseLayout[];
  roads: RoadTile[];
  plaza: { x: number; y: number };
  supportingBuildings: SupportingBuilding[];
  marketStalls: MarketStall[];
  ruralFeatures: RuralFeature[];
  sidewalks?: SidewalkTile[];
  props?: PropLayout[];
  blocks?: BlockLayout[];
}
