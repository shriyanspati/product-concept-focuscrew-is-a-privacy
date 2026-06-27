"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";
import { HomepageStory, type RoomMood } from "@/components/HomepageStory";
import { LiveStudySnapshot } from "@/components/LiveStudySnapshot";
import { SoryvoLogo } from "@/components/SoryvoLogo";
const steps = [
  ["Choose one goal.", "Make the first task concrete."],
  ["Study in the same room.", "Your group stays connected without oversharing."],
  ["Reset before you drift.", "Take a short break, then come back with a next step."]
];

export function LandingPage() {
  const [mood, setMood] = useState<RoomMood>("quiet");

  return (
    <main className="min-h-screen overflow-x-clip bg-background">
      <nav className="border-b border-border px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-5">
          <Link href="/" className="flex items-center gap-3" aria-label="Soryvo home">
            <SoryvoLogo variant="mark" size={30} priority className="shrink-0 object-contain" />
            <span className="font-serif text-2xl tracking-wide text-primary">Soryvo</span>
          </Link>
          <div className="hidden items-center gap-7 text-sm text-muted md:flex">
            <a href="#room-preview" className="transition hover:text-primary">
              How it works
            </a>
            <Link href="/signin" className="transition hover:text-primary">
              Sign in
            </Link>
          </div>
          <Link
            href="/room/CREW42"
            className="rounded-control bg-focus px-4 py-2 text-sm font-semibold text-white transition hover:bg-focusDark"
          >
            Try demo
          </Link>
        </div>
      </nav>

      <section className="mx-auto flex min-h-[680px] w-full max-w-[1180px] items-center px-[clamp(24px,5vw,72px)] py-14 sm:py-16 lg:min-h-[720px]">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="grid w-full min-w-0 gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,1fr)] lg:items-center"
        >
          <div className="min-w-0 max-w-2xl">
            <div className="mb-6 h-2 w-2 rounded-[2px] bg-focus" aria-hidden="true" />
            <p className="mb-5 text-base text-muted">Private study rooms for real groups</p>
            <h1 className="font-serif text-5xl leading-[1.03] text-primary sm:text-6xl lg:text-[4.45rem]">
              Study together.
              <br />
              Recover together.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-muted">
              A quick reset beats losing an entire session.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/room"
                className="inline-flex items-center justify-center rounded-control bg-focus px-5 py-3 font-semibold text-white transition hover:bg-focusDark"
              >
                Start a study room
              </Link>
              <Link
                href="/room/CREW42"
                className="inline-flex items-center justify-center rounded-control border border-border px-5 py-3 font-semibold text-primary transition hover:border-borderStrong hover:bg-surfaceHover"
              >
                Try demo
              </Link>
            </div>
          </div>
          <LiveStudySnapshot />
        </motion.div>
      </section>

      <HomepageStory mood={mood} onMoodChange={setMood} />

      <section id="room-preview" className="border-t border-border bg-pageWarm px-5 py-12 sm:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
          {steps.map(([title, copy]) => (
            <div key={title} className="border-t border-border pt-5">
              <div className="mb-4 h-px w-8 bg-focus" aria-hidden="true" />
              <h2 className="text-xl font-semibold text-primary">{title}</h2>
              <p className="mt-3 leading-7 text-muted">{copy}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border px-5 py-8 text-center text-sm text-muted sm:px-8">
        Soryvo - Study together. Recover together.
      </footer>
    </main>
  );
}
