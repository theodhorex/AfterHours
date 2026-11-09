/**
 * Seasonal Weather Particle System for PixiJS v8 isometric city.
 * Simulates spring rain & water ripples, summer drifting dust motes & dusk fireflies,
 * autumn blowing leaves & low fog bands, and winter slow swaying snowflakes.
 * Strictly capped at <= 120 pooled particles, ZERO per-frame allocations,
 * 2s smooth season cross-fade, camera-culled, and disabled under reduced motion.
 */

import { Container, Graphics } from "pixi.js";
import { createRng, type PRNG } from "./rng.ts";
import type { Bounds2D } from "./light-curve.ts";
import {
  MAX_WEATHER_PARTICLES,
  CROSSFADE_DURATION_SEC,
  type ParticleKind,
  type SeasonWeatherSpec,
  getSeasonWeatherSpec,
  computeCrossFadeAlpha,
  isWeatherParticleInView,
} from "./weather-pure.ts";

export {
  MAX_WEATHER_PARTICLES,
  CROSSFADE_DURATION_SEC,
  getSeasonWeatherSpec,
  getWeatherParticleCounts,
  computeCrossFadeAlpha,
  isWeatherParticleInView,
} from "./weather-pure.ts";
export type { ParticleKind, SeasonWeatherSpec } from "./weather-pure.ts";

interface WeatherParticle {
  g: Graphics;
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  baseAlpha: number;
  phase: number;
  size: number;
  age: number;
  maxAge: number;
  isOutgoing: boolean;
  active: boolean;
}

export class IsoWeatherSystem {
  public layer = new Container();
  private particles: WeatherParticle[] = [];
  private currentSeason = -1;
  private targetSeason = -1;
  private crossFadeTimer = CROSSFADE_DURATION_SEC;
  private time = 0;
  private rng: PRNG = createRng("weather_particles_system");
  private defaultBounds: Bounds2D = { minX: -700, maxX: 700, minY: -450, maxY: 900 };

  constructor() {
    this.layer.eventMode = "none";
    for (let i = 0; i < MAX_WEATHER_PARTICLES; i++) {
      const g = new Graphics();
      g.visible = false;
      this.layer.addChild(g);

      this.particles.push({
        g,
        kind: "none",
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        alpha: 0,
        baseAlpha: 0,
        phase: (i / MAX_WEATHER_PARTICLES) * Math.PI * 2,
        size: 2,
        age: 0,
        maxAge: 100,
        isOutgoing: false,
        active: false,
      });
    }
  }

  public setSeason(season: number, allowMotion = true, timeOfDayT = 0.3): void {
    const nextSeason = ((Math.floor(season) % 4) + 4) % 4;

    if (!allowMotion) {
      this.clear();
      return;
    }

    if (this.currentSeason === 1) {
      const isDuskOrNight = timeOfDayT >= 0.5 || timeOfDayT < 0.12;
      for (const p of this.particles) {
        if (p.kind === "fireflies") p.active = isDuskOrNight;
      }
    }

    // If season is already set and matches, do not trigger a crossfade or touch particles
    if (nextSeason === this.currentSeason) {
      return;
    }

    const isInitial = this.currentSeason < 0;

    if (!isInitial) {
      // Mark current active particles as outgoing for crossfade
      for (const p of this.particles) {
        if (p.active) p.isOutgoing = true;
      }
      this.crossFadeTimer = 0.0;
    } else {
      // First load: immediately active
      this.crossFadeTimer = CROSSFADE_DURATION_SEC;
    }

    this.targetSeason = nextSeason;
    const spec = getSeasonWeatherSpec(this.targetSeason, timeOfDayT);
    this.spawnIncomingParticles(spec);
    this.currentSeason = this.targetSeason;
  }

  private spawnIncomingParticles(spec: SeasonWeatherSpec): void {
    let spawnedPrimary = 0;
    let spawnedSecondary = 0;

    for (const p of this.particles) {
      if (p.isOutgoing && p.active) continue;

      if (spawnedPrimary < spec.primaryCount) {
        this.initParticle(p, spec.primaryKind, false);
        spawnedPrimary++;
      } else if (spawnedSecondary < spec.secondaryCount) {
        this.initParticle(p, spec.secondaryKind, false);
        spawnedSecondary++;
      } else {
        p.active = false;
        p.g.visible = false;
      }
    }
  }

