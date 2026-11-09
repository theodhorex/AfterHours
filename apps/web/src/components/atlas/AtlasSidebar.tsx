"use client";

import { useState, useEffect, useRef, useId, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "../ui/Icons.tsx";
import {
  NAV_GROUPS,
  FOOTER_NAV_ITEM,
  isActiveNav,
  filterNavGroups,
  type NavItem,
} from "../../lib/atlas-nav.ts";
import { useAccount } from "../../lib/account/context.tsx";

export interface AtlasSidebarProps {
  isDrawerOpen?: boolean;
  onCloseDrawer?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

const STORAGE_KEY = "atlas-sidebar-collapsed";

function subscribeToStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getStoredCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function getServerCollapsed(): boolean {
  return false;
}

export function AtlasSidebar({
  isDrawerOpen: propDrawerOpen,
  onCloseDrawer,
  isCollapsed: propCollapsed,
  onToggleCollapse,
  className = "",
}: AtlasSidebarProps) {
  const pathname = usePathname();
  const { status } = useAccount();
  const isAuthenticated = status === "signed-in";

  // Use sync external store for stable SSR and localStorage synchronization
  const storedCollapsed = useSyncExternalStore(
    subscribeToStorage,
    getStoredCollapsed,
    getServerCollapsed
  );

  const isCollapsed = propCollapsed !== undefined ? propCollapsed : storedCollapsed;

  // Search filter query
  const [searchQuery, setSearchQuery] = useState("");

  // Refs for accessibility & focus trapping
  const drawerRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const searchInputId = useId();

  const handleToggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      const next = !isCollapsed;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
        window.dispatchEvent(new Event("storage"));
      } catch {
        // Ignore storage write errors
      }
    }
  };

  // Close drawer on route change
  useEffect(() => {
    if (propDrawerOpen && onCloseDrawer) {
      onCloseDrawer();
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard accessibility & focus trap for mobile drawer
  useEffect(() => {
    if (!propDrawerOpen) {
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
      return;
    }

    // Save current active element
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Focus first interactive element inside drawer
    const focusTimer = setTimeout(() => {
      const focusables = drawerRef.current?.querySelectorAll<HTMLElement>(
        'input, button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      );
      if (focusables && focusables.length > 0) {
        focusables[0].focus();
      }
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseDrawer?.();
        return;
      }

      if (e.key === "Tab") {
        const focusables = drawerRef.current?.querySelectorAll<HTMLElement>(
          'input, button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables || focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [propDrawerOpen, onCloseDrawer]);

  const filteredGroups = filterNavGroups(NAV_GROUPS, searchQuery, isAuthenticated);

  const renderNavItem = (item: NavItem, collapsed: boolean) => {
    const active = isActiveNav(pathname, item.href);

    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          title={collapsed ? item.label : undefined}
          className={`group flex items-center min-h-[44px] px-3 py-2 text-xs font-mono transition-colors focus-visible:outline-2 focus-visible:outline-ledger-brass focus-visible:outline-offset-2 ${
            collapsed ? "justify-center" : "gap-3"
          } ${
            active
              ? "bg-ledger-twilight/90 text-ledger-paper font-semibold"
              : "text-ledger-paper/75 hover:text-ledger-paper hover:bg-ledger-twilight/40"
          }`}
        >
          {/* Filled brass active indicator */}
          {active && (
            <span
              aria-hidden="true"
              className="w-1.5 h-4 bg-ledger-brass border border-ledger-brass shrink-0 rounded-xs"
            />
          )}
          {!active && !collapsed && (
            <span
              aria-hidden="true"
              className="w-1.5 h-4 shrink-0 opacity-0 group-hover:opacity-30 group-hover:bg-ledger-paper/30 transition-opacity rounded-xs"
            />
          )}

          <Icon
            name={item.icon}
            size={16}
            className={`shrink-0 ${
              active ? "text-ledger-brass" : "text-ledger-paper/70 group-hover:text-ledger-paper"
            }`}
          />

          {!collapsed && (
            <span className="truncate flex-1 text-left">{item.label}</span>
          )}
        </Link>
      </li>
    );
  };

  const navContent = (collapsed: boolean, isDrawer: boolean) => (
    <div className="flex flex-col h-full select-none">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between p-3 border-b border-ledger-twilight min-h-[52px]">
        {(!collapsed || isDrawer) ? (
          <div className="flex items-center gap-2">
            <span className="font-pixel text-base text-ledger-paper tracking-wider">Atlas</span>
            <span className="text-[10px] font-mono text-ledger-brass px-1.5 py-0.5 border border-ledger-brass/30 bg-ledger-brass/10">
              Notaris
            </span>
          </div>
        ) : (
          <span className="mx-auto font-pixel text-base text-ledger-brass" title="Atlas">
            A
          </span>
        )}

        {isDrawer ? (
          <button
            type="button"
            onClick={onCloseDrawer}
            aria-label="Close navigation drawer"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-ledger-paper/70 hover:text-ledger-paper hover:bg-ledger-twilight border border-ledger-twilight focus-visible:outline-2 focus-visible:outline-ledger-brass cursor-pointer"
          >
            <span aria-hidden="true" className="font-pixel text-sm">✕</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-ledger-paper/70 hover:text-ledger-paper hover:bg-ledger-twilight border border-ledger-twilight focus-visible:outline-2 focus-visible:outline-ledger-brass cursor-pointer ml-auto"
          >
            <span aria-hidden="true" className="font-mono text-xs">
              {collapsed ? "»" : "«"}
            </span>
          </button>
        )}
      </div>

      {/* Search Filter (only when expanded or in drawer) */}
      {(!collapsed || isDrawer) && (
        <div className="p-3 border-b border-ledger-twilight">
          <label htmlFor={searchInputId} className="sr-only">
            Find a page
          </label>
          <div className="relative">
            <input
              id={searchInputId}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find a page"
              className="w-full min-h-[44px] pl-3 pr-8 py-2 text-xs font-mono bg-ledger-night text-ledger-paper placeholder:text-ledger-paper/40 border border-ledger-twilight focus-visible:outline-2 focus-visible:outline-ledger-brass"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ledger-paper/50 hover:text-ledger-paper text-xs p-1"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto py-2 space-y-4">
        {filteredGroups.length === 0 ? (
          <p className="px-3 py-4 text-xs font-mono text-ledger-paper/50 text-center">
            No pages found
          </p>
        ) : (
          filteredGroups.map((group) => (
            <div key={group.id} className="space-y-1">
              {(!collapsed || isDrawer) ? (
                <div className="px-3 py-1 font-mono text-[11px] text-ledger-brass/80 select-none">
                  {group.label}
                </div>
              ) : (
                <div className="my-1 border-t border-ledger-twilight/50 mx-2" aria-hidden="true" />
              )}
              <ul role="list" className="space-y-0.5">
                {group.items.map((item) => renderNavItem(item, collapsed && !isDrawer))}
              </ul>
            </div>
          ))
        )}
      </div>

      {/* Footer Navigation Item */}
      <div className="p-2 border-t border-ledger-twilight bg-ledger-night">
        <ul role="list">
          {renderNavItem(FOOTER_NAV_ITEM, collapsed && !isDrawer)}
        </ul>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <nav
        aria-label="Atlas"
        className={`hidden md:flex flex-col shrink-0 bg-ledger-night border-r border-ledger-twilight sticky top-0 h-screen transition-[width] duration-150 ${
          isCollapsed ? "w-16" : "w-64"
        } ${className}`}
      >
        {navContent(isCollapsed, false)}
      </nav>

      {/* Mobile Drawer Backdrop & Container */}
      {propDrawerOpen && (
        <>
          <div
            onClick={onCloseDrawer}
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-black/70 md:hidden backdrop-blur-xs"
          />
          <nav
            ref={drawerRef}
            aria-label="Atlas"
            role="dialog"
            aria-modal="true"
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-ledger-night border-r border-ledger-brass shadow-2xl flex flex-col md:hidden"
          >
            {navContent(false, true)}
          </nav>
        </>
      )}
    </>
  );
}

export default AtlasSidebar;
