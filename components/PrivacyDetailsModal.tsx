"use client";

import { X } from "lucide-react";
import { SoryvoLogo } from "@/components/SoryvoLogo";

type PrivacyDetailsModalProps = {
  open: boolean;
  onClose: () => void;
};

export function PrivacyDetailsModal({ open, onClose }: PrivacyDetailsModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/85 p-4" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
      <div className="dialog-surface max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <SoryvoLogo variant="mark" size={40} className="mb-4 object-contain" />
            <p className="text-sm font-medium text-muted">Privacy details</p>
            <h2 id="privacy-title" className="mt-2 text-2xl font-semibold">Exactly what Soryvo uses</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-control border border-border p-2 text-muted transition hover:border-focus hover:text-primary"
            aria-label="Close privacy details"
            title="Close privacy details"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>

        <div className="mt-6 space-y-5 text-muted">
          <section>
            <h3 className="font-semibold text-primary">Opt-in signals</h3>
            <p className="mt-2">
              The MVP uses self-reported actions and demo simulator events such as focused, task switch, long idle time, stuck, or intentional break.
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-primary">What the group sees</h3>
            <p className="mt-2">
              The room shows anonymous focus trends and supportive status labels. It never shows another student&apos;s private browsing details, URLs, screenshots, passwords, messages, webcam, microphone, or keystrokes.
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-primary">What AI receives</h3>
            <p className="mt-2">
              The focus coach receives the task goal, subject category, timer details, recent high-level signals, and anonymous aggregate group focus score. The API key stays server-side when OpenAI is enabled.
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-primary">Optional Screen Check</h3>
            <p className="mt-2">
              Screen Check starts only after you choose a study context and approve the browser screen picker. Local heuristic mode samples a low-resolution frame only to verify a live connection, then clears it without encoding or uploading it.
            </p>
            <p className="mt-2">
              Cloud vision requires separate consent. One low-resolution frame is sent directly to the private analysis endpoint, never Supabase, LiveKit, analytics, logs, or another room member. Canvas memory is cleared immediately after sampling, and Soryvo never saves the frame.
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-primary">Optional browser extension</h3>
            <p className="mt-2">
              The extension starts only when you enable a private signal session. It shares a broad category and tab-switch count with your Focus Check. It never shares URLs, tab titles, search terms, page contents, or browser history, and its session data is cleared when you stop it.
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-primary">Accountability Pulse</h3>
            <p className="mt-2">
              An anonymous group lock-in invitation is available only when every current member opts in, at least three members are active, the room is focusing, and the ten-minute cooldown has passed. It never includes who requested it or any private check details.
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-primary">Well-being boundary</h3>
            <p className="mt-2">
              Soryvo supports study flow and attention recovery. It is not a medical or mental-health diagnostic tool, and it does not claim to treat or improve any condition.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
