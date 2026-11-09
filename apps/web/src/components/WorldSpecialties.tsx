import React from "react";
import { getSpecialties, type WorldProfile } from "../lib/specialties.ts";

export interface WorldSpecialtiesProps {
  arcId: string;
  profile?: WorldProfile;
  className?: string;
}

export function WorldSpecialties({
  arcId,
  profile: propProfile,
  className = "",
}: WorldSpecialtiesProps) {
  const profile = propProfile ?? getSpecialties(arcId);

  return (
    <article
      aria-label={`${profile.name} specialties`}
      className={`border border-ledger-ink-faded/30 bg-ledger-paper/60 p-4 sm:p-5 text-ledger-ink rounded-xs ${className}`}
    >
      <header className="border-b border-ledger-ink-faded/20 pb-3 mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-display text-base sm:text-lg font-bold text-ledger-ink tracking-wide">
            {profile.name} Realm Profile
          </h3>
          <p className="font-body text-xs text-ledger-ink-faded mt-0.5">
            Regional economic traits and trade specialties on server {profile.server}.
          </p>
        </div>
        <span className="font-mono text-xs text-ledger-ink-faded border border-ledger-ink-faded/30 px-2 py-0.5 bg-ledger-paper-shade/30">
          id: {profile.arcId}
        </span>
      </header>

      {/* Signature Goods */}
      <section className="mb-4">
        <h4 className="font-silk text-xs font-semibold text-ledger-ink-faded mb-2">
          Signature goods (realm exclusive)
        </h4>
        <ul role="list" className="space-y-2">
          {profile.signatureGoods.map((item) => (
            <li
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 p-2 bg-ledger-paper-shade/30 border border-ledger-ink-faded/20"
            >
              <div className="flex items-center gap-2">
                <span className="font-body font-bold text-sm text-ledger-ink">
                  {item.name}
                </span>
                {item.tier && (
                  <span className="font-mono text-[10px] text-ledger-ink-faded px-1.5 py-0.2 border border-ledger-ink-faded/20 bg-ledger-paper/50">
                    {item.tier}
                  </span>
                )}
              </div>
              <p className="font-body text-xs text-ledger-ink-faded sm:text-right max-w-sm">
                {item.reason}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Strong at */}
        <section>
          <h4 className="font-silk text-xs font-semibold text-ledger-ink-faded mb-2 flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="w-2 h-2 rounded-full bg-ledger-verdigris inline-block"
            />
            Strong at (production advantage)
          </h4>
          <ul role="list" className="space-y-2">
            {profile.strongAt.map((item) => (
              <li
                key={item.id}
                className="p-2.5 bg-ledger-paper-shade/20 border border-ledger-ink-faded/20"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-body font-bold text-sm text-ledger-ink">
                    {item.name}
                  </span>
                  {item.basePrice !== undefined && (
                    <span className="font-mono text-xs text-ledger-ink-faded">
                      {item.basePrice} coin base
                    </span>
                  )}
                </div>
                <p className="font-body text-xs text-ledger-ink-faded leading-relaxed">
                  {item.reason}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* Weak at / Must import */}
        <section>
          <h4 className="font-silk text-xs font-semibold text-ledger-ink-faded mb-2 flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="w-2 h-2 rounded-full bg-ledger-wax inline-block"
            />
            Weak at (must import)
          </h4>
          <ul role="list" className="space-y-2">
            {profile.weakAt.map((item) => (
              <li
                key={item.id}
                className="p-2.5 bg-ledger-paper-shade/20 border border-ledger-ink-faded/20"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-body font-bold text-sm text-ledger-ink">
                    {item.name}
                  </span>
                  {item.basePrice !== undefined && (
                    <span className="font-mono text-xs text-ledger-ink-faded">
                      {item.basePrice} coin base
                    </span>
                  )}
                </div>
                <p className="font-body text-xs text-ledger-ink-faded leading-relaxed">
                  {item.reason}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </article>
  );
}

export default WorldSpecialties;
