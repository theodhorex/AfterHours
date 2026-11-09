/**
 * Pure math helpers for UI animations, seed derivations, and accessibility contrast checks.
 */

export function interpolateTickNumber(
  start: number,
  end: number,
  progress: number,
): number {
  if (progress <= 0) return start;
  if (progress >= 1) return end;
  const current = start + (end - start) * progress;
  return Math.round(current);
}

export function seedStampRotation(id: string, maxDeg: number = 4): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const norm = ((hash >>> 0) % 10000) / 10000;
  const deg = (norm * 2 - 1) * maxDeg;
  return Number(deg.toFixed(2));
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const brightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  return (brightest + 0.05) / (darkest + 0.05);
}
