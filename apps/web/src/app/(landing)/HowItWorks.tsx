"use client";

import { useEffect, useRef } from "react";
import { gsap, noMotion } from "./gsap-setup.ts";

const STEPS = [
  { n: "I", title: "The cities live", body: "Farmers grow grain, millers grind it, bakers make bread. Citizens eat, shops hire, some go broke and new ones open. One step is one season." },
  { n: "II", title: "History is sealed", body: "Every 40 seasons the world writes a short fingerprint of everything that happened and stores it on the NEAR blockchain." },
  { n: "III", title: "Anyone can replay it", body: "Start from the same seed, run the same rules, get the same fingerprint. If it differs, the exact season that changed is named." },
  { n: "IV", title: "Cities can change hands", body: "A city is sold with escrow, so the buyer pays for history that was proven, not for a claim." },
];

const HASH = "7c1e 9ab4 03d2 a94f 5be7 88c0";
const HEX = "0123456789abcdef";
const ARC = ["#f07f4f", "#e5b358", "#6bc785", "#b89df5"];
const N = 40;
const xAt = (i: number) => 20 + i * 19.5;

function scramble(el: SVGTextElement | null, p: number) {
  if (!el) return;
  const shown = Math.floor(p * HASH.length);
  el.textContent = HASH.split("").map((c, i) => (c === " " ? " " : i < shown ? c : HEX[(i * 7 + Math.floor(p * 40) * 3) % 16])).join("");
}

