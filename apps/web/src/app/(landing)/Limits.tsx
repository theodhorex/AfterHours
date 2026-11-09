const LIMITS = [
  { t: "Testnet only.", b: "This is a hackathon build on the NEAR testnet. No real money is involved.", rgb: "229,179,88" },
  { t: "The operator is still trusted.", b: "Anyone can verify the checkpoints, but nothing yet stops a dishonest operator from publishing a different world.", rgb: "240,127,79" },
  { t: "Some worlds struggle.", b: "A few cities are less happy than others, and some stop growing after a few hundred years. We report it instead of hiding it.", rgb: "184,157,245" },
];

export function Limits() {
  return (
    <section id="limits" className="lp-limits" aria-label="What is not solved yet">
      <div className="lp-wrap">
        <h2 className="lp-h2">Before you step through: what we have not solved.</h2>
        <ul className="lp-limit-list">
          {LIMITS.map((l) => (
            <li key={l.t} style={{ ["--lp-rgb" as string]: l.rgb }}>
              <h3>{l.t}</h3>
              <p>{l.b}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
