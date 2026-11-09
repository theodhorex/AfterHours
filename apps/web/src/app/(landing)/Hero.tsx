"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger, noMotion } from "./gsap-setup.ts";
import { Planet3D, type MoonTip } from "./Planet3D.tsx";

type Stage = { id: string; label: string; word: string; kicker: string; body: string; rgb: [number, number, number] };

export const STAGES: Stage[] = [
  { id: "warrens", label: "Goblin Warrens", word: "Goblin Warrens", kicker: "Smoke, scrap and mushroom farms", body: "A crowded burrow where every forge fire and every loaf of cave-bread is counted.", rgb: [240, 127, 79] },
  { id: "hold", label: "Cave Hold", word: "Cave Hold", kicker: "Deep stone, slow gold", body: "Dwarf-hewn halls under the mountain. Miners dig, smiths shape, and the coin never stops moving.", rgb: [229, 179, 88] },
  { id: "vale", label: "Dino Vale", word: "Dino Vale", kicker: "Wide plains, heavy harvests", body: "Great beasts plough the grain fields. The Vale bakes more bread than it can eat and ships the rest.", rgb: [107, 199, 133] },
  { id: "grove", label: "Elf Grove", word: "Elf Grove", kicker: "Quiet woods, careful magic", body: "Alchemists brew in lantern light. Rare goods leave the Grove by caravan and return as grain.", rgb: [184, 157, 245] },
  { id: "beyond", label: "The ledger", word: "the Ledger", kicker: "History that cannot be edited", body: "Every season is sealed on the NEAR blockchain. Replay any world from its seed and watch it match.", rgb: [120, 214, 200] },
];

const STAGE_MS = 9000;

function Chars({ text, base = 0 }: { text: string; base?: number }) {
  let n = base;
  return (
    <>
      {text.split(" ").map((word, w, all) => (
        <span key={w}>
          <span className="lp-word" aria-hidden="true">
            {word.split("").map((c) => (
              <span key={n} className="lp-ch" style={{ ["--i" as string]: n++ }}>{c}</span>
            ))}
          </span>
          {w < all.length - 1 && " "}
        </span>
      ))}
      <span className="lp-sr">{text}</span>
    </>
  );
}

export function Hero() {
  const [stage, setStage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [tip, setTip] = useState<MoonTip>(null);
  const root = useRef<HTMLElement | null>(null);
  const scrollRef = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      setReduced(mq.matches);
      if (mq.matches) setPaused(true);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // scroll choreography: the planet swells toward you while the title lifts away
  useEffect(() => {
    const el = root.current;
    if (!el || noMotion()) return;
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: el,
        start: "top top",
        end: "bottom top",
        scrub: true,
        onUpdate: (self) => {
          scrollRef.current = self.progress;
        },
      });
      gsap.to(".lp-center", { yPercent: -38, opacity: 0, ease: "none", scrollTrigger: { trigger: el, start: "top top", end: "70% top", scrub: true } });
      gsap.to(".lp-caption, .lp-steps", { y: 60, opacity: 0, ease: "none", scrollTrigger: { trigger: el, start: "30% top", end: "75% top", scrub: true } });
    }, el);
    return () => ctx.revert();
  }, []);

  const pick = useCallback((i: number) => setStage(i), []);
  const s = STAGES[stage];
  const running = !paused && !reduced;

  return (
    <section
      ref={root}
      className="lp-hero"
      aria-roledescription="carousel"
      aria-label="The worlds of AfterEarth"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ["--lp-rgb" as string]: s.rgb.join(",") }}
    >
      <div className="lp-bg" aria-hidden="true">
        <div className="lp-bg-glow" />
        <Planet3D stage={stage} scrollRef={scrollRef} hostRef={root} onPick={pick} onTip={setTip} />
        <div className="lp-vignette" />
      </div>
      {tip && (
        <div className="lp-moontip" style={{ left: tip.x, top: tip.y }} aria-hidden="true">
          {STAGES[tip.i].label}
        </div>
      )}

      <header className="lp-top">
        <Link href="/" className="lp-logo" aria-label="AfterEarth home">
          <span className="lp-logo-mark" aria-hidden="true" />
          AfterEarth
        </Link>
        <nav className="lp-pill" aria-label="Main">
          <a href="#mission">Why</a>
          <a href="#arcs">Worlds</a>
          <a href="#how">How</a>
          <a href="#proof">Proof</a>
        </nav>
        <Link href="/atlas" className="lp-enter" data-magnet>Enter the atlas</Link>
      </header>

      <div className="lp-center">
        <h1 className="lp-title">
          <span className="lp-t-left"><Chars text="The living map" /></span>
          <span className="lp-t-mid">of</span>
          <span className="lp-t-right" key={s.id}><Chars text={s.word} base={4} /></span>
        </h1>
        <p className="lp-hint">Drag the planet. Click a moon.</p>
      </div>

      <div className="lp-caption" aria-live={running ? "off" : "polite"} aria-atomic="true">
        <p className="lp-kicker" key={`k-${s.id}`}>{s.kicker}</p>
        <p className="lp-body" key={`b-${s.id}`}>{s.body}</p>
      </div>

      <div className="lp-steps" data-nodrag>
        <ol className="lp-steps-list">
          {STAGES.map((st, i) => (
            <li key={st.id}>
              <button type="button" className="lp-step" aria-current={i === stage ? "true" : undefined} onClick={() => setStage(i)}>
                <span className="lp-step-bar" aria-hidden="true">
                  {i === stage && (
                    <span
                      key={`${stage}-${running}`}
                      className="lp-step-fill"
                      data-run={running}
                      style={{ animationDuration: `${STAGE_MS}ms`, animationPlayState: hover ? "paused" : "running" }}
                      onAnimationEnd={() => setStage((p) => (p + 1) % STAGES.length)}
                    />
                  )}
                </span>
                <span className="lp-step-label">{st.label}</span>
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className="lp-pause" onClick={() => setPaused((p) => !p)} aria-pressed={paused} data-magnet>
          {running ? "Pause" : "Play"}
        </button>
      </div>
    </section>
  );
}
