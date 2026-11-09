"use client";

import { useEffect, useRef, useState } from "react";
import { gsap, noMotion } from "./gsap-setup.ts";

const LANES = [
  { name: "Goblin Warrens", rgb: "240,127,79" },
  { name: "Cave Hold", rgb: "229,179,88" },
  { name: "Dino Vale", rgb: "107,199,133" },
  { name: "Elf Grove", rgb: "184,157,245" },
];
const STEPS = [40, 80, 120, 160, 200];
const X0 = 250;
const DX = 170;
const Y0 = 78;
const DY = 70;

const FACTS = [
  { to: 4, label: "worlds, each with its own seed" },
  { to: 200, label: "seasons run in every world so far" },
  { to: 95, label: "contract tests passing" },
  { to: 2500, label: "years of history a world can show" },
];

function hexPath(cx: number, cy: number, r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${i ? "L" : "M"}${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join("") + "Z";
}

export function Stats() {
  const ref = useRef<HTMLElement>(null);
  const [tip, setTip] = useState<{ l: number; s: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || noMotion()) return;
    const ctx = gsap.context(() => {
      const nodes = gsap.utils.toArray<SVGGElement>(".lp-node");
      const nums = gsap.utils.toArray<HTMLElement>(".lp-fnum");
      const count = el.querySelector<HTMLElement>(".lp-seal-count");
      const setNums = (p: number) =>
        nums.forEach((n) => {
          n.textContent = Math.round(Number(n.dataset.to) * p).toLocaleString("en-US");
        });
      const build = (scrub: boolean) => {
        setNums(0);
        const proxy = { p: 0 };
        const tl = gsap.timeline({
          scrollTrigger: scrub
            ? { trigger: el, start: "top top", end: "+=140%", pin: true, scrub: 0.7 }
            : { trigger: ".lp-lanes", start: "top 75%", once: true },
        });
        tl.from(".lp-lane-line", { attr: { x2: 200 }, duration: 1, stagger: 0.12, ease: "power2.out" }, 0)
          .from(".lp-lane-name, .lp-col-head", { opacity: 0, x: -14, duration: 0.6, stagger: 0.06 }, 0.1)
          .from(nodes, {
            scale: 2.4,
            opacity: 0,
            rotate: -28,
            duration: 0.42,
            ease: "back.out(2.2)",
            stagger: { each: 0.1, grid: [4, 5], from: "start", axis: "x" },
          }, 0.7)
          .from(".lp-trade", { opacity: 0, duration: 0.8 }, ">-0.2")
          .to(proxy, {
            p: 1,
            duration: 2.2,
            ease: "none",
            onUpdate: () => {
              setNums(proxy.p);
              if (count) count.textContent = String(Math.min(20, Math.round(Math.max(0, (proxy.p - 0.15) / 0.8) * 20)));
            },
          }, 0.8);
        if (!scrub) tl.timeScale(0.55);
      };
      const mm = gsap.matchMedia();
      mm.add("(min-width: 901px)", () => build(true));
      mm.add("(max-width: 900px)", () => build(false));
    }, el);
    return () => ctx.revert();
  }, []);

  const caption = tip ? `${LANES[tip.l].name}, step ${STEPS[tip.s]}: the root is stored on NEAR and the replay matches.` : "Hover or tab to a seal.";

  return (
    <section id="ledger" className="lp-stats" ref={ref} aria-label="The ledger so far">
      <div className="lp-stars" aria-hidden="true" />
      <div className="lp-stats-in">
        <h2 className="lp-h2">
          <span className="lp-seal-count" aria-hidden="true">20</span>
          <span className="lp-sr">Twenty</span> seals are already on the chain.
        </h2>
        <p className="lp-lede">Four worlds, five checkpoints each. Every seal holds the fingerprint of 40 seasons, and anyone can replay it.</p>

        <svg className="lp-lanes" viewBox="0 0 1000 350" role="group" aria-label="Four worlds across five checkpoints, 20 seals in total">
          {STEPS.map((s, j) => (
            <text key={s} className="lp-col-head" x={X0 + j * DX} y="26" textAnchor="middle">step {s}</text>
          ))}
          {LANES.map((l, i) => {
            const y = Y0 + i * DY;
            return (
              <g key={l.name} style={{ ["--lp-rgb" as string]: l.rgb }}>
                <text className="lp-lane-name" x="0" y={y + 5}>{l.name}</text>
                <line className="lp-lane-line" x1="200" x2="940" y1={y} y2={y} />
                {STEPS.map((s, j) => {
                  const cx = X0 + j * DX;
                  return (
                    <g
                      key={s}
                      className="lp-node"
                      tabIndex={0}
                      role="img"
                      aria-label={`${l.name}, step ${s}, sealed`}
                      data-on={tip?.l === i && tip?.s === j}
                      onPointerEnter={() => setTip({ l: i, s: j })}
                      onFocus={() => setTip({ l: i, s: j })}
                      onPointerLeave={() => setTip(null)}
                      onBlur={() => setTip(null)}
                    >
                      <path d={hexPath(cx, y, 22)} className="lp-node-hex" />
                      <path d={`M${cx - 7},${y + 1} l5,5 l9,-11`} className="lp-node-tick" />
                    </g>
                  );
                })}
              </g>
            );
          })}
          <g className="lp-trade" aria-hidden="true">
            <path id="lp-trade-a" d={`M${X0 + DX * 2},${Y0 + DY * 2} C${X0 + DX * 2 + 60},${Y0 + DY * 2 + 10} ${X0 + DX * 3 - 60},${Y0 + DY * 3 - 10} ${X0 + DX * 3},${Y0 + DY * 3}`} />
            <circle r="4"><animateMotion dur="5s" repeatCount="indefinite"><mpath href="#lp-trade-a" /></animateMotion></circle>
            <path id="lp-trade-b" d={`M${X0 + DX * 1},${Y0 + DY * 1} C${X0 + DX * 1 + 60},${Y0 + DY * 1 + 10} ${X0 + DX * 2 - 60},${Y0 + DY * 0 - 10} ${X0 + DX * 2},${Y0 + DY * 0}`} />
            <circle r="4"><animateMotion dur="6.5s" repeatCount="indefinite"><mpath href="#lp-trade-b" /></animateMotion></circle>
          </g>
        </svg>
        <p className="lp-lane-caption" aria-live="polite">{caption}</p>

        <dl className="lp-facts">
          {FACTS.map((f) => (
            <div key={f.label}>
              <dt className="lp-fnum" data-to={f.to}>{f.to.toLocaleString("en-US")}</dt>
              <dd>{f.label}</dd>
            </div>
          ))}
        </dl>
        <p className="lp-fine">Measured on the NEAR testnet build of 2026-11-04. Testnet only, no real funds.</p>
      </div>
    </section>
  );
}
