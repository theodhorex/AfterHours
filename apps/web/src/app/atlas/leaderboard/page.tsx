import { LedgerPage } from "../../../components/ui/LedgerPage.tsx";
import { Icon } from "../../../components/ui/Icons.tsx";

export default function LeaderboardPage() {
  return (
    <main className="w-full mx-auto max-w-[1600px] p-4 sm:p-6">
      <LedgerPage
        title={
          <span className="flex items-center gap-2">
            <Icon name="scale" size={20} className="text-ledger-brass" />
            <span>Realm Leaderboard</span>
          </span>
        }
        headingLevel="h1"
      >
        <div className="space-y-4 font-mono text-sm text-ledger-ink">
          <p className="leading-relaxed">
            Settlement rankings, seasonal economic output, and mayor honor rolls across all realms will be inscribed on this tablet.
          </p>
          <div className="p-4 border border-ledger-ink-faded/20 bg-ledger-paper-shade/20 text-xs text-ledger-ink-faded">
            Rankings are recomputed at the end of each simulation quarter.
          </div>
        </div>
      </LedgerPage>
    </main>
  );
}
