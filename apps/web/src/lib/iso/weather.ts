/**
 * High-performance pooled weather particle system for PixiJS v8.
 * Simulates rain, fog, falling leaves, snow, fireflies, embers, and dust.
 * Strictly capped at <= 80 pooled particles with ZERO per-frame allocations.
 * Completely paused and invisible when prefers-reduced-motion is active.
 */

import { Container, Graphics } from "pixi.js";
import type { WeatherType, ThemeTokens } from "./theme.ts";
import { createRng, type PRNG } from "./rng.ts";

export const MAX_WEATHER_PARTICLES = 80;

interface WeatherParticle {
  g: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  baseAlpha: number;
  phase: number;
  size: number;
}

export class IsoWeatherManager {
  public layer = new Container();
  private particles: WeatherParticle[] = [];
  private currentWeather: WeatherType = "none";
  private activeCount = 0;
  private time = 0;
  private boundW = 1400;
  private boundH = 900;
  private rng: PRNG = createRng("weather_particles");

  constructor() {
    this.layer.eventMode = "none";
    // Pre-allocate exactly MAX_WEATHER_PARTICLES graphics objects
    for (let i = 0; i < MAX_WEATHER_PARTICLES; i++) {
      const g = new Graphics();
      g.visible = false;
      this.layer.addChild(g);
      this.particles.push({
        g,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        alpha: 0,
        baseAlpha: 0,
        phase: (i / MAX_WEATHER_PARTICLES) * Math.PI * 2,
        size: 2,
      });
    }
  }

  public setWeather(
    weather: WeatherType,
    theme: ThemeTokens,
    allowMotion: boolean
  ): void {
    this.currentWeather = weather;

    if (!allowMotion || weather === "none") {
      this.activeCount = 0;
      for (const p of this.particles) {
        p.g.visible = false;
      }
      return;
    }

    // Determine count and draw procedural particle texture onto graphics
    switch (weather) {
      case "rain":
        this.activeCount = 70;
        for (let i = 0; i < this.activeCount; i++) {
          const p = this.particles[i];
          p.g.clear();
          p.g.poly([0, 0, -4, 10]).stroke({ color: 0x90cdf4, width: 1.2, alpha: 0.65 });
          p.vx = -1.8;
          p.vy = 6.5;
          p.baseAlpha = 0.65;
          this.resetParticle(p, true);
        }
        break;

      case "snow":
        this.activeCount = 65;
        for (let i = 0; i < this.activeCount; i++) {
          const p = this.particles[i];
          p.g.clear();
          const sz = i % 3 === 0 ? 2.2 : 1.5;
          p.g.circle(0, 0, sz).fill({ color: 0xf0f8ff, alpha: 0.85 });
          p.vx = -0.4;
          p.vy = 1.2 + (i % 3) * 0.4;
          p.baseAlpha = 0.85;
          this.resetParticle(p, true);
        }
        break;

      case "falling_leaves":
        this.activeCount = 45;
        for (let i = 0; i < this.activeCount; i++) {
          const p = this.particles[i];
          p.g.clear();
          // Autumn orange/amber leaf
          const leafCol = i % 2 === 0 ? 0xd97706 : 0xb45309;
          p.g.ellipse(0, 0, 3, 1.8).fill({ color: leafCol, alpha: 0.9 });
          p.vx = -0.8;
          p.vy = 1.0;
          p.baseAlpha = 0.9;
          this.resetParticle(p, true);
        }
        break;

      case "fireflies":
        this.activeCount = 35;
        for (let i = 0; i < this.activeCount; i++) {
          const p = this.particles[i];
          p.g.clear();
          const flyCol = theme.arcId === "elf_grove" ? 0xa7f3d0 : 0xfde047;
          p.g.circle(0, 0, 2.5).fill({ color: flyCol, alpha: 0.85 });
          p.g.circle(0, 0, 4.5).fill({ color: flyCol, alpha: 0.25 });
          p.vx = 0;
          p.vy = -0.15;
          p.baseAlpha = 0.8;
          this.resetParticle(p, true);
        }
        break;

      case "embers":
        this.activeCount = 40;
        for (let i = 0; i < this.activeCount; i++) {
          const p = this.particles[i];
          p.g.clear();
          const emberCol = i % 2 === 0 ? 0xf97316 : 0xef4444;
          p.g.circle(0, 0, 1.8).fill({ color: emberCol, alpha: 0.9 });
          p.vx = (i % 2 === 0 ? 0.3 : -0.3);
          p.vy = -1.6 - (i % 3) * 0.3;
          p.baseAlpha = 0.9;
          this.resetParticle(p, true);
        }
        break;

      case "fog":
        this.activeCount = 20;
        for (let i = 0; i < this.activeCount; i++) {
          const p = this.particles[i];
          p.g.clear();
          const fogCol = theme.arcId === "goblin_warrens" ? 0x8b5cf6 : 0xb0bec5;
          p.g.ellipse(0, 0, 42, 18).fill({ color: fogCol, alpha: 0.16 });
          p.vx = 0.45;
          p.vy = 0.05;
          p.baseAlpha = 0.16;
          this.resetParticle(p, true);
        }
        break;

      case "dust":
        this.activeCount = 35;
        for (let i = 0; i < this.activeCount; i++) {
          const p = this.particles[i];
          p.g.clear();
          p.g.circle(0, 0, 1.2).fill({ color: 0xd6c29e, alpha: 0.5 });
          p.vx = 0.6;
          p.vy = 0.2;
          p.baseAlpha = 0.5;
          this.resetParticle(p, true);
        }
        break;
    }

    // Hide inactive particles
    for (let i = this.activeCount; i < MAX_WEATHER_PARTICLES; i++) {
      this.particles[i].g.visible = false;
    }
  }

