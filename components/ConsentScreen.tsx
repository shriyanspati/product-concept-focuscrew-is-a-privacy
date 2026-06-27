"use client";

import { useState } from "react";
import { PrivacyDetailsModal } from "@/components/PrivacyDetailsModal";
import { SoryvoLogo } from "@/components/SoryvoLogo";

type ConsentScreenProps = {
  onAccept: () => void;
  busy?: boolean;
};

export function ConsentScreen({ onAccept, busy = false }: ConsentScreenProps) {
  const [checked, setChecked] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <section className="w-full max-w-2xl border-t border-border pt-6 sm:pt-8">
        <div className="mb-6">
          <SoryvoLogo variant="mark" size={48} priority className="mb-4 object-contain" />
          <p className="text-sm text-muted">Consent</p>
          <h1 className="mt-2 text-2xl font-semibold">Before you enter the room</h1>
        </div>

        <ul className="space-y-3 text-muted">
          <li>Soryvo only uses opt-in signals.</li>
          <li>The group never sees another person&apos;s private browsing details.</li>
          <li>The group sees anonymous focus trends, not individual callouts.</li>
          <li>You can pause sharing at any time.</li>
          <li>The core room captures no screen images. Optional Screen Check requires separate browser and AI consent, and never stores frames.</li>
          <li>This is not a medical or mental-health diagnostic tool.</li>
        </ul>

        <label className="mt-7 flex cursor-pointer items-start gap-3 border-y border-border py-4">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
            className="mt-1 h-5 w-5 accent-focus"
          />
          <span className="text-sm leading-6 text-primary">
            I understand that Soryvo uses opt-in high-level activity signals for attention recovery, not hidden monitoring or diagnosis.
          </span>
        </label>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onAccept}
            disabled={!checked || busy}
            className="rounded-control bg-focus px-5 py-3 font-semibold text-white transition enabled:hover:bg-focusDark disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Preparing room..." : "Continue to Study Room"}
          </button>
          <button
            type="button"
            onClick={() => setPrivacyOpen(true)}
            className="rounded-control border border-border px-5 py-3 font-semibold text-primary transition hover:border-focus"
          >
            View Privacy Details
          </button>
        </div>
      </section>
      <PrivacyDetailsModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </main>
  );
}
