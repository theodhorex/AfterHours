/**
 * Circadian day/night lighting manager for PixiJS v8 isometric scene.
 * Applies continuous full-scene colour grading via container multiply tint
 * and additive warm light pools around lit windows, forges, and plaza lanterns.
 * Strictly capped at <= 40 pooled sprites, ZERO per-frame allocations,
 * and camera-culled.
 */

import { Container, Sprite, Texture } from "pixi.js";
import {
  REDUCED_MOTION_T,
  MAX_LIGHT_POOLS,
  getLightTint,
  getLightPoolIntensity,
  updateClock,
  findLightPoolOrigins,
  cullLightPools,
  type LightPoolOrigin,
  type Bounds2D,
} from "./light-curve.ts";
import { getReducedMotion } from "../a11y/reduced-motion.ts";

export interface LightSystemConfig {
  layerParent?: Container;
}

interface ActivePool {
  spr: Sprite;
  origin: LightPoolOrigin;
  baseAlpha: number;
  phase: number;
}

/**
 * Creates a shared baked radial gradient texture for soft additive light pools.
 */
function createSharedLightPoolTexture(): Texture {
  if (typeof document === "undefined") {
    return Texture.EMPTY;
  }
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const rad = size / 2;
    const grad = ctx.createRadialGradient(rad, rad, 0, rad, rad, rad);
    // Warm amber-gold center fading softly to dark orange/transparent edge
    grad.addColorStop(0, "rgba(255, 220, 130, 0.65)");
    grad.addColorStop(0.35, "rgba(255, 180, 80, 0.35)");
    grad.addColorStop(0.7, "rgba(240, 130, 40, 0.12)");
    grad.addColorStop(1, "rgba(220, 90, 20, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = Texture.from(canvas);
  return tex;
}

export class IsoLightSystem {
  public layer = new Container();
  public timeT = REDUCED_MOTION_T; // Starts at daytime, runs on clock
  private pools: ActivePool[] = [];
  private activeCount = 0;
  private sharedTexture: Texture | null = null;
  private defaultBounds: Bounds2D = { minX: -800, maxX: 800, minY: -400, maxY: 1000 };

  constructor() {
    this.layer.eventMode = "none";
    this.sharedTexture = createSharedLightPoolTexture();

    // Pre-allocate exactly MAX_LIGHT_POOLS sprites
    for (let i = 0; i < MAX_LIGHT_POOLS; i++) {
      const spr = new Sprite(this.sharedTexture);
      spr.anchor.set(0.5, 0.5);
      spr.roundPixels = true;
      spr.blendMode = "add";
      spr.visible = false;
      this.layer.addChild(spr);

      this.pools.push({
        spr,
        origin: { x: 0, y: 0, kind: "building" },
        baseAlpha: 0.85,
        phase: (i / MAX_LIGHT_POOLS) * Math.PI * 2,
      });
    }
  }

  /**
   * Updates light pool positions when city layout changes or rebuilds.
   * Retains the running circadian clock (timeT) to prevent flickering across sim steps.
   */
  public setLayout(
    layout: {
      buildings?: Array<{ tileX: number; tileY: number; open?: boolean; ruined?: boolean; sectorIdx?: number }>;
      houses?: Array<{ tileX: number; tileY: number; level?: number }>;
      plaza?: { x: number; y: number } | null;
      sectors?: Array<{ idx: number; kind: string }>;
    }
  ): void {
    const origins = findLightPoolOrigins(layout, MAX_LIGHT_POOLS);
    this.activeCount = origins.length;

    for (let i = 0; i < MAX_LIGHT_POOLS; i++) {
      const pool = this.pools[i];
      if (i < this.activeCount) {
        const orig = origins[i];
        pool.origin = orig;
        pool.spr.position.set(orig.x, orig.y);
        const scale = (orig.radius ?? 24) / 32;
        pool.spr.scale.set(scale);
        pool.baseAlpha = orig.kind === "forge" ? 0.95 : orig.kind === "plaza" ? 0.9 : 0.75;
      } else {
        pool.spr.visible = false;
      }
    }
  }

  /**
   * Per-frame update invoked by the Pixi ticker.
   * Modulates full-scene container tint and controls soft light pool visibility & intensity.
   */
  public update(
    dt: number,
    worldContainer: Container,
    baseThemeTint: number,
    viewBounds?: Bounds2D,
    allowMotion = true
  ): void {
    const isHidden = typeof document !== "undefined" && document.hidden;
    const isReduced = getReducedMotion() || !allowMotion;

    // Advance continuous circadian clock
    this.timeT = updateClock(this.timeT, dt, isHidden, isReduced);

    // 1. Color grade: multiply light curve tint on world container
    const currentGrade = getLightTint(this.timeT, baseThemeTint);
    worldContainer.tint = currentGrade;

    // 2. Light pools intensity and camera culling
    const intensity = isReduced ? 0.0 : getLightPoolIntensity(this.timeT);

    if (intensity <= 0.005 || this.activeCount === 0) {
      for (let i = 0; i < this.activeCount; i++) {
        this.pools[i].spr.visible = false;
      }
      return;
    }

    const bounds = viewBounds ?? this.defaultBounds;
    const poolPositions = this.pools.slice(0, this.activeCount).map((p) => p.origin);
    const inViewMask = cullLightPools(poolPositions, bounds, 48);

    for (let i = 0; i < this.activeCount; i++) {
      const pool = this.pools[i];
      const inView = inViewMask[i];
      pool.spr.visible = inView;
      if (inView) {
        // Subtle organic breathing for living lanterns
        const breathe = 0.94 + 0.06 * Math.sin(this.timeT * 60 + pool.phase);
        pool.spr.alpha = intensity * pool.baseAlpha * breathe;
      }
    }
  }

  /**
   * Resets light pool visibility.
   */
  public clear(): void {
    for (const p of this.pools) {
      p.spr.visible = false;
    }
  }

  /**
   * Cleanup resources on scene destroy.
   */
  public destroy(): void {
    this.clear();
    this.layer.destroy({ children: true });
    if (this.sharedTexture && this.sharedTexture !== Texture.EMPTY) {
      this.sharedTexture.destroy(true);
      this.sharedTexture = null;
    }
  }
}
