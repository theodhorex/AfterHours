"use client";

import { useEffect, useRef, useState } from "react";

const ROWS = [
  { step: 40, hash: "7c1e9ab403d2a94f" },
  { step: 80, hash: "e20841bd77c50e3a" },
  { step: 120, hash: "5fa9d610b2e419cc" },
  { step: 160, hash: "a3b76e02f8d14c55" },
  { step: 200, hash: "0d94cb3a2e71b6f8" },
];
const FLIP = "0123456789abcdef";

/** What the chain holds for a row. When tampered, one character differs. */
function stored(i: number, bad: number | null) {
  const h = ROWS[i].hash;
  if (bad !== i) return h;
  const at = 5 + (i % 4);
  return h.slice(0, at) + FLIP[(FLIP.indexOf(h[at]) + 7) % 16] + h.slice(at + 1);
}

const group = (h: string) => h.replace(/(.{4})/g, "$1 ").trim();

type Phase = "idle" | "scan" | "done";

export function Proof() {
  const [bad, setBad] = useState<number | null>(null);
  const [row, setRow] = useState(0);
  const [chars, setChars] = useState(16);
  const [phase, setPhase] = useState<Phase>("done");
  const timer = useRef<number | null>(null);

  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);

  const run = (broken: number | null) => {
    clear();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRow(broken ?? ROWS.length);
      setChars(16);
      setPhase("done");
      return;
    }
    setPhase("scan");
    const tick = (r: number, c: number) => {
      setRow(r);
      setChars(c);
      timer.current = window.setTimeout(() => {
        if (c < 16) return tick(r, c + 1);
        if (broken === r || r === ROWS.length - 1) {
          setRow(broken === r ? r : ROWS.length);
          setPhase("done");
          return;
        }
        tick(r + 1, 0);
      }, c < 16 ? 38 : 520);
    };
    tick(0, 0);
  };

  const toggle = (i: number) => {
    const next = bad === i ? null : i;
    setBad(next);
    run(next);
  };

  const resultOf = (i: number): "wait" | "scan" | "match" | "differs" | "skipped" => {
    if (phase === "scan") return i < row ? "match" : i === row ? "scan" : "wait";
    if (bad === null) return "match";
    return i < bad ? "match" : i === bad ? "differs" : "skipped";
  };

  const log =
    phase === "scan"
      ? `replaying from the seed... step ${ROWS[Math.min(row, ROWS.length - 1)].step}`
      : bad !== null
        ? `MISMATCH: new_state_root mismatch at step ${ROWS[bad].step}. The replay stops at the first season that differs.`
        : "VERIFIED: 5 checkpoints match the replay.";

  return (
    <section id="proof" className="lp-light lp-proof" aria-label="The proof">
      <div className="lp-wrap">
        <h2 className="lp-h2">Alter one character and the whole chronicle gives you away.</h2>
        <p className="lp-lede">The left page is what the chain stores. The right page is what the replay computes today. Press a row to tamper with it.</p>

        <div className="lp-book" data-bad={bad !== null}>
          <div className="lp-book-head" aria-hidden="true">
            <span>Stored on NEAR</span>
            <span>Replayed from the seed</span>
          </div>
          <ol className="lp-book-rows">
            {ROWS.map((r, i) => {
              const st = stored(i, bad);
              const res = resultOf(i);
              const show = res === "scan" ? chars : res === "wait" ? 0 : 16;
              return (
                <li key={r.step} data-res={res}>
                  <button type="button" className="lp-brow" onClick={() => toggle(i)} aria-pressed={bad === i} aria-label={`Step ${r.step}. ${bad === i ? "Tampered. Press to restore." : "Press to tamper with it."}`}>
                    <span className="lp-bstep">step {r.step}</span>
                    <code className="lp-bhash" data-tampered={bad === i}>
                      {group(st).split("").map((c, k) => {
                        const idx = k - Math.floor(k / 5);
                        const differs = res === "differs" && c !== " " && c !== r.hash[idx];
                        return <span key={k} className={differs ? "d" : undefined}>{c}</span>;
                      })}
                    </code>
                    <span className="lp-bgutter" aria-hidden="true" />
                    <code className="lp-bhash lp-bhash-r">
                      {group(r.hash).split("").map((c, k) => {
                        const idx = k - Math.floor(k / 5);
                        const hidden = idx >= show && c !== " ";
                        const differs = res === "differs" && c !== " " && c !== st[idx];
                        return <span key={k} className={differs ? "d" : hidden ? "h" : undefined}>{hidden ? "·" : c}</span>;
                      })}
                    </code>
                    <span className="lp-stamp" data-res={res} aria-hidden="true">
                      {res === "match" ? "sealed" : res === "differs" ? "void" : res === "skipped" ? "unread" : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="lp-blog" aria-live="polite" data-res={bad !== null && phase === "done" ? "bad" : "ok"}>{log}</p>
          <div className="lp-book-actions">
            <button type="button" className="lp-btn lp-btn-primary" data-magnet onClick={() => run(bad)}>Replay the audit</button>
            {bad !== null && <button type="button" className="lp-btn" onClick={() => toggle(bad)}>Restore the chronicle</button>}
            <p className="lp-fine">An illustration of the Audit panel, with example fingerprints. The real one replays the engine and reads the roots from NEAR.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
