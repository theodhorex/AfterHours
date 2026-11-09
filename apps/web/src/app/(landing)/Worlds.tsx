"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { gsap, noMotion } from "./gsap-setup.ts";
import { CITY_PX, ROUTES, TILES, VIEW, hexPoints, routePath, tileColors, type RegionId, type Tile } from "./hexgen.ts";

type Note = { id: RegionId; name: string; line: string; makes: string; needs: string; sends: string; rgb: string };

const NOTES: Note[] = [
  { id: "warrens", name: "Goblin Warrens", line: "The tightest city on the map. Space is short, so every coin changes hands fast.", makes: "Scrap iron, tools", needs: "Grain, bread", sends: "Tools to Dino Vale", rgb: "240,127,79" },
  { id: "hold", name: "Cave Hold", line: "Dwarf-hewn halls beneath the mountain. The treasury grows slowly and remembers everything.", makes: "Ore, worked stone", needs: "Grain, potions", sends: "Ore to the Warrens", rgb: "229,179,88" },
  { id: "vale", name: "Dino Vale", line: "Great beasts plough the plains. The Vale bakes more bread than it can eat and ships the rest.", makes: "Grain, bread", needs: "Tools", sends: "Bread to Elf Grove", rgb: "107,199,133" },
  { id: "grove", name: "Elf Grove", line: "Alchemists brew by lantern light. Rare goods leave the Grove and come back as grain.", makes: "Potions, fine goods", needs: "Grain, bread", sends: "Potions to Cave Hold", rgb: "184,157,245" },
];

function Deco({ t }: { t: Tile }): ReactNode {
  const { x, y } = t;
  switch (t.kind) {
    case "mount":
    case "rock":
      return (
        <>
          <polygon points={`${x - 9},${y + 6} ${x},${y - 11} ${x + 9},${y + 6}`} fill="#a8a193" opacity={t.kind === "mount" ? 1 : 0.55} />
          {t.kind === "mount" && <polygon points={`${x - 3.2},${y - 4} ${x},${y - 11} ${x + 3.2},${y - 4}`} fill="#f2efe6" />}
        </>
      );
    case "forest":
    case "wood": {
      const c = t.kind === "forest" ? "#2a5c2b" : "#2c2068";
      return (
        <>
          {[-7, 0, 7].map((o, i) => (
            <polygon key={i} points={`${x + o - 4.5},${y + 6 - i * 1.5} ${x + o},${y - 7 - (i % 2) * 3} ${x + o + 4.5},${y + 6 - i * 1.5}`} fill={c} />
          ))}
        </>
      );
    }
    case "field":
      return (
        <>
          {[-5, 0, 5].map((o) => (
            <line key={o} x1={x - 10} x2={x + 10} y1={y + o} y2={y + o} stroke="#8d7c2e" strokeWidth="1.4" />
          ))}
        </>
      );
    case "ore":
      return (
        <>
          <polygon className="lp-glint" points={`${x - 5},${y} ${x - 1},${y - 5} ${x + 3},${y}  ${x - 1},${y + 5}`} fill="#ffd980" />
          <polygon className="lp-glint" points={`${x + 3},${y + 3} ${x + 6},${y - 1} ${x + 9},${y + 3} ${x + 6},${y + 7}`} fill="#ffe9ae" />
        </>
      );
    case "lava":
      return <path className="lp-lava" d={`M${x - 11},${y + 2} l5,-5 l4,6 l5,-8 l5,6 l4,-3`} fill="none" stroke="#ff6a2a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />;
    case "crater":
      return <ellipse cx={x} cy={y + 1} rx="8" ry="5" fill="#1b161a" />;
    case "crystal":
      return (
        <>
          <polygon className="lp-glint" points={`${x - 6},${y + 6} ${x - 3},${y - 9} ${x},${y + 6}`} fill="#e3d6ff" />
          <polygon className="lp-glint" points={`${x},${y + 7} ${x + 4},${y - 5} ${x + 8},${y + 7}`} fill="#c8b2f6" />
        </>
      );
    case "pond":
      return <ellipse cx={x} cy={y + 1} rx="9" ry="5.5" fill="#9bd7f0" opacity=".75" />;
    case "stone":
    case "plateau":
    case "basalt":
    case "glade":
    case "grass":
      return t.v > 0.62 ? <circle cx={+(x + (t.v - 0.7) * 30).toFixed(1)} cy={y + 2} r="2.2" fill="rgba(255,255,255,.22)" /> : null;
    case "city": {
      const roof = t.region === "warrens" ? "#e0623a" : t.region === "hold" ? "#d8a64a" : t.region === "vale" ? "#e8c35a" : "#b79cf5";
      return (
        <>
          {[-8, 0, 8].map((o, i) => (
            <g key={i}>
              <rect x={x + o - 4} y={y - 1 + (i === 1 ? -4 : 1)} width="8" height={i === 1 ? 10 : 7} fill="#2b2230" />
              <polygon points={`${x + o - 5},${y - 1 + (i === 1 ? -4 : 1)} ${x + o},${y - 7 + (i === 1 ? -4 : 1)} ${x + o + 5},${y - 1 + (i === 1 ? -4 : 1)}`} fill={roof} />
            </g>
          ))}
          <circle className="lp-beacon" cx={x} cy={y - 16} r="3" fill={roof} />
        </>
      );
    }
    default:
      return null;
  }
}

