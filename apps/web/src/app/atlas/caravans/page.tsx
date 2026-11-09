import { CaravanPanel } from "../../../components/CaravanPanel.tsx";
import { LedgerPage } from "../../../components/ui/LedgerPage.tsx";
import { Icon } from "../../../components/ui/Icons.tsx";

export default function CaravansPage() {
  return (
    <main className="w-full mx-auto max-w-[1600px] p-4 sm:p-6 space-y-6">
      <LedgerPage
        title={
          <span className="flex items-center gap-2">
            <Icon name="caravan" size={20} className="text-ledger-brass" />
            <span>Caravans & Expeditions</span>
          </span>
        }
        headingLevel="h1"
      >
        <p className="font-mono text-sm text-ledger-ink leading-relaxed">
          Overland transport routes, hazard logistics, and caravan convoy dispatches across biomes live in this dispatch ledger.
        </p>
      </LedgerPage>

      <CaravanPanel />
    </main>
  );
}
