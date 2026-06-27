"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  getDefaultActivityCategory,
  mapFocusCheckToPublicStatus,
  mapFocusCheckToStoredState,
  requestFocusCheck
} from "@/lib/focusCheckService";
import type {
  ActivityCategory,
  FocusCheckResult,
  FocusCheckSelfReport,
  FocusCheckStoredState,
  ParticipantStatus
} from "@/lib/types";

type FocusCheckModalProps = {
  open: boolean;
  goal: string;
  subject: string;
  demoCategory?: ActivityCategory;
  onClose: () => void;
  onComplete: (result: {
    publicStatus: ParticipantStatus;
    storedState: FocusCheckStoredState;
    focusCheckResult: FocusCheckResult;
  }) => void;
};

type Step = "choose" | "on_task" | "stuck" | "break" | "result";

export function FocusCheckModal({
  open,
  goal,
  subject,
  demoCategory,
  onClose,
  onComplete
}: FocusCheckModalProps) {
  const [step, setStep] = useState<Step>("choose");
  const [selfReport, setSelfReport] = useState<FocusCheckSelfReport>("on_task");
  const [currentActivity, setCurrentActivity] = useState("");
  const [nextTinyStep, setNextTinyStep] = useState("");
  const [blocker, setBlocker] = useState("");
  const [result, setResult] = useState<FocusCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) {
    return null;
  }

  function choose(report: FocusCheckSelfReport) {
    setSelfReport(report);
    setError("");

    if (report === "on_task") {
      setStep("on_task");
    }

    if (report === "stuck") {
      setStep("stuck");
    }

    if (report === "taking_break") {
      setStep("break");
    }

    if (report === "skipped") {
      void submit(report);
    }
  }

  async function submit(report = selfReport) {
    if (!goal.trim()) {
      setError("Add one clear study goal before starting a Focus Check.");
      return;
    }

    if (report === "on_task" && (currentActivity.trim().length < 4 || nextTinyStep.trim().length < 4)) {
      setError("Add a brief current action and one tiny next step.");
      return;
    }

    if (report === "stuck" && blocker.trim().length < 4) {
      setError("Add a short note about what is blocking you.");
      return;
    }

    setLoading(true);
    setError("");

    const focusCheckResult = await requestFocusCheck({
      goal,
      subject,
      selfReport: report,
      currentActivity,
      nextTinyStep,
      blocker,
      activityCategory: demoCategory ?? getDefaultActivityCategory()
    });

    setResult(focusCheckResult);
    setLoading(false);
    setStep("result");
    onComplete({
      publicStatus: mapFocusCheckToPublicStatus({ selfReport: report, result: focusCheckResult }),
      storedState: mapFocusCheckToStoredState({ selfReport: report, result: focusCheckResult }),
      focusCheckResult
    });
  }

  function resetAndClose() {
    setStep("choose");
    setSelfReport("on_task");
    setCurrentActivity("");
    setNextTinyStep("");
    setBlocker("");
    setResult(null);
    setError("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-primary/20 p-4" role="dialog" aria-modal="true" aria-labelledby="focus-check-title">
      <section className="dialog-surface w-full max-w-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted">Private Focus Check</p>
            <h2 id="focus-check-title" className="mt-2 text-2xl font-semibold">Are you still working toward this goal?</h2>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            className="rounded-control border border-border p-2 text-muted transition hover:border-focus hover:text-primary"
            aria-label="Close Focus Check"
            title="Close Focus Check"
          >
            <X aria-hidden="true" size={19} />
          </button>
        </div>

        <div className="mt-5 border-y border-border py-4">
          <p className="text-xs font-medium text-muted">Your goal</p>
          <p className="mt-2 text-primary">{goal || "Add one clear study goal before starting a Focus Check."}</p>
        </div>

        {error && (
          <p className="mt-4 border-l-2 border-focus pl-3 text-sm text-primary">
            {error}
          </p>
        )}

        {step === "choose" && (
          <div className="mt-5 grid gap-2">
            <FocusChoice onClick={() => choose("on_task")} label="Yes, I'm on task" />
            <FocusChoice onClick={() => choose("stuck")} label="I'm stuck" />
            <FocusChoice onClick={() => choose("taking_break")} label="I'm taking a break" />
            <FocusChoice onClick={() => choose("skipped")} label="Skip this check" />
          </div>
        )}

        {step === "on_task" && (
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-muted">What are you doing right now?</span>
              <textarea
                value={currentActivity}
                onChange={(event) => setCurrentActivity(event.target.value)}
                rows={3}
                placeholder="Solving questions 5-8 on momentum."
                className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-3 text-primary placeholder:text-muted/70 focus:border-focus"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-muted">What is your next tiny step?</span>
              <textarea
                value={nextTinyStep}
                onChange={(event) => setNextTinyStep(event.target.value)}
                rows={3}
                placeholder="Finish question 5 before switching tasks."
                className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-3 text-primary placeholder:text-muted/70 focus:border-focus"
              />
            </label>
            <SubmitButton loading={loading} onClick={() => submit("on_task")} label="Check task alignment" />
          </div>
        )}

        {step === "stuck" && (
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-muted">What is blocking you right now?</span>
              <textarea
                value={blocker}
                onChange={(event) => setBlocker(event.target.value)}
                rows={3}
                placeholder="I know the formula, but I am not sure which value goes where."
                className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-3 text-primary placeholder:text-muted/70 focus:border-focus"
              />
            </label>
            <SubmitButton loading={loading} onClick={() => submit("stuck")} label="Get one tiny next action" />
          </div>
        )}

        {step === "break" && (
          <div className="mt-5 space-y-3">
            <p className="border-l-2 border-border pl-3 text-muted">
              Intentional break selected.
            </p>
            <SubmitButton loading={loading} onClick={() => submit("taking_break")} label="Start a 3-minute break" variant="break" />
            <button
              type="button"
              onClick={() => submit("taking_break")}
              className="w-full rounded-lg border border-border px-4 py-3 font-semibold text-primary transition hover:bg-surfaceHover"
            >
              Join Break Lounge
            </button>
            <button
              type="button"
              onClick={() => {
                setSelfReport("on_task");
                setStep("choose");
              }}
              className="w-full rounded-lg border border-border px-4 py-3 font-semibold text-primary transition hover:bg-surfaceHover"
            >
              Return to focus now
            </button>
          </div>
        )}

        {step === "result" && result && (
          <div className="mt-5 border-t border-border pt-5">
            <p className="text-sm font-semibold text-primary">
              {result.alignment === "clear" ? "On-task confirmation." : "Quick reset suggestion."}
            </p>
            <p className="mt-3 leading-7 text-primary">{result.message}</p>
            <p className="mt-3 text-sm text-muted">{result.suggestedAction}</p>
            <button
              type="button"
              onClick={resetAndClose}
              className="mt-5 w-full rounded-control bg-focus px-4 py-3 font-semibold text-white transition hover:bg-focusDark"
            >
              Return to room
            </button>
          </div>
        )}

        <p className="mt-5 border-t border-border pt-4 text-xs leading-5 text-muted">
          Focus Check answers stay private. Soryvo stores only a broad status such as focused, taking a break, needs a reset, or not sharing activity.
        </p>
      </section>
    </div>
  );
}

function FocusChoice({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-control border border-border bg-surface px-4 py-3 text-left font-semibold text-primary transition hover:border-focus hover:bg-surfaceHover"
    >
      {label}
    </button>
  );
}

function SubmitButton({
  loading,
  label,
  onClick,
  variant = "primary"
}: {
  loading: boolean;
  label: string;
  onClick: () => void;
  variant?: "primary" | "break";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-control px-4 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        variant === "break"
          ? "bg-break text-primary hover:bg-breakDark"
          : "bg-focus text-white hover:bg-focusDark"
      }`}
    >
      {loading && <Loader2 aria-hidden="true" size={18} className="animate-spin" />}
      {label}
    </button>
  );
}
