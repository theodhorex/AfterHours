"use client";

import { useMemo } from "react";
import { generateSparklinePoints, describeSparklineTrend } from "../../lib/iso/sparkline.ts";

export interface TrendSparklineProps {
  values: number[];
  unit?: string;
  className?: string;
  width?: number;
  height?: number;
}

export function TrendSparkline({
  values,
  unit = "coin",
  className = "",
  width = 120,
  height = 28,
}: TrendSparklineProps) {
  const { points, first, last, min, max, direction } = useMemo(
    () => generateSparklinePoints(values, { width, height, padding: 3 }),
    [values, width, height]
  );

  const description = useMemo(
    () => describeSparklineTrend(values, unit),
    [values, unit]
  );

  const strokeColor =
    direction === "up"
      ? "text-ledger-verdigris"
      : direction === "down"
      ? "text-ledger-wax"
      : "text-ledger-brass";

  return (
    <div className={`flex items-center gap-2 font-mono text-[11px] ${className}`}>
      <div className="relative">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={description}
          className={`overflow-visible ${strokeColor}`}
        >
          <title>{description}</title>
          {/* Subtle baseline */}
          <line
            x1="0"
            y1={height - 2}
            x2={width}
            y2={height - 2}
            stroke="currentColor"
            strokeWidth="0.5"
            strokeDasharray="2 2"
            opacity="0.3"
          />
          {/* Sparkline curve */}
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />
        </svg>
      </div>
      <div className="flex flex-col text-[10px] leading-tight text-ledger-ink-faded">
        <span className="font-semibold text-ledger-ink">
          {last} {unit}
        </span>
        <span className="capitalize">{direction}</span>
      </div>
    </div>
  );
}
