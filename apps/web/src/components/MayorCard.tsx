"use client";

import { useState } from "react";
import {
  getMayorByArc,
  getMayorDecree,
  type MayorPortraitSpec,
} from "../data/mayors.ts";

interface MayorCardProps {
  arcId: string;
  cityYear: number;
}

function ProceduralPortrait({
  spec,
  name,
}: {
  spec: MayorPortraitSpec;
  name: string;
}) {
  const { palette, archetype, features } = spec;

  return (
    <svg
      role="img"
      aria-label={`Stylized procedural portrait of ${name}`}
      viewBox="0 0 100 100"
      className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-atlas-gold/60 bg-atlas-surface shrink-0 shadow-inner"
    >
      <rect width="100" height="100" fill={palette.background} />

      {/* Archetype specific background flair */}
      <circle cx="50" cy="50" r="42" fill="none" stroke={palette.outline} strokeWidth="2" strokeDasharray="4 2" />

      {/* Goblin: pointed long ears */}
      {archetype === "goblin" && (
        <>
          <polygon points="20,45 2,35 18,58" fill={palette.skin} stroke={palette.outline} strokeWidth="1.5" />
          <polygon points="80,45 98,35 82,58" fill={palette.skin} stroke={palette.outline} strokeWidth="1.5" />
        </>
      )}

      {/* Elf: slender high ears */}
      {archetype === "elf" && (
        <>
          <polygon points="24,48 10,22 28,38" fill={palette.skin} stroke={palette.outline} strokeWidth="1.5" />
          <polygon points="76,48 90,22 72,38" fill={palette.skin} stroke={palette.outline} strokeWidth="1.5" />
        </>
      )}

      {/* Head shape */}
      <ellipse
        cx="50"
        cy={archetype === "dino" ? "52" : "50"}
        rx={archetype === "dino" ? "30" : "26"}
        ry={archetype === "dino" ? "24" : "28"}
        fill={palette.skin}
        stroke={palette.outline}
        strokeWidth="2"
      />

      {/* Dino snout extension & scales */}
      {archetype === "dino" && (
        <>
          <path d="M 40 45 Q 50 40 64 48 L 62 60 Q 50 64 38 58 Z" fill={palette.skin} opacity="0.9" />
          <polygon points="46,54 50,58 54,54" fill="#ffffff" />
          <polygon points="56,54 60,58 64,54" fill="#ffffff" />
        </>
      )}

      {/* Eyes */}
      <circle cx="41" cy="45" r="4" fill={palette.eyes} stroke={palette.outline} strokeWidth="1" />
      <circle cx="41" cy="45" r="1.5" fill="#12100e" />
      <circle cx="59" cy="45" r="4" fill={palette.eyes} stroke={palette.outline} strokeWidth="1" />
      <circle cx="59" cy="45" r="1.5" fill="#12100e" />

      {/* Monocle for goblin */}
      {features.hasMonocle && (
        <>
          <circle cx="41" cy="45" r="6" fill="none" stroke="#d4a24e" strokeWidth="1.5" />
          <line x1="47" y1="45" x2="52" y2="58" stroke="#d4a24e" strokeWidth="1" />
        </>
      )}

      {/* Eyebrows */}
      <line
        x1="36"
        y1={40 + features.eyebrowTilt / 5}
        x2="46"
        y2={40 - features.eyebrowTilt / 5}
        stroke={palette.outline}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="54"
        y1={40 - features.eyebrowTilt / 5}
        x2="64"
        y2={40 + features.eyebrowTilt / 5}
        stroke={palette.outline}
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Mouth styles */}
      {features.mouthStyle === "wide_smirk" && (
        <path d="M 40 62 Q 50 70 64 60" fill="none" stroke={palette.outline} strokeWidth="2.5" strokeLinecap="round" />
      )}
      {features.mouthStyle === "serene_smile" && (
        <path d="M 42 62 Q 50 67 58 62" fill="none" stroke={palette.outline} strokeWidth="2" strokeLinecap="round" />
      )}
      {features.mouthStyle === "toothy_grin" && (
        <path d="M 38 60 Q 50 72 64 60" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
      )}
      {features.mouthStyle === "bushy_beard" && (
        <path
          d="M 30 52 C 25 76, 40 92, 50 92 C 60 92, 75 76, 70 52 C 65 64, 35 64, 30 52 Z"
          fill="#d4a24e"
          stroke={palette.outline}
          strokeWidth="1.5"
        />
      )}

      {/* Dwarf Helmet */}
      {features.hasHelmet && (
        <>
          <path d="M 28 36 Q 50 16 72 36 L 74 42 L 26 42 Z" fill="#7f8c8d" stroke={palette.outline} strokeWidth="2" />
          <polygon points="26,38 18,22 28,30" fill="#bdc3c7" stroke={palette.outline} strokeWidth="1" />
          <polygon points="74,38 82,22 72,30" fill="#bdc3c7" stroke={palette.outline} strokeWidth="1" />
        </>
      )}

      {/* Elf Crown */}
      {features.hasCrown && (
        <path d="M 30 32 L 38 20 L 50 28 L 62 20 L 70 32 Z" fill="#d4a24e" stroke={palette.outline} strokeWidth="1.5" />
      )}
    </svg>
  );
}

