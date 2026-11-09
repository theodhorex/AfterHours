import React, { useId } from "react";

export type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

export interface LedgerPageProps {
  title: string | React.ReactNode;
  headingLevel?: HeadingLevel;
  id?: string;
  onClose?: () => void;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function LedgerPage({
  title,
  headingLevel = "h2",
  id: customId,
  onClose,
  headerRight,
  children,
  className = "",
}: LedgerPageProps) {
  const generatedId = useId();
  const headingId = customId || `ledger-title-${generatedId.replace(/:/g, "")}`;
  const HeadingTag = headingLevel;

  return (
    <section
      role="region"
      aria-labelledby={headingId}
      className={`ledger-page relative p-6 sm:p-8 ${className}`}
    >
      <header className="relative z-10 flex items-center justify-between gap-4 pb-4 border-b border-ledger-ink-faded/20 mb-6">
        <HeadingTag
          id={headingId}
          className="font-pixel text-xl sm:text-2xl text-ledger-ink font-bold leading-tight"
        >
          {title}
        </HeadingTag>

        <div className="flex items-center gap-2">
          {headerRight}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2.5 text-ledger-ink-faded hover:text-ledger-ink transition-colors cursor-pointer border border-ledger-ink-faded/30 bg-ledger-paper-shade/30 hover:bg-ledger-paper-shade/60 focus-visible:outline-2 focus-visible:outline-ledger-brass"
            >
              <span aria-hidden="true" className="font-pixel text-sm font-bold">✕</span>
            </button>
          )}
        </div>
      </header>

      <div className="relative z-10">{children}</div>
    </section>
  );
}

export default LedgerPage;
