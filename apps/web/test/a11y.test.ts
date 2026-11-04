import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

export function parseCssTokens(cssContent: string): Record<string, string> {
  const rootMatch = cssContent.match(/:root\s*\{([^}]+)\}/);
  if (!rootMatch) return {};
  const tokens: Record<string, string> = {};
  const lines = rootMatch[1].split(";");
  for (const line of lines) {
    const parts = line.split(":");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts[1].trim();
      if (key.startsWith("--")) {
        tokens[key] = value;
      }
    }
  }
  return tokens;
}

describe("WCAG AA Contrast & Accessibility Static Audit", () => {
  it("contrastRatio helper calculates correct values for standard references", () => {
    assert.equal(Math.round(contrastRatio("#ffffff", "#000000")), 21);
    assert.equal(Math.round(contrastRatio("#000000", "#000000")), 1);
    assert.equal(
      contrastRatio("#12100e", "#f0e6d2").toFixed(1),
      contrastRatio("#f0e6d2", "#12100e").toFixed(1),
    );
  });

  it("globals.css defines all required atlas tokens in :root", () => {
    const cssPath = path.resolve(__dirname, "../src/app/globals.css");
    const css = fs.readFileSync(cssPath, "utf-8");
    const tokens = parseCssTokens(css);

    const requiredTokens = [
      "--atlas-canvas",
      "--atlas-surface",
      "--atlas-surface-raised",
      "--atlas-ink",
      "--atlas-ink-muted",
      "--atlas-gold",
      "--atlas-ember",
      "--atlas-moss",
      "--atlas-arcane",
      "--atlas-alert",
      "--atlas-ash",
    ];

    for (const token of requiredTokens) {
      assert.ok(tokens[token], `Missing token ${token} in globals.css`);
    }
  });

  it("all text color tokens meet WCAG AA normal text contrast (>= 4.5:1) against background surfaces", () => {
    const cssPath = path.resolve(__dirname, "../src/app/globals.css");
    const css = fs.readFileSync(cssPath, "utf-8");
    const tokens = parseCssTokens(css);

    const textTokens = [
      "--atlas-ink",
      "--atlas-ink-muted",
      "--atlas-gold",
      "--atlas-ember",
      "--atlas-moss",
      "--atlas-arcane",
      "--atlas-alert",
      "--atlas-ash",
    ];

    const backgroundTokens = [
      "--atlas-canvas",
      "--atlas-surface",
      "--atlas-surface-raised",
    ];

    const failures: string[] = [];

    for (const bgKey of backgroundTokens) {
      const bgHex = tokens[bgKey];
      for (const fgKey of textTokens) {
        const fgHex = tokens[fgKey];
        const ratio = contrastRatio(fgHex, bgHex);
        if (ratio < 4.5) {
          failures.push(
            `${fgKey} (${fgHex}) on ${bgKey} (${bgHex}) has contrast ${ratio.toFixed(2)}:1 (< 4.5:1)`,
          );
        }
      }
    }

    assert.deepEqual(
      failures,
      [],
      `Failing color pairs:\n${failures.join("\n")}`,
    );
  });

  it("inverted button colors meet WCAG AA contrast", () => {
    const cssPath = path.resolve(__dirname, "../src/app/globals.css");
    const css = fs.readFileSync(cssPath, "utf-8");
    const tokens = parseCssTokens(css);

    const goldBtnRatio = contrastRatio(
      tokens["--atlas-canvas"],
      tokens["--atlas-gold"],
    );
    assert.ok(
      goldBtnRatio >= 4.5,
      `Canvas on Gold button contrast is ${goldBtnRatio.toFixed(2)}:1 (< 4.5:1)`,
    );

    const alertBtnRatio = contrastRatio(
      tokens["--atlas-canvas"],
      tokens["--atlas-alert"],
    );
    assert.ok(
      alertBtnRatio >= 4.5,
      `Canvas on Alert button contrast is ${alertBtnRatio.toFixed(2)}:1 (< 4.5:1)`,
    );
  });

  it("globals.css contains prefers-reduced-motion media query that stops animations", () => {
    const cssPath = path.resolve(__dirname, "../src/app/globals.css");
    const css = fs.readFileSync(cssPath, "utf-8");

    assert.ok(
      css.includes("@media (prefers-reduced-motion: reduce)"),
      "globals.css must contain @media (prefers-reduced-motion: reduce)",
    );
    assert.ok(
      css.includes("animation-duration: 0.01ms"),
      "globals.css must disable animation-duration under prefers-reduced-motion",
    );
    assert.ok(
      css.includes("transition-duration: 0.01ms"),
      "globals.css must disable transition-duration under prefers-reduced-motion",
    );
  });
});
