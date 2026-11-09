"use client";

import React, { useEffect, useRef, useId } from "react";
import { Icon } from "./Icons.tsx";

export interface LedgerConfirmDialogProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  isConfirmDisabled?: boolean;
  isBusy?: boolean;
  triggerElement?: HTMLElement | null;
  children: React.ReactNode;
}

/**
 * Accessible, keyboard-operable ledger dialog.
 * Meets WCAG AA:
 * - Focus trapped inside dialog while open.
 * - Escape key dismisses.
 * - Restores focus to trigger element on dismiss.
 * - 44px minimum target sizes.
 * - No emoji, purple, or gradients.
 */
export function LedgerConfirmDialog({
  isOpen,
  title,
  onClose,
  onConfirm,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isConfirmDisabled = false,
  isBusy = false,
  triggerElement,
  children,
}: LedgerConfirmDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  // Return focus on close
  useEffect(() => {
    if (!isOpen && triggerElement) {
      triggerElement.focus();
    }
  }, [isOpen, triggerElement]);

  // Focus trap & Escape listener
  useEffect(() => {
    if (!isOpen) return;

    // Focus initial element
    const timer = setTimeout(() => {
      firstFocusableRef.current?.focus();
    }, 20);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab" && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ledger-night/70 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg border-2 border-ledger-brass bg-ledger-paper text-ledger-ink p-6 shadow-2xl space-y-5"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-ledger-ink-faded/25 pb-3">
          <h2
            id={titleId}
            className="font-pixel text-lg font-bold text-ledger-ink leading-snug"
          >
            {title}
          </h2>
          <button
            ref={firstFocusableRef}
            type="button"
            onClick={onClose}
            disabled={isBusy}
            aria-label="Close dialog"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center border border-ledger-ink-faded/30 bg-ledger-paper-shade/40 hover:bg-ledger-paper-shade text-ledger-ink cursor-pointer focus-visible:outline-2 focus-visible:outline-ledger-brass disabled:opacity-50"
          >
            <span aria-hidden="true" className="font-pixel text-sm font-bold">✕</span>
          </button>
        </div>

        {/* Body */}
        <div className="font-body text-sm text-ledger-ink space-y-4">
          {children}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-ledger-ink-faded/25">
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="min-h-[44px] px-4 py-2 border border-ledger-ink-faded/40 bg-ledger-paper hover:bg-ledger-paper-shade text-ledger-ink font-silk text-xs uppercase tracking-wider cursor-pointer focus-visible:outline-2 focus-visible:outline-ledger-brass disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirmDisabled || isBusy}
            className="min-h-[44px] px-5 py-2 border-2 border-ledger-ink bg-ledger-ink text-ledger-paper hover:bg-ledger-ink/90 font-silk text-xs uppercase tracking-wider font-bold cursor-pointer focus-visible:outline-2 focus-visible:outline-ledger-brass disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isBusy ? (
              <>
                <Icon name="hourglass" size={16} className="animate-spin" aria-hidden="true" />
                <span>Signing...</span>
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LedgerConfirmDialog;
