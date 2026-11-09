"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger, noMotion } from "./gsap-setup.ts";

/** Page-wide behaviour: smooth scroll, reading progress, a lantern that follows the cursor, magnetic buttons. */
export function Smooth() {
  const bar = useRef<HTMLDivElement>(null);
  const lantern = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = noMotion();
    let lenis: Lenis | null = null;
    let tick: ((t: number) => void) | null = null;

    if (!reduce) {
      lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
      lenis.on("scroll", ScrollTrigger.update);
      tick = (t: number) => lenis?.raf(t * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    }

    const onAnchor = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const id = a.getAttribute("href");
      const t = id && id.length > 1 ? document.querySelector(id) : null;
      if (!t) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(t as HTMLElement, { duration: 1.6, offset: 0 });
      else (t as HTMLElement).scrollIntoView();
    };
    document.addEventListener("click", onAnchor);

    const progress = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        if (bar.current) bar.current.style.transform = `scaleX(${self.progress})`;
      },
    });

    const fine = window.matchMedia("(pointer: fine)").matches && !reduce;
    const cleanups: Array<() => void> = [];
    if (fine && lantern.current) {
      const lx = gsap.quickTo(lantern.current, "x", { duration: 0.6, ease: "power3" });
      const ly = gsap.quickTo(lantern.current, "y", { duration: 0.6, ease: "power3" });
      const mv = (e: PointerEvent) => {
        lx(e.clientX);
        ly(e.clientY);
      };
      window.addEventListener("pointermove", mv, { passive: true });
      lantern.current.style.opacity = "1";
      cleanups.push(() => window.removeEventListener("pointermove", mv));

      document.querySelectorAll<HTMLElement>("[data-magnet]").forEach((el) => {
        const mx = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3" });
        const my = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3" });
        const move = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          mx((e.clientX - (r.left + r.width / 2)) * 0.28);
          my((e.clientY - (r.top + r.height / 2)) * 0.4);
        };
        const leave = () => {
          mx(0);
          my(0);
        };
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerleave", leave);
        cleanups.push(() => {
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerleave", leave);
        });
      });
    }

    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("load", refresh);
    const t = window.setTimeout(refresh, 400);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener("load", refresh);
      document.removeEventListener("click", onAnchor);
      progress.kill();
      cleanups.forEach((f) => f());
      if (tick) gsap.ticker.remove(tick);
      lenis?.destroy();
    };
  }, []);

  return (
    <>
      <div className="lp-progress" aria-hidden="true"><div ref={bar} /></div>
      <div className="lp-lantern" ref={lantern} aria-hidden="true" />
    </>
  );
}
