"use client";

import { useState, useRef, type KeyboardEvent } from "react";
import type { MapA11yItem } from "../lib/a11y/map-items.ts";

export interface HexA11yListProps {
  items: MapA11yItem[];
  onSelectSector: (sectorIdx: number) => void;
  onInspectSector?: (sectorIdx: number, triggerElement: HTMLElement) => void;
  className?: string;
}

/**
 * An accessible ordered DOM list of map objects (districts first, then bubbles).
 * Rendered inside a visually hidden container that becomes visible when focused.
 * Supports roving tabindex with ArrowUp/ArrowDown/Home/End, Enter/Space to select.
 */
export function HexA11yList({
  items,
  onSelectSector,
  onInspectSector,
  className = "",
}: HexA11yListProps) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Derive clamped focused index without setState in effect
  const safeFocusedIndex =
    items.length > 0 ? Math.max(0, Math.min(focusedIndex, items.length - 1)) : 0;

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (items.length === 0) return;

    let targetIndex = -1;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        targetIndex = (index + 1) % items.length;
        break;
      case "ArrowUp":
        e.preventDefault();
        targetIndex = (index - 1 + items.length) % items.length;
        break;
      case "Home":
        e.preventDefault();
        targetIndex = 0;
        break;
      case "End":
        e.preventDefault();
        targetIndex = items.length - 1;
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        onSelectSector(items[index].sectorIdx);
        onInspectSector?.(items[index].sectorIdx, e.currentTarget);
        return;
      default:
        return;
    }

    if (targetIndex >= 0 && targetIndex < items.length) {
      setFocusedIndex(targetIndex);
      itemRefs.current[targetIndex]?.focus();
    }
  };

  if (!items || items.length === 0) {
    return (
      <div className="sr-only">
        <p>No map landmarks available.</p>
      </div>
    );
  }

  return (
    <nav
      aria-label="Map landmarks and alerts"
      className={`sr-only focus-within:not-sr-only focus-within:fixed focus-within:top-4 focus-within:left-4 focus-within:z-50 focus-within:w-96 focus-within:max-h-[85vh] focus-within:overflow-y-auto focus-within:bg-atlas-surface focus-within:border-2 focus-within:border-atlas-gold focus-within:p-4 focus-within:rounded-sm focus-within:shadow-2xl ${className}`}
    >
      <div className="border-b border-atlas-line pb-2 mb-3">
        <h2 className="text-sm font-display font-semibold text-atlas-ink">
          Accessible City Map Landmarks
        </h2>
        <p className="text-[11px] font-mono text-atlas-ink-muted">
          Use ArrowUp/Down to navigate, Enter to inspect sector.
        </p>
      </div>

      <ol role="list" className="space-y-1.5">
        {items.map((item, index) => {
          const isFocused = index === safeFocusedIndex;
          const isDistrict = item.kind === "district";

          return (
            <li key={item.id}>
              <button
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                tabIndex={isFocused ? 0 : -1}
                aria-label={item.label}
                onKeyDown={(e) => handleKeyDown(e, index)}
                onClick={(e) => {
                  setFocusedIndex(index);
                  onSelectSector(item.sectorIdx);
                  onInspectSector?.(item.sectorIdx, e.currentTarget);
                }}
                className={`w-full text-left min-h-[44px] px-3 py-2 rounded-xs border transition-colors flex items-center justify-between gap-2 cursor-pointer atlas-focus ${
                  isFocused
                    ? "bg-atlas-surface-raised border-atlas-gold text-atlas-ink"
                    : "bg-atlas-canvas/60 border-atlas-line text-atlas-ink-muted hover:text-atlas-ink hover:border-atlas-line-strong"
                }`}
              >
                <span className="text-xs font-mono font-medium truncate flex-1">
                  {item.label}
                </span>

                <span
                  className={`text-[9px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded-xs shrink-0 border ${
                    isDistrict
                      ? "bg-atlas-gold/15 text-atlas-gold border-atlas-gold/40"
                      : "bg-atlas-ember/15 text-atlas-ember border-atlas-ember/40"
                  }`}
                  aria-hidden="true"
                >
                  {isDistrict ? "District" : "Alert"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
