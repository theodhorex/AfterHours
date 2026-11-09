"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "../../lib/account/context.tsx";
import { getBreadcrumbs } from "../../lib/atlas-nav.ts";

export interface AtlasTopbarProps {
  onOpenDrawer?: () => void;
  isDrawerOpen?: boolean;
  className?: string;
}

export function AtlasTopbar({
  onOpenDrawer,
  isDrawerOpen = false,
  className = "",
}: AtlasTopbarProps) {
  const pathname = usePathname();
  const { status, profile, accountId, connect, disconnect } = useAccount();
  const crumbs = getBreadcrumbs(pathname);

  // Derive account display name
  const displayName =
    profile?.username ||
    (accountId ? `${accountId.slice(0, 8)}…${accountId.slice(-4)}` : "Citizen");

  return (
    <header
      className={`sticky top-0 z-20 h-12 bg-ledger-night text-ledger-paper border-b border-ledger-brass/40 flex items-center justify-between px-3 sm:px-6 select-none ${className}`}
    >
      {/* Left: Mobile Drawer Button & Breadcrumbs */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile menu toggle button */}
        <button
          type="button"
          onClick={onOpenDrawer}
          aria-expanded={isDrawerOpen}
          aria-label="Open navigation menu"
          className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center text-ledger-paper/80 hover:text-ledger-paper hover:bg-ledger-twilight border border-ledger-twilight focus-visible:outline-2 focus-visible:outline-ledger-brass cursor-pointer -ml-1"
        >
          <svg
            className="w-4 h-4 fill-current"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <rect y="2" width="16" height="2" />
            <rect y="7" width="16" height="2" />
            <rect y="12" width="16" height="2" />
          </svg>
        </button>

        {/* Breadcrumb landmark */}
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex items-center gap-1.5 font-mono text-xs text-ledger-paper/75 truncate">
            {crumbs.map((crumb, idx) => (
              <li key={crumb.href} className="flex items-center gap-1.5 shrink-0">
                {idx > 0 && (
                  <span
                    aria-hidden="true"
                    className="text-ledger-paper/40 select-none"
                  >
                    /
                  </span>
                )}
                {crumb.isCurrent ? (
                  <span
                    aria-current="page"
                    className="font-bold text-ledger-paper"
                  >
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="text-ledger-paper/70 hover:text-ledger-paper transition-colors focus-visible:outline-2 focus-visible:outline-ledger-brass"
                  >
                    {crumb.label}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {/* Right: Account Chip */}
      <div className="flex items-center gap-2 shrink-0 ml-3">
        {status === "loading" && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 px-3 py-1.5 border border-ledger-twilight bg-ledger-twilight/40 font-mono text-xs text-ledger-paper/80"
          >
            <span
              className="inline-block w-2 h-2 rounded-full bg-ledger-brass animate-pulse"
              aria-hidden="true"
            />
            <span>Connecting…</span>
          </div>
        )}

        {status === "signed-in" && (
          <div className="flex items-center gap-2 border border-ledger-brass/40 bg-ledger-twilight/50 pl-2.5 pr-1 py-0.5 font-mono text-xs">
            <span
              className="text-ledger-paper font-semibold max-w-[110px] sm:max-w-[160px] truncate"
              title={accountId ?? undefined}
            >
              {displayName}
            </span>
            <button
              type="button"
              onClick={() => disconnect()}
              aria-label="Disconnect wallet"
              className="min-h-[44px] px-2.5 py-1 text-ledger-paper/80 hover:text-ledger-paper hover:bg-ledger-twilight border border-ledger-twilight focus-visible:outline-2 focus-visible:outline-ledger-brass cursor-pointer transition-colors"
            >
              Disconnect
            </button>
          </div>
        )}

        {status === "signed-out" && (
          <button
            type="button"
            onClick={() => connect()}
            className="min-h-[44px] px-3.5 py-1.5 font-mono text-xs font-semibold bg-ledger-brass text-ledger-night hover:bg-ledger-brass/90 border border-ledger-brass focus-visible:outline-2 focus-visible:outline-ledger-paper cursor-pointer transition-colors"
          >
            Connect wallet
          </button>
        )}
      </div>
    </header>
  );
}

export default AtlasTopbar;
