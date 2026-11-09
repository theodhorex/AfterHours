"use client";

import { useState, type ReactNode } from "react";
import { AccountRoot } from "../../components/account/AccountRoot.tsx";
import { AtlasSidebar } from "../../components/atlas/AtlasSidebar.tsx";
import { AtlasTopbar } from "../../components/atlas/AtlasTopbar.tsx";

export default function AtlasLayout({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <AccountRoot>
      <div
        className="min-h-screen bg-atlas-canvas text-atlas-ink flex flex-col md:flex-row"
        style={{ "--atlas-topbar-height": "48px" } as React.CSSProperties}
      >
        {/* Left navigation sidebar & mobile drawer */}
        <AtlasSidebar
          isDrawerOpen={drawerOpen}
          onCloseDrawer={() => setDrawerOpen(false)}
        />

        {/* Content column with topbar */}
        <div className="flex-1 flex flex-col min-w-0">
          <AtlasTopbar
            onOpenDrawer={() => setDrawerOpen(true)}
            isDrawerOpen={drawerOpen}
          />
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
    </AccountRoot>
  );
}
