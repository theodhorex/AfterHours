import Link from "next/link";
import { LedgerPage } from "../../../components/ui/LedgerPage.tsx";
import { Icon } from "../../../components/ui/Icons.tsx";

export default function AuditPage() {
  return (
    <main className="w-full mx-auto max-w-[1600px] p-4 sm:p-6">
      <LedgerPage
        title={
          <span className="flex items-center gap-2">
            <Icon name="seal" size={20} className="text-ledger-brass" />
            <span>Audit & State Proofs</span>
          </span>
        }
        headingLevel="h1"
      >
        <div className="space-y-4 font-mono text-sm text-ledger-ink">
          <p className="leading-relaxed">
            Cryptographic state roots, checkpoint proofs, and tamper detection logs verify the mathematical honesty of the simulation.
          </p>
          <div className="p-4 border border-ledger-brass/40 bg-ledger-paper-shade/30 text-xs space-y-2">
            <p className="font-semibold text-ledger-ink">
              Live simulation audit requires active city state:
            </p>
            <p className="text-ledger-ink-faded">
              To verify and tamper-test running checkpoints in real time, inspect the Audit ledger tab directly inside{" "}
              <Link
                href="/atlas"
                className="text-ledger-ink font-bold underline hover:text-ledger-brass focus-visible:outline-2 focus-visible:outline-ledger-brass"
              >
                My city
              </Link>
              .
            </p>
          </div>
        </div>
      </LedgerPage>
    </main>
  );
}
