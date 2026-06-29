"use client";

import { useEffect, useState } from "react";

const dismissalKey = "soryvo:solvely-extension-warning-dismissed";
const extensionAttribute = "data-solvely-extension";
const detectedExtensionKey = "soryvo:extension-attribute-detected";

export function ExtensionWarning() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Detect only known extension mutations; normal hydration errors must remain visible.
    const updateVisibility = () => {
      let dismissed = false;
      let knownExtensionDetected = false;

      try {
        dismissed = window.sessionStorage.getItem(dismissalKey) === "true";
        knownExtensionDetected = window.sessionStorage.getItem(detectedExtensionKey) === "true";
      } catch {
        dismissed = false;
      }

      const solvelyDetected = document.documentElement.hasAttribute(extensionAttribute);
      setVisible((solvelyDetected || knownExtensionDetected) && !dismissed);
    };

    updateVisibility();

    const observer = new MutationObserver(updateVisibility);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [extensionAttribute]
    });

    return () => observer.disconnect();
  }, []);

  function dismiss() {
    try {
      window.sessionStorage.setItem(dismissalKey, "true");
    } catch {
      // The banner can still be dismissed for this render when storage is unavailable.
    }

    setVisible(false);
  }

  if (!visible) {
    return null;
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 top-4 z-[100] mx-auto max-w-3xl rounded-control border border-border bg-surface px-4 py-3 shadow-subtle sm:px-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-primary">Browser extension detected</p>
          <p className="mt-1 text-sm leading-6 text-muted">
            A browser extension is modifying this page before it loads, which can cause development warnings or unexpected behavior. Try opening Soryvo in an Incognito/InPrivate window or temporarily disable extensions such as Grammarly or Solvely.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-control border border-border px-4 py-2 text-sm font-semibold text-primary transition hover:bg-surfaceHover"
        >
          Got it
        </button>
      </div>
    </aside>
  );
}