  private resetParticle(p: WeatherParticle, randomizeY = false): void {
    const halfW = this.boundW / 2;
    const rx = this.rng.nextInt(0, 1000) / 1000;
    p.x = -halfW + rx * this.boundW;
    const ry = this.rng.nextInt(0, 1000) / 1000;
    p.y = randomizeY
      ? -this.boundH / 2 + ry * this.boundH
      : -this.boundH / 2 - 20;

    // For embers rising from below
    if (this.currentWeather === "embers") {
      p.y = randomizeY
        ? -this.boundH / 2 + ry * this.boundH
        : this.boundH / 2 + 10;
    }

    p.g.position.set(p.x, p.y);
    p.g.alpha = p.baseAlpha;
    p.g.visible = true;
  }

  public update(): void {
    if (this.activeCount === 0 || this.currentWeather === "none") return;
    this.time += 0.025;

    const halfW = this.boundW / 2;
    const halfH = this.boundH / 2;

    for (let i = 0; i < this.activeCount; i++) {
      const p = this.particles[i];

      if (this.currentWeather === "falling_leaves") {
        p.x += p.vx + Math.sin(this.time * 2 + p.phase) * 0.9;
        p.y += p.vy;
      } else if (this.currentWeather === "snow") {
        p.x += p.vx + Math.sin(this.time * 1.5 + p.phase) * 0.4;
        p.y += p.vy;
      } else if (this.currentWeather === "fireflies") {
        p.x += Math.sin(this.time * 1.2 + p.phase) * 0.7;
        p.y += Math.cos(this.time * 0.9 + p.phase) * 0.5;
        p.g.alpha = p.baseAlpha * (0.4 + 0.6 * Math.sin(this.time * 3 + p.phase));
      } else if (this.currentWeather === "embers") {
        p.x += p.vx + Math.sin(this.time * 2.5 + p.phase) * 0.5;
        p.y += p.vy;
        p.g.alpha = p.baseAlpha * Math.max(0.1, 1 - (halfH - p.y) / this.boundH);
      } else {
        p.x += p.vx;
        p.y += p.vy;
      }

      p.g.position.set(p.x, p.y);

      // Wrap boundaries
      if (
        p.y > halfH + 30 ||
        p.y < -halfH - 30 ||
        p.x < -halfW - 40 ||
        p.x > halfW + 40
      ) {
        this.resetParticle(p);
      }
    }
  }

  public clear(): void {
    this.activeCount = 0;
    for (const p of this.particles) {
      p.g.visible = false;
    }
  }

  public destroy(): void {
    this.clear();
    this.layer.destroy({ children: true });
  }
}
