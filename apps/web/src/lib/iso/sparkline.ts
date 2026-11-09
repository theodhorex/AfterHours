export interface SparklineOptions {
  width?: number;
  height?: number;
  padding?: number;
}

export interface SparklineResult {
  points: string;
  min: number;
  max: number;
  first: number;
  last: number;
  direction: "up" | "down" | "flat";
}

/**
 * Pure calculation of SVG polyline points from an array of numbers.
 * Safe against zero division, negative values, and single-item arrays.
 */
export function generateSparklinePoints(
  values: number[],
  options?: SparklineOptions
): SparklineResult {
  const width = options?.width ?? 120;
  const height = options?.height ?? 28;
  const padding = options?.padding ?? 2;

  if (!values || values.length === 0) {
    return {
      points: `0,${height / 2} ${width},${height / 2}`,
      min: 0,
      max: 0,
      first: 0,
      last: 0,
      direction: "flat",
    };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const first = values[0];
  const last = values[values.length - 1];
  const direction: "up" | "down" | "flat" =
    last > first ? "up" : last < first ? "down" : "flat";

  const usableHeight = Math.max(1, height - padding * 2);
  const stepX = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;

  const points = values
    .map((val, idx) => {
      const x = padding + idx * stepX;
      // Invert Y because SVG coordinate 0 is at top
      const normalized = range > 0 ? (val - min) / range : 0.5;
      const y = padding + (1 - normalized) * usableHeight;
      return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
    })
    .join(" ");

  return { points, min, max, first, last, direction };
}

/**
 * Generates human-readable and screen-reader accessible description of a trend.
 */
export function describeSparklineTrend(
  values: number[],
  unit = "coin"
): string {
  if (!values || values.length === 0) {
    return `No trend data recorded`;
  }
  const first = values[0];
  const last = values[values.length - 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const diff = last - first;
  const dirText = diff > 0 ? "increasing" : diff < 0 ? "decreasing" : "steady";
  return `20-step trend: started at ${first} ${unit}, peaked at ${max} ${unit}, now at ${last} ${unit} (${dirText}).`;
}