export function MayorCard({ arcId, cityYear }: MayorCardProps) {
  const [showCatchphrases, setShowCatchphrases] = useState<boolean>(false);
  const mayor = getMayorByArc(arcId);
  const decree = getMayorDecree(mayor, cityYear);

  return (
    <section
      aria-label={`Meme Mayor: ${mayor.name}`}
      className="atlas-panel rounded-sm p-4 sm:p-5 border border-atlas-line/80 bg-atlas-surface/90 flex flex-col gap-3.5 shadow-sm"
    >
      {/* Header: Title badge and Cosmetic Disclaimer */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-atlas-line/60 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden="true">🎖️</span>
          <h2 className="text-sm font-display font-bold text-atlas-ink tracking-wide">
            Civic Figurehead (Parody)
          </h2>
        </div>
        <span className="text-[10px] font-mono text-atlas-ash italic">
          Cosmetic: the mayor does not change the verified economy
        </span>
      </div>

      {/* Profile: Procedural Portrait + Name + Charisma */}
      <div className="flex items-start gap-3.5">
        <ProceduralPortrait spec={mayor.portraitSpec} name={mayor.name} />

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-baseline gap-1.5">
            <h3 className="font-display font-bold text-base sm:text-lg text-atlas-gold truncate">
              {mayor.name}
            </h3>
          </div>
          <p className="font-mono text-xs text-atlas-ink font-semibold">
            {mayor.title}
          </p>
          <p className="text-xs text-atlas-ink-muted italic leading-snug">
            &ldquo;{mayor.tagline}&rdquo;
          </p>

          {/* Charisma Meter (Text + Progress Bar for accessibility) */}
          <div className="pt-1 space-y-1">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-atlas-ink-muted font-medium">✨ Charisma Rating:</span>
              <strong className="text-atlas-gold">{mayor.charisma} / 100</strong>
            </div>
            <div
              role="progressbar"
              aria-valuenow={mayor.charisma}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Charisma level: ${mayor.charisma} out of 100`}
              className="w-full h-2 rounded-xs bg-atlas-surface-raised border border-atlas-line overflow-hidden"
            >
              <div
                className="h-full bg-atlas-gold transition-all duration-300"
                style={{ width: `${mayor.charisma}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Rotating Deterministic Decree from City Year */}
      <div className="bg-atlas-surface-raised rounded-xs p-3 border border-atlas-line flex flex-col gap-1 text-xs">
        <div className="flex items-center justify-between font-mono text-[11px] text-atlas-ink-muted">
          <span>📜 Annual Proclamation (Year {Math.floor(cityYear)}):</span>
          <span className="text-[10px] text-atlas-ash font-mono">Deterministic Rotation</span>
        </div>
        <p className="text-atlas-ink font-sans font-medium text-xs leading-relaxed italic bg-atlas-canvas/60 p-2 rounded-xs border border-atlas-line/40">
          &ldquo;{decree}&rdquo;
        </p>
      </div>

      {/* Catchphrases Drawer Toggle */}
      <div className="pt-1 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setShowCatchphrases((prev) => !prev)}
          aria-expanded={showCatchphrases}
          aria-controls={`catchphrases-${mayor.id}`}
          className="atlas-focus text-xs font-mono font-semibold text-atlas-ink-muted hover:text-atlas-gold py-1.5 px-2 rounded-xs bg-atlas-surface border border-atlas-line transition-colors flex items-center justify-between cursor-pointer min-h-[44px] sm:min-h-[32px]"
        >
          <span>💬 Campaign Catchphrases</span>
          <span>{showCatchphrases ? "▲ Hide" : "▼ Show"}</span>
        </button>

        {showCatchphrases && (
          <ul
            id={`catchphrases-${mayor.id}`}
            role="list"
            className="space-y-1.5 text-xs text-atlas-ink-muted font-sans pl-2 border-l-2 border-atlas-gold/60"
          >
            {mayor.catchphrases.map((phrase, idx) => (
              <li key={idx} className="leading-snug">
                • &ldquo;{phrase}&rdquo;
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
