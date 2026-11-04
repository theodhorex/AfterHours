"use client";

import type { Sector } from "../data/mock-city.ts";

interface AtlasMapProps {
  sectors: Sector[];
  selectedIdx: number;
  onSelectSector: (idx: number) => void;
}

interface DistrictConfig {
  path: string;
  labelX: number;
  labelY: number;
  iconX: number;
  iconY: number;
  glyph: string;
  bizCoords: Array<{ x: number; y: number }>;
}

const DISTRICT_CONFIGS: Record<number, DistrictConfig> = {
  // 0: Mushroom Farms (Top-Left)
  0: {
    path: "M 40 40 L 320 40 L 320 220 L 260 270 L 40 270 Z",
    labelX: 180,
    labelY: 130,
    iconX: 180,
    iconY: 90,
    glyph: "🍄",
    bizCoords: [
      { x: 100, y: 195 },
      { x: 180, y: 195 },
      { x: 260, y: 195 },
    ],
  },
  // 1: Deep Mines (Bottom-Left)
  1: {
    path: "M 40 290 L 260 290 L 330 350 L 330 520 L 40 520 Z",
    labelX: 180,
    labelY: 395,
    iconX: 180,
    iconY: 355,
    glyph: "⛏️",
    bizCoords: [
      { x: 130, y: 460 },
      { x: 230, y: 460 },
    ],
  },
  // 2: Scrap Forges (Center)
  2: {
    path: "M 340 200 L 530 200 L 530 390 L 350 390 L 280 330 Z",
    labelX: 430,
    labelY: 285,
    iconX: 430,
    iconY: 245,
    glyph: "🔥",
    bizCoords: [
      { x: 375, y: 345 },
      { x: 435, y: 345 },
      { x: 495, y: 345 },
    ],
  },
  // 3: Bubbling Vats (Top-Center)
  3: {
    path: "M 340 40 L 530 40 L 530 180 L 340 180 Z",
    labelX: 435,
    labelY: 105,
    iconX: 435,
    iconY: 70,
    glyph: "🧪",
    bizCoords: [
      { x: 395, y: 145 },
      { x: 475, y: 145 },
    ],
  },
  // 4: Sump Docks (Bottom-Right)
  4: {
    path: "M 550 280 L 820 280 L 820 520 L 350 520 L 350 410 L 550 410 Z",
    labelX: 685,
    labelY: 385,
    iconX: 685,
    iconY: 345,
    glyph: "⚓",
    bizCoords: [
      { x: 625, y: 455 },
      { x: 745, y: 455 },
    ],
  },
  // 5: Shaman Towers (Top-Right)
  5: {
    path: "M 550 40 L 820 40 L 820 260 L 550 260 Z",
    labelX: 685,
    labelY: 135,
    iconX: 685,
    iconY: 95,
    glyph: "🔮",
    bizCoords: [
      { x: 630, y: 200 },
      { x: 740, y: 200 },
    ],
  },
};

