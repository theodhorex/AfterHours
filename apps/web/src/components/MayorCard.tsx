"use client";

import { useState } from "react";
import {
  getMayorByArc,
  getMayorDecree,
  type MayorPortraitSpec,
} from "../data/mayors.ts";
import { LedgerPage } from "./ui/LedgerPage.tsx";
import { Icon } from "./ui/Icons.tsx";

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
      className="w-20 h-20 sm:w-24 sm:h-24 border-2 border-ledger-brass bg-ledger-paper-shade/30 shrink-0"
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
          <circle cx="41" cy="45" r="6" fill="none" stroke="#b88a2e" strokeWidth="1.5" />
          <line x1="47" y1="45" x2="52" y2="58" stroke="#b88a2e" strokeWidth="1" />
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
          fill="#b88a2e"
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
        <path d="M 30 32 L 38 20 L 50 28 L 62 20 L 70 32 Z" fill="#b88a2e" stroke={palette.outline} strokeWidth="1.5" />
      )}
    </svg>
  );
}

export function MayorCard({ arcId, cityYear }: MayorCardProps) {
  const [showCatchphrases, setShowCatchphrases] = useState<boolean>(false);
  const mayor = getMayorByArc(arcId);
  const decree = getMayorDecree(mayor, cityYear);

  return (
    <LedgerPage
      title="Civic Figurehead & Proclamations"
      headingLevel="h2"
      headerRight={
        <span className="font-mono text-xs text-ledger-ink-faded italic">
          Cosmetic figurehead (unverified by chain)
        </span>
      }
    >
      <div className="space-y-6">
        {/* Profile Card: Framed Portrait + Name + Charisma */}
        <div className="p-4 sm:p-5 border border-ledger-ink-faded/30 bg-ledger-paper-shade/20 flex flex-col sm:flex-row items-start gap-5">
          <ProceduralPortrait spec={mayor.portraitSpec} name={mayor.name} />

          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <h3 className="font-pixel text-lg sm:text-xl text-ledger-ink font-bold">
                {mayor.name}
              </h3>
              <p className="font-body text-sm font-semibold text-ledger-ink">
                {mayor.title}
              </p>
              <p className="font-body text-xs text-ledger-ink-faded italic mt-0.5">
                &ldquo;{mayor.tagline}&rdquo;
              </p>
            </div>

            {/* Charisma Meter (Text + Progress Bar) */}
            <div className="pt-1 space-y-1 max-w-xs">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-ledger-ink-faded">Charisma Rating:</span>
                <strong className="text-ledger-ink tabular-nums">{mayor.charisma} / 100</strong>
              </div>
              <div
                role="progressbar"
                aria-valuenow={mayor.charisma}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Charisma level: ${mayor.charisma} out of 100`}
                className="w-full h-2 bg-ledger-paper-shade/60 border border-ledger-ink-faded/30 overflow-hidden"
              >
                <div
                  className="h-full bg-ledger-brass transition-all duration-300"
                  style={{ width: `${mayor.charisma}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Decree as a Notarized Letter */}
        <div className="p-5 sm:p-6 border border-ledger-ink-faded/30 bg-ledger-paper space-y-4 shadow-[inset_0_0_12px_rgba(107,86,64,0.06)]">
          <div className="flex items-center justify-between border-b border-ledger-ink-faded/20 pb-2.5 font-mono text-xs text-ledger-ink-faded">
            <span className="font-silk uppercase tracking-wider text-[11px] text-ledger-ink font-bold flex items-center gap-1.5">
              <Icon name="scroll" size={14} aria-hidden="true" />
              <span>Official Mayoral Proclamation (Year {Math.floor(cityYear)})</span>
            </span>
            <span className="text-[10px] tabular-nums">Deterministic Rotation</span>
          </div>

          <blockquote className="font-body text-base sm:text-lg text-ledger-ink italic leading-relaxed pl-3 border-l-2 border-ledger-brass">
            &ldquo;{decree}&rdquo;
          </blockquote>

          {/* Signature Line */}
          <div className="pt-4 border-t border-ledger-ink-faded/20 flex flex-col items-end">
            <div className="font-pixel text-xs text-ledger-ink font-bold tracking-wider">
              {mayor.name}
            </div>
            <div className="font-body text-xs text-ledger-ink-faded italic">
              {mayor.title}, City of {mayor.name.split(" ")[0]}
            </div>
          </div>
        </div>

        {/* Catchphrases Drawer Toggle */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowCatchphrases((prev) => !prev)}
            aria-expanded={showCatchphrases}
            aria-controls={`catchphrases-${mayor.id}`}
            className="min-h-[44px] w-full text-xs font-pixel text-ledger-ink py-2 px-3 border border-ledger-ink-faded/30 bg-ledger-paper-shade/30 hover:bg-ledger-paper-shade/60 transition-colors flex items-center justify-between cursor-pointer focus-visible:outline-2 focus-visible:outline-ledger-brass"
          >
            <span className="flex items-center gap-2">
              <Icon name="quill" size={14} aria-hidden="true" />
              <span>Campaign Catchphrases ({mayor.catchphrases.length})</span>
            </span>
            <span className="font-mono text-xs">{showCatchphrases ? "[-]" : "[+]"}</span>
          </button>

          {showCatchphrases && (
            <ul
              id={`catchphrases-${mayor.id}`}
              role="list"
              className="space-y-2 p-3 border border-ledger-ink-faded/20 bg-ledger-paper-shade/10 font-body text-xs sm:text-sm text-ledger-ink italic"
            >
              {mayor.catchphrases.map((phrase, idx) => (
                <li key={idx} className="leading-snug">
                  &bull; &ldquo;{phrase}&rdquo;
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </LedgerPage>
  );
}

export default MayorCard;
