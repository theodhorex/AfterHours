import React, { useRef } from "react";

export interface TabItem {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

export interface BookTabsProps {
  value: string;
  onChange: (newValue: string) => void;
  tabs: TabItem[];
  ariaLabel?: string;
  className?: string;
}

export function BookTabs({
  value,
  onChange,
  tabs,
  ariaLabel = "Navigation tabs",
  className = "",
}: BookTabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusAndSelect = (index: number) => {
    const targetTab = tabs[index];
    if (targetTab) {
      onChange(targetTab.value);
      tabRefs.current[index]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    const count = tabs.length;
    if (count === 0) return;

    let targetIndex: number | null = null;

    switch (e.key) {
      case "ArrowRight":
        targetIndex = (index + 1) % count;
        break;
      case "ArrowLeft":
        targetIndex = (index - 1 + count) % count;
        break;
      case "Home":
        targetIndex = 0;
        break;
      case "End":
        targetIndex = count - 1;
        break;
      default:
        break;
    }

    if (targetIndex !== null) {
      e.preventDefault();
      focusAndSelect(targetIndex);
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`ledger-chrome flex items-stretch overflow-x-auto select-none border-b border-ledger-twilight ${className}`}
    >
      {tabs.map((tab, idx) => {
        const isSelected = tab.value === value;

        return (
          <button
            key={tab.value}
            ref={(el) => {
              tabRefs.current[idx] = el;
            }}
            type="button"
            role="tab"
            id={`book-tab-${tab.value}`}
            aria-selected={isSelected}
            aria-controls={`book-panel-${tab.value}`}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`min-h-[44px] min-w-[44px] px-4 py-2.5 flex items-center justify-center gap-2 cursor-pointer transition-colors border-r border-ledger-twilight text-xs sm:text-sm font-pixel ${
              isSelected
                ? "bg-ledger-paper text-ledger-ink font-bold shadow-[inset_0_-3px_0_0_var(--ledger-brass)]"
                : "bg-ledger-night text-ledger-paper/70 hover:text-ledger-paper hover:bg-ledger-twilight/60"
            }`}
          >
            {tab.icon && (
              <span className="shrink-0" aria-hidden="true">
                {tab.icon}
              </span>
            )}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`ml-1 px-1.5 py-0.5 text-[10px] font-mono leading-none border ${
                  isSelected
                    ? "bg-ledger-paper-shade text-ledger-ink border-ledger-ink-faded/30"
                    : "bg-ledger-twilight text-ledger-paper/90 border-ledger-twilight"
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default BookTabs;
