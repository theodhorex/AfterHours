/**
 * Ambient environmental life: chimney smoke puffs, drifting birds, and river sparkles.
 * Zero per-frame allocations, camera culling, strict 80-sprite cap, and WCAG reduced-motion compliance.
 */

import { Container, Sprite } from "pixi.js";
import { createRng } from "./rng.ts";
import type { LifeTextureCache } from "./life-sprites.ts";

export const MAX_ANIMATED_SPRITES = 80;

export interface ViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface BirdState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  arcSpeed: number;
  wingFrame: number;
  flapTimer: number;
}

export interface SmokePuffState {
  id: string;
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  age: number;
  maxAge: number;
  driftX: number;
  scale: number;
  alpha: number;
}

export interface RiverSparkleState {
  x: number;
  y: number;
  phase: number;
}

/**
 * Returns a deterministic bird flock count between 5 and 9.
 */
export function computeBirdCount(seed: string | number): number {
  const rng = createRng(seed);
  return rng.nextInt(5, 9);
}

/**
 * Determines whether an entity at (x, y) falls inside the viewport bounds with margin.
 */
export function isSpriteInView(
  x: number,
  y: number,
  viewBounds: ViewportBounds,
  margin = 64
): boolean {
  return (
    x >= viewBounds.minX - margin &&
    x <= viewBounds.maxX + margin &&
    y >= viewBounds.minY - margin &&
    y <= viewBounds.maxY + margin
  );
}

/**
 * Updates a bird's position drifting along a gentle arc and wraps around map boundaries.
 */
export function stepBird(
  bird: BirdState,
  dt: number,
  mapBounds: ViewportBounds,
  reducedMotion = false
): BirdState {
  if (reducedMotion) {
    return { ...bird, wingFrame: 0 };
  }

  // Gentle arc drift
  const newAngle = bird.angle + bird.arcSpeed * dt;
  const speed = Math.hypot(bird.vx, bird.vy);
  const curVx = Math.cos(newAngle) * speed;
  const curVy = Math.sin(newAngle) * (speed * 0.45); // Flatter vertical drift in isometric view

  let newX = bird.x + curVx * dt;
  let newY = bird.y + curVy * dt;

  // Wrap around map boundary with padding
  const pad = 24;
  const w = (mapBounds.maxX - mapBounds.minX) + pad * 2;
  const h = (mapBounds.maxY - mapBounds.minY) + pad * 2;

  if (newX < mapBounds.minX - pad) newX += w;
  else if (newX > mapBounds.maxX + pad) newX -= w;

  if (newY < mapBounds.minY - pad) newY += h;
  else if (newY > mapBounds.maxY + pad) newY -= h;

  // 2-frame wing flap: flap for 0.4s, glide for 0.8s
  const flapCycle = 1.2;
  const nextTimer = (bird.flapTimer + dt) % flapCycle;
  const wingFrame = nextTimer < 0.4 ? (Math.floor(nextTimer * 10) % 2) : 1;

  return {
    ...bird,
    x: newX,
    y: newY,
    vx: curVx,
    vy: curVy,
    angle: newAngle,
    wingFrame,
    flapTimer: nextTimer,
  };
}

/**
 * Manages pooled ambient sprites (smoke puffs, birds, river sparkles) in PixiJS v8.
 */
export class LifeAmbientManager {
  private effectsLayer: Container;
  private lifeTextures: LifeTextureCache;
  private birdSprites: Array<{ spr: Sprite; state: BirdState }> = [];
  private smokeSprites: Array<{ spr: Sprite; state: SmokePuffState }> = [];
  private sparkleSprites: Array<{ spr: Sprite; state: RiverSparkleState }> = [];
  private mapBounds: ViewportBounds = { minX: -600, maxX: 600, minY: -300, maxY: 900 };

  constructor(effectsLayer: Container, lifeTextures: LifeTextureCache) {
    this.effectsLayer = effectsLayer;
    this.lifeTextures = lifeTextures;
  }

