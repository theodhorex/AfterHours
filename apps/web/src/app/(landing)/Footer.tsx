"use client";

import { useEffect, useRef, useState } from "react";

const WORD = "AfterEarth".split("");

export function Footer({ github, contract }: { github: string; contract: string }) {
  const ref = useRef<HTMLElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => {
      if (e.some((x) => x.isIntersecting)) {
        setOn(true);
        io.disconnect();
      }
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <footer className="lp-footer" ref={ref} data-on={on}>
      <div className="lp-foot-top">
        <p className="lp-foot-note">Built for the NEAR Hackathon, Games with Real Economies. Testnet only.</p>
        <nav aria-label="Footer" className="lp-footer-links">
          <a href="#arcs">Worlds</a>
          <a href="#how">How it works</a>
          <a href="#proof">Proof</a>
          <a href={github}>GitHub</a>
          <a href={contract}>Contract</a>
          <a href="#top" data-magnet>Back to orbit</a>
        </nav>
      </div>
      <p className="lp-wordmark" aria-label="AfterEarth">
        {WORD.map((c, i) => (
          <span key={i} aria-hidden="true" style={{ transitionDelay: `${i * 60}ms` }}>{c}</span>
        ))}
      </p>
    </footer>
  );
}
