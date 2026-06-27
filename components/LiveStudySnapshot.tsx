"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const participants = [
  { name: "Maya", task: "AP Biology notes", initial: "M" },
  { name: "Jordan", task: "SAT Math practice", initial: "J" },
  { name: "Alex", task: "History outline", initial: "A" },
  { name: "Sam", task: "Chemistry review", initial: "S", mobileHidden: true }
];

const timerFrames = ["18:33", "18:31", "18:29", "18:27"];
const statusFrames = ["Working quietly", "Working quietly", "Shared break in 06:27", "Working quietly"];
const dotOpacityFrames = [
  [1, 1, 0, 0, 0, 1],
  [0, 0, 1, 0, 0, 0],
  [0, 0, 0, 1, 0, 0],
  [0, 0, 0, 0, 1, 0]
];

export function LiveStudySnapshot() {
  const reduceMotion = useReducedMotion();
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (reduceMotion) {
      setFrame(0);
      return;
    }

    const interval = window.setInterval(() => {
      setFrame((current) => (current + 1) % timerFrames.length);
    }, 4500);

    return () => window.clearInterval(interval);
  }, [reduceMotion]);

  const progressAnimation = reduceMotion ? { scaleX: 0.72 } : { scaleX: [0.7, 0.75, 0.78, 0.82, 0.72] };

  return (
    <div className="w-full min-w-0 lg:justify-self-end" aria-label="Live study room snapshot">
      <div className="mx-auto w-full max-w-[480px] lg:mx-0">
        <div className="bg-surface/55 px-4 py-5 shadow-subtle sm:px-6 sm:py-6" aria-hidden="true">
          <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Room CREW42</p>
              <h2 className="mt-3 text-2xl font-semibold leading-none text-primary sm:text-[1.7rem]">
                AP Bio study room
              </h2>
              <p className="mt-2 text-sm text-muted">4 people in the room</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-sm font-semibold uppercase tracking-[0.08em] text-primary">
                {timerFrames[frame]} left
              </p>
              <span className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-focus" />
            </div>
          </div>

          <div className="relative divide-y divide-border/80">
            {participants.map((participant, index) => (
              <div
                key={participant.name}
                className={`grid min-h-11 grid-cols-[34px_minmax(62px,0.72fr)_minmax(104px,1fr)_auto] items-center gap-2 py-3 text-sm sm:grid-cols-[38px_minmax(82px,0.7fr)_minmax(145px,1fr)_auto] sm:gap-3 ${
                  participant.mobileHidden ? "hidden sm:grid" : ""
                }`}
              >
                <div className="relative">
                  <div className="grid h-8 w-8 place-items-center rounded-full border border-border bg-surfaceSoft font-semibold text-primary">
                    {participant.initial}
                  </div>
                  <ActiveDot index={index} reduceMotion={reduceMotion} />
                </div>
                <p className="truncate font-medium text-primary">{participant.name}</p>
                <p className="truncate text-muted">{participant.task}</p>
                <p className="text-right text-muted">Working</p>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between gap-4 text-sm">
              <p className="text-muted">
                Focus block <span className="text-primary">- 72%</span>
              </p>
              <StatusLine frame={frame} reduceMotion={reduceMotion} />
            </div>
            <div className="mt-3 h-px overflow-hidden bg-border">
              <motion.div
                className="h-px origin-left bg-focus"
                initial={false}
                animate={progressAnimation}
                transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
            <p className="mt-4 text-xs leading-5 text-muted">
              Private room signals only. No screen capture, no public callouts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActiveDot({ index, reduceMotion }: { index: number; reduceMotion: boolean | null }) {
  if (reduceMotion) {
    return index === 0 ? <span className="absolute -left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-focus" /> : null;
  }

  return (
    <motion.span
      className="absolute -left-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-focus"
      initial={false}
      animate={{ opacity: dotOpacityFrames[index] }}
      transition={{
        duration: 18,
        repeat: Infinity,
        ease: "easeInOut",
        times: [0, 0.2, 0.32, 0.54, 0.76, 1]
      }}
    />
  );
}

function StatusLine({ frame, reduceMotion }: { frame: number; reduceMotion: boolean | null }) {
  if (reduceMotion) {
    return <p className="shrink-0 text-right text-muted">Working quietly</p>;
  }

  return (
    <div className="relative h-5 min-w-[138px] shrink-0 overflow-hidden text-right">
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={statusFrames[frame]}
          className="absolute inset-0 text-muted"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          {statusFrames[frame]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
