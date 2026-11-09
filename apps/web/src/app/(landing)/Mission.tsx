"use client";

import { useEffect, useRef } from "react";
import { gsap, noMotion } from "./gsap-setup.ts";

const LINES = [
  "Prices, scarcity, five hundred years of lore: it all lives in a database the studio can edit.",
  "When a city is sold, nothing shows what it really was.",
  "AfterEarth keeps the history as the product. Fixed rules, a known seed, and a blockchain that holds the proof.",
];

export function Mission() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || noMotion()) return;
    const ctx = gsap.context(() => {
      const words = gsap.utils.toArray<HTMLElement>(".lp-w");
      gsap.set(words, { opacity: 0.14 });
      gsap.to(words, {
        opacity: 1,
        ease: "none",
        stagger: 0.12,
        scrollTrigger: { trigger: ".lp-lit", start: "top 78%", end: "bottom 52%", scrub: 0.6 },
      });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <section id="mission" className="lp-light lp-mission" ref={ref}>
      <div className="lp-wrap">
        <h2 className="lp-h2">Most game worlds ask you to take their word for it.</h2>
        <div className="lp-lit">
          {LINES.map((l, i) => (
            <p key={i}>
              {l.split(" ").map((w, j) => (
                <span key={j} className="lp-w">{w} </span>
              ))}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