  private initParticle(p: WeatherParticle, kind: ParticleKind, randomizeY: boolean): void {
    p.kind = kind;
    p.active = true;
    p.isOutgoing = false;
    p.age = this.rng.nextInt(0, 100);
    p.g.clear();

    const rx = this.rng.nextInt(0, 1000) / 1000;
    const ry = this.rng.nextInt(0, 1000) / 1000;
    const w = this.defaultBounds.maxX - this.defaultBounds.minX;
    const h = this.defaultBounds.maxY - this.defaultBounds.minY;

    p.x = this.defaultBounds.minX + rx * w;
    p.y = randomizeY ? this.defaultBounds.minY + ry * h : this.defaultBounds.minY - 20;

    switch (kind) {
      case "rain":
        p.g.poly([0, 0, -3, 8]).stroke({ color: 0x90cdf4, width: 2, alpha: 0.65 });
        p.vx = -1.6;
        p.vy = 7.0;
        p.baseAlpha = 0.65;
        break;

      case "ripple":
        p.g.ellipse(0, 0, 3, 1.5).stroke({ color: 0xbae6fd, width: 1.2, alpha: 0.7 });
        p.vx = 0;
        p.vy = 0.1;
        p.baseAlpha = 0.65;
        p.maxAge = 60;
        p.y = this.defaultBounds.minY + ry * h;
        break;

      case "dust":
        p.g.circle(0, 0, 1.2).fill({ color: 0xfef08a, alpha: 0.45 });
        p.vx = 0.35;
        p.vy = 0.12;
        p.baseAlpha = 0.45;
        break;

      case "fireflies":
        p.g.circle(0, 0, 2.2).fill({ color: 0xa7f3d0, alpha: 0.85 });
        p.g.circle(0, 0, 4.5).fill({ color: 0x34d399, alpha: 0.25 });
        p.vx = 0;
        p.vy = -0.15;
        p.baseAlpha = 0.85;
        break;

      case "leaves":
        p.g.ellipse(0, 0, 2.8, 1.6).fill({ color: 0xd97706, alpha: 0.9 });
        p.vx = -0.9;
        p.vy = 1.1;
        p.baseAlpha = 0.9;
        break;

      case "fog":
        p.g.ellipse(0, 0, 48, 16).fill({ color: 0xcfd8dc, alpha: 0.14 });
        p.vx = 0.35;
        p.vy = 0.04;
        p.baseAlpha = 0.14;
        break;

      case "snow":
        p.g.circle(0, 0, 1.6).fill({ color: 0xf0f8ff, alpha: 0.85 });
        p.vx = -0.3;
        p.vy = 1.2;
        p.baseAlpha = 0.85;
        break;

      default:
        p.active = false;
        p.g.visible = false;
        return;
    }

    p.g.position.set(p.x, p.y);
    p.g.alpha = p.baseAlpha;
    p.g.visible = true;
  }

  public update(dt: number, timeOfDayT = 0.3, viewBounds?: Bounds2D, allowMotion = true): void {
    if (!allowMotion) {
      this.clear();
      return;
    }

    if (this.currentSeason === 1) {
      const isDuskOrNight = timeOfDayT >= 0.5 || timeOfDayT < 0.12;
      for (const p of this.particles) {
        if (p.kind === "fireflies") p.active = isDuskOrNight;
      }
    }

    this.time += dt;
    if (this.crossFadeTimer < CROSSFADE_DURATION_SEC) {
      this.crossFadeTimer += dt;
      if (this.crossFadeTimer >= CROSSFADE_DURATION_SEC) {
        for (const p of this.particles) {
          if (p.isOutgoing) {
            p.active = false;
            p.isOutgoing = false;
            p.g.visible = false;
          }
        }
      }
    }

    const { fadeOutAlpha, fadeInAlpha } = computeCrossFadeAlpha(this.crossFadeTimer, CROSSFADE_DURATION_SEC);
    const bounds = viewBounds ?? this.defaultBounds;

    for (const p of this.particles) {
      if (!p.active) continue;

      p.age += 1;
      if (p.kind === "leaves") {
        p.x += p.vx + Math.sin(this.time * 2.2 + p.phase) * 1.1;
        p.y += p.vy;
      } else if (p.kind === "snow") {
        p.x += p.vx + Math.sin(this.time * 1.6 + p.phase) * 0.45;
        p.y += p.vy;
      } else if (p.kind === "fireflies") {
        p.x += Math.sin(this.time * 1.2 + p.phase) * 0.6;
        p.y += Math.cos(this.time * 0.9 + p.phase) * 0.4;
      } else if (p.kind === "ripple") {
        const progress = p.age / (p.maxAge || 60);
        p.g.scale.set(1 + progress * 1.5);
      } else {
        p.x += p.vx;
        p.y += p.vy;
      }

      const pad = 40;
      if (
        p.y > bounds.maxY + pad ||
        p.y < bounds.minY - pad ||
        p.x < bounds.minX - pad ||
        p.x > bounds.maxX + pad
      ) {
        this.initParticle(p, p.kind, false);
      }

      const inView = isWeatherParticleInView(p.x, p.y, bounds, 48);
      p.g.visible = inView;
      if (inView) {
        p.g.position.set(p.x, p.y);
        const fadeMul = p.isOutgoing ? fadeOutAlpha : fadeInAlpha;
        let organicAlpha = p.baseAlpha;
        if (p.kind === "fireflies") {
          organicAlpha = p.baseAlpha * (0.35 + 0.65 * Math.sin(this.time * 3.0 + p.phase));
        } else if (p.kind === "ripple") {
          organicAlpha = p.baseAlpha * Math.max(0, 1 - p.age / (p.maxAge || 60));
        }
        p.g.alpha = organicAlpha * fadeMul;
      }
    }
  }

  public clear(): void {
    for (const p of this.particles) {
      p.active = false;
      p.isOutgoing = false;
      p.g.visible = false;
    }
  }

  public destroy(): void {
    this.clear();
    this.layer.destroy({ children: true });
  }
}