export function AtlasMap({ sectors, selectedIdx, onSelectSector }: AtlasMapProps) {
  return (
    <div className="atlas-panel rounded-sm p-3 sm:p-5 relative overflow-hidden">
      {/* Map Header & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-base sm:text-lg font-display font-semibold text-atlas-ink flex items-center gap-2">
            <span>Subterranean Atlas</span>
            <span className="text-xs font-mono font-normal text-atlas-ink-muted">
              [-240 Fathoms]
            </span>
          </h2>
          <p className="text-xs text-atlas-ink-muted">
            Interactive territory chart. Select a district to inspect businesses and stalls.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs font-mono text-atlas-ink-muted bg-atlas-canvas/60 px-2.5 py-1 rounded border border-atlas-line">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-atlas-ember border border-atlas-gold" />
            <span>Open Stall</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-atlas-alert/40 border border-atlas-alert flex items-center justify-center text-[8px] text-atlas-alert font-bold">
              ✕
            </span>
            <span>Closed / Insolvent</span>
          </span>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="w-full relative aspect-[860/560] max-h-[560px]">
        <svg
          viewBox="0 0 860 560"
          className="w-full h-full select-none"
          role="region"
          aria-label="Goblin Warrens district map"
        >
          <defs>
            {/* Pattern for cavern bedrock */}
            <pattern id="cavern-hatch" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 0 20 L 20 0 M 0 0 L 20 20" stroke="#3d3429" strokeWidth="0.5" strokeOpacity="0.4" />
            </pattern>

            {/* Radial vignette mask */}
            <radialGradient id="vignette" cx="50%" cy="50%" r="65%">
              <stop offset="60%" stopColor="#1f1b16" stopOpacity="0" />
              <stop offset="100%" stopColor="#12100e" stopOpacity="0.8" />
            </radialGradient>
          </defs>

          {/* Map canvas background */}
          <rect x="0" y="0" width="860" height="560" fill="#15120f" stroke="#3d3429" strokeWidth="2" rx="4" />
          <rect x="10" y="10" width="840" height="540" fill="url(#cavern-hatch)" rx="2" />
          <rect x="0" y="0" width="860" height="560" fill="url(#vignette)" pointerEvents="none" />

          {/* Grid lines and coordinate markers */}
          <g stroke="#3d3429" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.6">
            <line x1="330" y1="20" x2="330" y2="540" />
            <line x1="540" y1="20" x2="540" y2="540" />
            <line x1="20" y1="190" x2="840" y2="190" />
            <line x1="20" y1="400" x2="840" y2="400" />
          </g>

          {/* Districts */}
          {sectors.map((sector) => {
            const config = DISTRICT_CONFIGS[sector.idx];
            if (!config) return null;
            const isSelected = sector.idx === selectedIdx;

            return (
              <g
                key={sector.idx}
                tabIndex={0}
                role="button"
                aria-label={`${sector.name} district, ${sector.businesses.length} businesses. ${isSelected ? "Currently selected." : "Click to inspect."}`}
                aria-pressed={isSelected}
                onClick={() => onSelectSector(sector.idx)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectSector(sector.idx);
                  }
                }}
                className="cursor-pointer group atlas-focus transition-all duration-200"
              >
                {/* District boundary polygon */}
                <path
                  d={config.path}
                  fill={isSelected ? "#2d2419" : "#1a1612"}
                  stroke={isSelected ? "#e5b358" : "#5a4c3b"}
                  strokeWidth={isSelected ? 3 : 1.5}
                  strokeLinejoin="round"
                  className="transition-colors duration-200 group-hover:fill-[#251e16] group-hover:stroke-atlas-gold/80"
                />

                {/* District icon glyph */}
                <text
                  x={config.iconX}
                  y={config.iconY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-xl select-none opacity-85 group-hover:opacity-100"
                >
                  {config.glyph}
                </text>

                {/* District title label */}
                <text
                  x={config.labelX}
                  y={config.labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={isSelected ? "#f0e6d2" : "#bda88e"}
                  className="font-display text-sm font-semibold tracking-wider select-none group-hover:fill-atlas-ink"
                >
                  {sector.name}
                </text>

                {/* Sector kind badge in SVG */}
                <text
                  x={config.labelX}
                  y={config.labelY + 18}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#827768"
                  className="font-mono text-[10px] uppercase tracking-widest select-none"
                >
                  Sector {sector.idx} • {sector.kind}
                </text>

                {/* Business markers inside district */}
                {sector.businesses.map((biz, bIdx) => {
                  const pt = config.bizCoords[bIdx] ?? { x: config.labelX, y: config.labelY + 40 };
                  const isOpen = biz.open && biz.insolvent_steps === 0;

                  return (
                    <g key={biz.id} transform={`translate(${pt.x}, ${pt.y})`}>
                      {isOpen ? (
                        <>
                          {/* Open business indicator: glowing ember node */}
                          <circle r="7" fill="#f07f4f" fillOpacity="0.3" />
                          <circle r="4" fill="#e5b358" stroke="#12100e" strokeWidth="1" />
                          <circle r="1.5" fill="#ffffff" />
                        </>
                      ) : (
                        <>
                          {/* Closed business indicator: crossed out warning node */}
                          <circle r="7" fill="#f26868" fillOpacity="0.2" stroke="#f26868" strokeWidth="1" strokeDasharray="2 2" />
                          <circle r="4" fill="#2b241d" stroke="#f26868" strokeWidth="1" />
                          <line x1="-2.5" y1="-2.5" x2="2.5" y2="2.5" stroke="#f26868" strokeWidth="1.2" />
                          <line x1="2.5" y1="-2.5" x2="-2.5" y2="2.5" stroke="#f26868" strokeWidth="1.2" />
                        </>
                      )}
                      {/* Name label beneath dot */}
                      <text
                        x="0"
                        y="14"
                        textAnchor="middle"
                        fill={isOpen ? "#bda88e" : "#f26868"}
                        className="font-mono text-[9px] select-none opacity-90"
                      >
                        {biz.name.split(" ")[0]}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Compass rose & scale bar */}
          <g transform="translate(80, 80)" opacity="0.65" pointerEvents="none">
            <circle r="22" fill="none" stroke="#5a4c3b" strokeWidth="0.75" />
            <path d="M 0 -20 L 4 -4 L 20 0 L 4 4 L 0 20 L -4 4 L -20 0 L -4 -4 Z" fill="#3d3429" stroke="#5a4c3b" strokeWidth="0.5" />
            <text x="0" y="-24" textAnchor="middle" fill="#e5b358" className="font-display text-[9px] font-bold">N</text>
          </g>

          <g transform="translate(740, 530)" opacity="0.7" pointerEvents="none">
            <line x1="0" y1="0" x2="60" y2="0" stroke="#5a4c3b" strokeWidth="1.5" />
            <line x1="0" y1="-3" x2="0" y2="3" stroke="#5a4c3b" strokeWidth="1" />
            <line x1="60" y1="-3" x2="60" y2="3" stroke="#5a4c3b" strokeWidth="1" />
            <text x="30" y="-5" textAnchor="middle" fill="#827768" className="font-mono text-[9px]">100 Paces</text>
          </g>
        </svg>
      </div>
    </div>
  );
}
