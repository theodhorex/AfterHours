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
}

export interface HouseLayout {
  id: string;
  tileX: number;
  tileY: number;
  level: number;
  districtIdx?: number;
}

export interface RoadTile {
  x: number;
  y: number;
  isBridge: boolean;
}

export interface SupportingBuilding {
  id: string;
  sectorIdx: number;
  kind: string;
  tileX: number;
  tileY: number;
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
}
