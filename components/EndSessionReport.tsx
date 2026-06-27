"use client";

import { Home, RotateCcw, ShieldCheck } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PrivacyDetailsModal } from "@/components/PrivacyDetailsModal";
import { SoryvoLogo } from "@/components/SoryvoLogo";
import type { FocusPoint, SessionReport } from "@/lib/types";
import { useState } from "react";

type EndSessionReportProps = {
  report: SessionReport;
  focusHistory: FocusPoint[];
  onStartAnother: () => void;
  onReturnHome: () => void;
};

export function EndSessionReport({
  report,
  focusHistory,
  onStartAnother,
  onReturnHome
}: EndSessionReportProps) {
  const [privacyOpen, setPrivacyOpen] = useState(false);

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-background/95 px-4 py-8">
      <section className="mx-auto w-full max-w-5xl border-t border-border pt-6 sm:pt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <SoryvoLogo variant="mark" size={44} className="mb-4 object-contain" />
            <p className="text-sm text-muted">Session report</p>
            <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Strong recovery, useful signal.</h2>
            <p className="mt-3 max-w-2xl text-muted">
              This report summarizes anonymous group flow and keeps your personal reflection private.
            </p>
          </div>
          <div className="border-l border-border pl-5 text-left sm:text-right">
            <p className="text-4xl font-semibold text-primary">{report.overallScore}</p>
            <p className="text-sm text-muted">Overall group focus</p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <Metric label="Focused minutes" value={`${report.focusedMinutes}`} />
          <Metric label="Recovery moments" value={`${report.recoveryMoments}`} />
          <Metric label="Strongest period" value={report.strongestFocusPeriod} />
          <Metric label="Common trigger" value={report.commonTrigger} />
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_0.75fr]">
          <div className="border-t border-border pt-5">
            <h3 className="font-semibold">Group focus over time</h3>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={focusHistory}>
                  <XAxis dataKey="minute" stroke="#706D68" tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} stroke="#706D68" tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#FFFFFF", border: "1px solid #DCD8D1", borderRadius: 10, color: "#171716" }}
                    cursor={{ stroke: "#DCD8D1" }}
                    labelFormatter={(value) => `Minute ${value}`}
                  />
                  <Line type="monotone" dataKey="score" stroke="#A6232B" strokeWidth={3} dot={{ r: 4, fill: "#FFFDF9", stroke: "#A6232B" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-5">
            <div className="border-t border-border pt-5">
              <h3 className="font-semibold">Private personal note</h3>
              <p className="mt-3 leading-7 text-muted">{report.personalNote}</p>
            </div>
            <div className="border-t border-border pt-5">
              <h3 className="font-semibold text-primary">Next session suggestion</h3>
              <p className="mt-3 leading-7 text-primary">{report.nextSuggestion}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onStartAnother}
            className="inline-flex items-center justify-center gap-2 rounded-control bg-focus px-5 py-3 font-semibold text-white transition hover:bg-focusDark"
          >
            <RotateCcw aria-hidden="true" size={18} />
            Start Another Session
          </button>
          <button
            type="button"
            onClick={onReturnHome}
            className="inline-flex items-center justify-center gap-2 rounded-control border border-border px-5 py-3 font-semibold text-primary transition hover:border-focus"
          >
            <Home aria-hidden="true" size={18} />
            Return Home
          </button>
          <button
            type="button"
            onClick={() => setPrivacyOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-control border border-border px-5 py-3 font-semibold text-primary transition hover:border-focus"
          >
            <ShieldCheck aria-hidden="true" size={18} />
            View Privacy Details
          </button>
        </div>
        <p className="mt-8 border-t border-border pt-5 text-sm text-muted">
          <span className="font-serif text-primary">Soryvo</span> · Study together. Recover together.
        </p>
      </section>
      <PrivacyDetailsModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-border pt-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-xl font-semibold text-primary">{value}</p>
    </div>
  );
}