export function HowItWorks() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const q = <T extends Element>(s: string) => Array.from(el.querySelectorAll<T>(s));
    const h1 = el.querySelector<SVGTextElement>(".ex-h1");
    const h2 = el.querySelector<SVGTextElement>(".ex-h2");
    const mq = noMotion();

    const build = (pin: boolean) => {
      const r1 = q<SVGRectElement>(".ex-r1 rect");
      const r2 = q<SVGRectElement>(".ex-r2 rect");
      const p1 = { v: 0 };
      const p2 = { v: 0 };
      scramble(h1, 0);
      scramble(h2, 0);
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: pin
          ? {
              trigger: el, start: "top top", end: "+=320%", pin: true, scrub: 0.6,
              onUpdate: (self) => {
                const p = self.progress;
                el.dataset.step = String(p < 0.3 ? 0 : p < 0.5 ? 1 : p < 0.86 ? 2 : 3);
              },
            }
          : undefined,
        paused: !pin,
      });
      tl.to(r1, { fill: (i: number) => ARC[Math.floor(i / 10)], stagger: 0.07, duration: 0.1 }, 0)
        .to(r1, { x: (i: number) => 390 - xAt(i), opacity: 0, stagger: { amount: 0.7, from: "edges" }, duration: 0.5, ease: "power2.in" }, 3.2)
        .to(p1, { v: 1, duration: 1.2, onUpdate: () => scramble(h1, p1.v) }, 3.6)
        .fromTo(".ex-seal", { scale: 2.4, opacity: 0, rotate: -30 }, { scale: 1, opacity: 1, rotate: 0, duration: 0.5, ease: "back.out(2)" }, 4.5)
        .fromTo(".ex-chain", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6 }, 4.9)
        .to(".ex-seal", { y: 108, scale: 0.55, duration: 0.8, ease: "power2.inOut" }, 5.6)
        .to(".ex-b3", { stroke: "#e5b358", fill: "rgba(229,179,88,.16)", duration: 0.4 }, 6.2)
        .to(r2, { fill: (i: number) => ARC[Math.floor(i / 10)], stagger: 0.05, duration: 0.1 }, 6.6)
        .to(p2, { v: 1, duration: 1.2, onUpdate: () => scramble(h2, p2.v) }, 8.2)
        .to([h1, h2], { fill: "#6bc785", duration: 0.4 }, 9.4)
        .fromTo(".ex-verdict", { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2)" }, 9.5)
        .fromTo(".ex-sale", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6 }, 10.3)
        .to({}, { duration: 0.8 });
      if (!pin || mq) tl.progress(1);
      if (!pin) el.dataset.step = "all";
      return tl;
    };

    const ctx = gsap.context(() => {
      if (mq) {
        build(false);
        el.dataset.step = "all";
        return;
      }
      const mm = gsap.matchMedia();
      mm.add("(min-width: 901px)", () => {
        el.dataset.step = "0";
        build(true);
      });
      mm.add("(max-width: 900px)", () => {
        el.dataset.step = "all";
        build(false);
      });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <section id="how" className="lp-ex" ref={root} data-step="all" aria-label="How a season becomes proof">
      <div className="lp-ex-grid">
        <div className="lp-ex-text">
          <h2 className="lp-h2">How a season becomes proof.</h2>
          <ol className="lp-ex-steps">
            {STEPS.map((s, i) => (
              <li key={s.n} data-i={i}>
                <span className="lp-ex-n" aria-hidden="true">{s.n}</span>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="lp-law">Nothing appears from nowhere. Every loaf eaten was baked and every coin spent was earned, or the contract rejects the season.</p>
        </div>

        <svg className="lp-ex-svg" viewBox="0 0 800 640" role="img" aria-label="Forty seasons collapse into a fingerprint, the fingerprint is sealed on the chain, and a replay from the seed produces the same fingerprint.">
          <text className="ex-cap" x="20" y="24">the world, season by season</text>
          <g className="ex-r1">
            {Array.from({ length: N }, (_, i) => (
              <rect key={i} x={xAt(i)} y="38" width="15" height="24" rx="2.5" fill="#2a2440" />
            ))}
          </g>
          <text className="ex-hash ex-h1" x="400" y="140" textAnchor="middle">{HASH}</text>
          <text className="ex-cap ex-cap-c" x="400" y="162" textAnchor="middle">the fingerprint of 40 seasons (an example)</text>

          <g className="ex-chain">
            <line x1="190" x2="610" y1="318" y2="318" className="ex-link" />
            <rect className="ex-b" x="150" y="290" width="90" height="56" rx="6" />
            <rect className="ex-b" x="355" y="290" width="90" height="56" rx="6" />
            <rect className="ex-b ex-b3" x="560" y="290" width="90" height="56" rx="6" />
            <text className="ex-cap ex-cap-c" x="605" y="372" textAnchor="middle">NEAR</text>
          </g>
          <g className="ex-seal" style={{ transformOrigin: "400px 230px" }}>
            <circle cx="400" cy="230" r="36" fill="#7a2b1f" stroke="#e5b358" strokeWidth="3" />
            <path d="M400,206 l21,12 v24 l-21,12 l-21,-12 v-24z" fill="none" stroke="#e5b358" strokeWidth="2.2" />
            <path d="M392,220h16M392,230h11M392,240h16M392,220v20" fill="none" stroke="#f0e6d2" strokeWidth="2.6" strokeLinecap="round" />
          </g>

          <text className="ex-cap" x="20" y="418">replayed from the seed, by anyone</text>
          <g className="ex-r2">
            {Array.from({ length: N }, (_, i) => (
              <rect key={i} x={xAt(i)} y="432" width="15" height="24" rx="2.5" fill="#2a2440" />
            ))}
          </g>
          <text className="ex-hash ex-h2" x="400" y="520" textAnchor="middle">{HASH}</text>

          <g className="ex-verdict">
            <circle cx="400" cy="578" r="20" fill="rgba(107,199,133,.18)" stroke="#6bc785" strokeWidth="2.5" />
            <path d="M390,578 l7,7 l14,-16" fill="none" stroke="#6bc785" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            <text className="ex-cap ex-ok" x="432" y="584">same fingerprint, nothing was changed</text>
          </g>
          <g className="ex-sale">
            <rect x="500" y="236" width="268" height="34" rx="17" fill="rgba(229,179,88,.14)" stroke="#e5b358" strokeWidth="1.5" />
            <text className="ex-cap ex-sale-t" x="634" y="258" textAnchor="middle">city for sale: escrow, released on a match</text>
          </g>
        </svg>
      </div>
    </section>
  );
}