export function Worlds() {
  const [active, setActive] = useState<RegionId>("vale");
  const wrap = useRef<HTMLElement>(null);
  const note = NOTES.find((n) => n.id === active)!;

  useEffect(() => {
    const el = wrap.current;
    if (!el || noMotion()) return;
    const ctx = gsap.context(() => {
      gsap.from(".lp-hexw", {
        y: -46,
        opacity: 0,
        duration: 0.7,
        ease: "back.out(1.5)",
        stagger: { amount: 1.6, from: "center" },
        scrollTrigger: { trigger: ".lp-atlas-svg", start: "top 72%", once: true },
      });
      gsap.from(".lp-route, .lp-caravan, .lp-cargo", { opacity: 0, duration: 1, delay: 1.4, scrollTrigger: { trigger: ".lp-atlas-svg", start: "top 72%", once: true } });
    }, el);
    return () => ctx.revert();
  }, []);

  const byRegion = (id: RegionId | "sea") => TILES.filter((t) => t.region === id);

  return (
    <section id="arcs" className="lp-worlds" ref={wrap} aria-label="The four worlds">
      <div className="lp-wrap lp-worlds-head">
        <h2 className="lp-h2">One continent, four ways of getting by.</h2>
        <p className="lp-lede">Hover the map or pick a city. The dotted lines are caravans: what one city makes, another needs.</p>
      </div>
      <div className="lp-atlas">
        <svg
          className="lp-atlas-svg"
          viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
          role="img"
          aria-label="A hex-tile map of four cities: Goblin Warrens, Cave Hold, Dino Vale and Elf Grove, joined by trade routes."
        >
          <g className="lp-sea">
            {byRegion("sea").map((t) => (
              <polygon key={t.id} points={hexPoints(t.x, t.y, 20)} fill="#0e1a2b" stroke="#15263d" strokeWidth="1" opacity={+(0.55 + t.v * 0.3).toFixed(2)} />
            ))}
          </g>
          {NOTES.map((n) => {
            const on = active === n.id;
            return (
              <g key={n.id} className="lp-reg" data-active={on} data-dim={!on} onPointerEnter={() => setActive(n.id)}>
                {byRegion(n.id).map((t) => {
                  const col = tileColors(t);
                  return (
                    <g key={t.id} className="lp-hexw">
                      <g className="lp-hex">
                        <polygon points={hexPoints(t.x, t.y + 5)} fill={col.side} />
                        <polygon points={hexPoints(t.x, t.y)} fill={col.top} stroke="rgba(0,0,0,.28)" strokeWidth=".8" />
                        <Deco t={t} />
                      </g>
                    </g>
                  );
                })}
              </g>
            );
          })}
          <g className="lp-routes" pointerEvents="none">
            {ROUTES.map((r) => {
              const hot = active === r.from || active === r.to;
              const id = `lp-r-${r.from}-${r.to}`;
              const d = routePath(r.from, r.to, r.bend);
              const mid = { x: (CITY_PX[r.from].x + CITY_PX[r.to].x) / 2, y: (CITY_PX[r.from].y + CITY_PX[r.to].y) / 2 };
              return (
                <g key={id} data-hot={hot}>
                  <path id={id} className="lp-route" d={d} />
                  <circle className="lp-caravan" r={hot ? 5 : 3.2}>
                    <animateMotion dur={`${9 + r.bend * 0.05}s`} repeatCount="indefinite" rotate="auto"><mpath href={`#${id}`} /></animateMotion>
                  </circle>
                  {hot && <text className="lp-cargo" x={mid.x} y={mid.y - 14} textAnchor="middle">{r.cargo}</text>}
                </g>
              );
            })}
          </g>
        </svg>

        <aside className="lp-fieldnote" style={{ ["--lp-rgb" as string]: note.rgb }} aria-live="polite">
          <div className="lp-tabs" role="tablist" aria-label="Choose a city">
            {NOTES.map((n) => (
              <button key={n.id} type="button" role="tab" aria-selected={active === n.id} className="lp-tab" style={{ ["--lp-rgb" as string]: n.rgb }} onClick={() => setActive(n.id)} onFocus={() => setActive(n.id)}>
                <i aria-hidden="true" />
                {n.name}
              </button>
            ))}
          </div>
          <div className="lp-note" key={note.id}>
            <h3>{note.name}</h3>
            <p className="lp-note-line">{note.line}</p>
            <dl>
              <div><dt>Makes</dt><dd>{note.makes}</dd></div>
              <div><dt>Needs</dt><dd>{note.needs}</dd></div>
              <div><dt>Sends</dt><dd>{note.sends}</dd></div>
            </dl>
          </div>
        </aside>
      </div>
    </section>
  );
}
