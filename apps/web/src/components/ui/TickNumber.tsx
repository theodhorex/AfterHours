import React, { useEffect, useRef, useState } from "react";
import { interpolateTickNumber } from "../../lib/ui-math.ts";

export interface TickNumberProps {
  value: number;
  format?: (n: number) => string;
  className?: string;
  durationMs?: number;
}

export function TickNumber({
  value,
  format,
  className = "",
  durationMs = 400,
}: TickNumberProps) {
  // First render shows the final value so SSR output is stable
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    // If value didn't change, nothing to animate
    if (value === prevValueRef.current) {
      return;
    }

    const startVal = prevValueRef.current;
    const endVal = value;
    prevValueRef.current = value;

    // Check prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Snaps immediately when reduced motion is preferred
    if (prefersReducedMotion || durationMs <= 0) {
      rafIdRef.current = requestAnimationFrame(() => {
        setDisplayValue(endVal);
        rafIdRef.current = null;
      });
      return () => {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
      };
    }

    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const current = interpolateTickNumber(startVal, endVal, progress);

      setDisplayValue(current);

      if (progress < 1) {
        rafIdRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endVal);
        rafIdRef.current = null;
      }
    };

    rafIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [value, durationMs]);

  const formattedText = format ? format(displayValue) : displayValue.toLocaleString();

  return (
    <span
      className={`tabular-nums font-mono inline-block ${className}`}
      aria-label={format ? format(value) : value.toLocaleString()}
    >
      {formattedText}
    </span>
  );
}

export default TickNumber;