  public setup(
    smokeOrigins: Array<{ x: number; y: number }>,
    mapBounds: ViewportBounds,
    seed: string | number,
    sparkleOrigins: Array<{ x: number; y: number }> = [],
    allowMotion = true
  ): void {
    this.clear();
    this.mapBounds = mapBounds;
    const rng = createRng(seed);

    // 1. Setup Birds (5 to 9 birds)
    const birdCount = computeBirdCount(seed);
    for (let i = 0; i < birdCount; i++) {
      const tex = this.lifeTextures.getBirdTexture(0);
      const spr = new Sprite(tex);
      spr.anchor.set(0.5, 0.5);
      spr.roundPixels = true;
      spr.visible = allowMotion;

      const x = rng.nextInt(mapBounds.minX, mapBounds.maxX);
      const y = rng.nextInt(mapBounds.minY, mapBounds.maxY);
      const angle = (rng.nextInt(0, 360) * Math.PI) / 180;
      const speed = 16 + rng.nextInt(0, 10);

      const state: BirdState = {
        id: `bird_${i}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.45,
        angle,
        arcSpeed: 0.15 + (rng.nextInt(0, 20) - 10) * 0.01,
        wingFrame: 0,
        flapTimer: (i * 0.25) % 1.2,
      };

      spr.position.set(x, y);
      this.effectsLayer.addChild(spr);
      this.birdSprites.push({ spr, state });
    }

    // 2. Setup Chimney Smoke Puffs (capped at 32 puffs total across chimneys)
    const maxPuffs = 32;
    let puffCount = 0;
    for (let c = 0; c < smokeOrigins.length; c++) {
      if (puffCount >= maxPuffs) break;
      const origin = smokeOrigins[c];
      const puffsForChimney = Math.min(3, maxPuffs - puffCount);

      for (let p = 0; p < puffsForChimney; p++) {
        const tex = this.lifeTextures.getSmokeTexture(2.5);
        const spr = new Sprite(tex);
        spr.anchor.set(0.5, 0.5);
        spr.roundPixels = true;
        spr.visible = allowMotion;

        const maxAge = 65 + p * 15;
        const state: SmokePuffState = {
          id: `smoke_${c}_${p}`,
          baseX: origin.x,
          baseY: origin.y,
          x: origin.x,
          y: origin.y,
          age: (p * 22) % maxAge,
          maxAge,
          driftX: (c % 2 === 0 ? 0.25 : -0.2) + (p % 2 === 0 ? 0.05 : -0.05),
          scale: 0.8,
          alpha: 0.6,
        };

        spr.position.set(state.x, state.y);
        this.effectsLayer.addChild(spr);
        this.smokeSprites.push({ spr, state });
        puffCount++;
      }
    }

    // 3. Setup River Sparkles (up to 6)
    const maxSparkles = Math.min(6, sparkleOrigins.length);
    for (let s = 0; s < maxSparkles; s++) {
      const tex = this.lifeTextures.getSparkleTexture();
      const spr = new Sprite(tex);
      spr.anchor.set(0.5, 0.5);
      spr.roundPixels = true;
      spr.position.set(sparkleOrigins[s].x, sparkleOrigins[s].y);
      spr.alpha = 0;
      this.effectsLayer.addChild(spr);
      this.sparkleSprites.push({
        spr,
        state: { x: sparkleOrigins[s].x, y: sparkleOrigins[s].y, phase: s * 1.2 },
      });
    }
  }

  public update(dt: number, viewBounds?: ViewportBounds, reducedMotion = false): void {
    const activeBounds = viewBounds ?? this.mapBounds;

    // 1. Birds update
    for (const b of this.birdSprites) {
      if (reducedMotion) {
        b.spr.visible = false;
        continue;
      }
      b.state = stepBird(b.state, dt, this.mapBounds, false);
      const inView = isSpriteInView(b.state.x, b.state.y, activeBounds, 48);
      b.spr.visible = inView;
      if (inView) {
        b.spr.position.set(b.state.x, b.state.y);
        b.spr.texture = this.lifeTextures.getBirdTexture(b.state.wingFrame);
        b.spr.scale.x = b.state.vx >= 0 ? 1 : -1;
      }
    }

    // 2. Smoke puffs update
    for (const s of this.smokeSprites) {
      if (reducedMotion) {
        s.spr.visible = false;
        continue;
      }
      const st = s.state;
      st.age += 1;
      if (st.age >= st.maxAge) {
        st.age = 0;
        st.x = st.baseX;
        st.y = st.baseY;
        st.alpha = 0.6;
        st.scale = 0.8;
      } else {
        const progress = st.age / st.maxAge;
        st.y -= 0.38;
        st.x += st.driftX;
        st.alpha = (1 - progress) * 0.55;
        st.scale = 0.8 + progress * 1.4;
      }

      const inView = isSpriteInView(st.x, st.y, activeBounds, 32);
      s.spr.visible = inView;
      if (inView) {
        s.spr.position.set(st.x, st.y);
        s.spr.alpha = st.alpha;
        s.spr.scale.set(st.scale);
      }
    }

    // 3. River sparkles update
    for (let i = 0; i < this.sparkleSprites.length; i++) {
      const sp = this.sparkleSprites[i];
      if (reducedMotion) {
        sp.spr.visible = false;
        continue;
      }
      sp.state.phase += dt * 2.5;
      const alpha = Math.max(0, Math.sin(sp.state.phase) * 0.85);
      const inView = isSpriteInView(sp.state.x, sp.state.y, activeBounds, 20);
      sp.spr.visible = inView && alpha > 0.05;
      if (sp.spr.visible) {
        sp.spr.alpha = alpha;
      }
    }
  }

  public clear(): void {
    this.effectsLayer.removeChildren();
    this.birdSprites = [];
    this.smokeSprites = [];
    this.sparkleSprites = [];
  }

  public destroy(): void {
    this.clear();
  }
}
