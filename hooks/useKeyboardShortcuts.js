"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * Global keyboard shortcuts for ChatVibe AI.
 * Cmd/Ctrl+U → /upload
 * Cmd/Ctrl+H → /analysis (history)
 * Cmd/Ctrl+B → /billing
 * ? → show shortcuts modal
 * Escape → close modals
 */
export function useKeyboardShortcuts({ onShowHelp } = {}) {
  const router = useRouter();

  const handler = useCallback(
    (e) => {
      const meta = e.metaKey || e.ctrlKey;

      // Skip when user is typing in an input/textarea
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (["input", "textarea", "select"].includes(tag)) return;

      if (meta && e.key === "u") {
        e.preventDefault();
        router.push("/upload");
        return;
      }

      if (meta && e.key === "h") {
        e.preventDefault();
        router.push("/analysis");
        return;
      }

      if (meta && e.key === "b") {
        e.preventDefault();
        router.push("/billing");
        return;
      }

      if (e.key === "?" && !meta) {
        e.preventDefault();
        onShowHelp?.();
        return;
      }
    },
    [router, onShowHelp]
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);
}

/** All registered shortcuts for display in the help modal */
export const SHORTCUTS = [
  { keys: ["⌘", "U"], description: "Go to Upload" },
  { keys: ["⌘", "H"], description: "Go to History" },
  { keys: ["⌘", "B"], description: "Go to Billing" },
  { keys: ["?"], description: "Show keyboard shortcuts" },
  { keys: ["Esc"], description: "Close modal / dialog" },
];
