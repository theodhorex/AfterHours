"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type MouseEvent, type RefObject } from "react";
import { gsap, noMotion } from "./gsap-setup.ts";

type Fly = { x: number; y: number; vx: number; vy: number; r: number; ph: number; c: string; life: number };
const COLORS = ["240,127,79", "229,179,88", "107,199,133", "184,157,245"];

function Fireflies({ host }: { host: RefObject<HTMLElement | null> }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    const sec = host.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !sec || !ctx) return;
    const reduce = noMotion();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0;
    const mouse = { x: -999, y: -999 };
    const mk = (x?: number, y?: number, burst = false): Fly => ({
      x: x ?? Math.random() * w,
      y: y ?? Math.random() * h,
      vx: burst ? (Math.random() - 0.5) * 320 : (Math.random() - 0.5) * 16,
      vy: burst ? (Math.random() - 0.5) * 320 : (Math.random() - 0.5) * 16,
      r: 1.6 + Math.random() * 2.4,
      ph: Math.random() * 6.28,
      c: COLORS[Math.floor(Math.random() * 4)],
      life: burst ? 3.2 : 1e9,
    });
    let fl: Fly[] = [];
    const resize = () => {
      const b = sec.getBoundingClientRect();
      w = b.width;
      h = b.height;
      cv.width = w * dpr;
      cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fl = Array.from({ length: w < 700 ? 28 : 56 }, () => mk());
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(sec);
    const move = (e: PointerEvent) => {
      const b = sec.getBoundingClientRect();
      mouse.x = e.clientX - b.left;
      mouse.y = e.clientY - b.top;
    };
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("a,button")) return;
      const b = sec.getBoundingClientRect();
      for (let i = 0; i < 24; i++) fl.push(mk(e.clientX - b.left, e.clientY - b.top, true));
    };
    sec.addEventListener("pointermove", move);
    sec.addEventListener("pointerdown", down);

    const draw = (now: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const f of fl) {
        const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now * 0.002 + f.ph));
        ctx.beginPath();
        ctx.fillStyle = `rgba(${f.c},${a})`;
        ctx.shadowColor = `rgba(${f.c},.9)`;
        ctx.shadowBlur = 14;
        ctx.arc(f.x, f.y, f.r, 0, 6.28);
        ctx.fill();
      }
    };
    let raf = 0, last = performance.now(), vis = true;
    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      for (let i = fl.length - 1; i >= 0; i--) {
        const f = fl[i];
        const dx = f.x - mouse.x, dy = f.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 150 * 150 && d2 > 1) {
          const d = Math.sqrt(d2), k = (1 - d / 150) * 640;
          f.vx += (dx / d) * k * dt;
          f.vy += (dy / d) * k * dt;
        }
        f.vx += (Math.sin(now * 0.0007 + f.ph) * 10 - f.vx) * (1 - Math.exp(-dt * 0.9));
        f.vy += (Math.cos(now * 0.0006 + f.ph) * 8 - f.vy) * (1 - Math.exp(-dt * 0.9));
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (f.x < -20) f.x = w + 20;
        if (f.x > w + 20) f.x = -20;
        if (f.y < -20) f.y = h + 20;
        if (f.y > h + 20) f.y = -20;
        f.life -= dt;
        if (f.life < 0) fl.splice(i, 1);
      }
      draw(now);
      if (vis && !reduce) raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver((e) => {
      vis = e.some((x) => x.isIntersecting);
      if (vis && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    });
    io.observe(sec);
    draw(0);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      sec.removeEventListener("pointermove", move);
      sec.removeEventListener("pointerdown", down);
    };
  }, [host]);

  return <canvas ref={ref} className="lp-flies" aria-hidden="true" />;
}

export function Cta({ contract }: { contract: string }) {
  const ref = useRef<HTMLElement>(null);
  const router = useRouter();

  useEffect(() => {
    const el = ref.current;
    if (!el || noMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(".lp-horizon", { yPercent: 18 }, { yPercent: 0, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "center center", scrub: true } });
      gsap.from(".lp-cta-title span", { yPercent: 110, rotate: 4, duration: 1.1, ease: "power4.out", stagger: 0.12, scrollTrigger: { trigger: el, start: "top 60%", once: true } });
      gsap.from(".lp-portal-wrap", { scale: 0.6, opacity: 0, duration: 1.2, ease: "back.out(1.5)", scrollTrigger: { trigger: el, start: "top 45%", once: true } });
    }, el);
    return () => ctx.revert();
  }, []);

  const tilt = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    e.currentTarget.style.setProperty("--tx", String(x));
    e.currentTarget.style.setProperty("--ty", String(y));
  };

  const enter = (e: MouseEvent<HTMLAnchorElement>) => {
    if (noMotion() || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    const tl = gsap.timeline({ onComplete: () => router.push("/") });
    tl.to(".lp-portal", { scale: 24, duration: 1.05, ease: "power3.in" }, 0)
      .to(".lp-portal-label, .lp-cta-title, .lp-cta-sub, .lp-cta-links", { opacity: 0, duration: 0.35 }, 0)
      .to(".lp-warp", { opacity: 1, duration: 0.7, ease: "power2.in" }, 0.35);
  };

  return (
    <section className="lp-cta" ref={ref} aria-label="Enter the atlas">
      <div className="lp-cta-sky" aria-hidden="true" />
      <Fireflies host={ref} />
      <div className="lp-horizon" aria-hidden="true" />
      <div className="lp-cta-in">
        <h2 className="lp-cta-title" aria-label="Step through.">
          <span aria-hidden="true">Step</span> <span aria-hidden="true">through.</span>
        </h2>
        <p className="lp-cta-sub">Open the atlas, fast-forward a city, then audit it against the roots stored on NEAR.</p>
        <div className="lp-portal-wrap" onPointerMove={tilt}>
          <Link className="lp-portal" href="/atlas" onClick={enter} aria-label="Open the atlas">
            <svg viewBox="-210 -210 420 420" aria-hidden="true">
              <g className="lp-p-a"><circle r="190" fill="none" stroke="rgba(240,230,210,.4)" strokeWidth="1" strokeDasharray="2 10" /></g>
              <g className="lp-p-b">
                {Array.from({ length: 72 }, (_, i) => (
                  <line key={i} x1="0" y1={i % 6 === 0 ? -168 : -174} x2="0" y2="-180" stroke="rgba(229,179,88,.75)" strokeWidth="1.2" transform={`rotate(${i * 5})`} />
                ))}
              </g>
              <circle r="150" fill="none" stroke="rgba(240,230,210,.25)" strokeWidth="1" />
            </svg>
            <span className="lp-portal-label">Open the atlas</span>
          </Link>
        </div>
        <p className="lp-cta-links"><a href={contract}>or read the contract on testnet</a></p>
      </div>
      <div className="lp-warp" aria-hidden="true" />
    </section>
  );
}
