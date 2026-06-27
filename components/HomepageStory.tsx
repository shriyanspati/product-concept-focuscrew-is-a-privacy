"use client";

import { motion, useReducedMotion } from "framer-motion";

export type RoomMood = "quiet" | "sprint" | "late";

const moodCopy: Record<RoomMood, { label: string; description: string }> = {
  quiet: {
    label: "Quiet lock-in",
    description: "25 minutes of quiet focus. Break together after."
  },
  sprint: {
    label: "Homework sprint",
    description: "One task each. A short reset when the room drifts."
  },
  late: {
    label: "Late-night catch-up",
    description: "Small goals, shorter blocks, and a clean stopping point."
  }
};

const facts = [
  {
    heading: "Explaining something reveals what you actually know.",
    body: "Practice retrieval, like answering a question or explaining a concept without notes, is consistently linked to stronger learning than simply rereading.",
    source: "Research: Agarwal, Nunes & Blunt, 2021"
  },
  {
    heading: "Cramming feels productive. Spacing usually lasts longer.",
    body: "Research on distributed practice finds that spreading study across sessions tends to support learning better than packing the same work into one long cram.",
    source: "Research: Mawson, Kang et al., 2025"
  },
  {
    heading: "The group helps when the work is real.",
    body: "Collaborative learning is most useful when people share a genuine task, explain ideas, and stay accountable, not when everyone simply sits in the same call.",
    source: "Research: Loes, 2022"
  }
];

const reveal = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.32, ease: "easeOut" }
} as const;

export function HomepageStory({ mood, onMoodChange }: { mood: RoomMood; onMoodChange: (mood: RoomMood) => void }) {
  return (
    <>
      <RoomActivitySequence />
      <PomodoroRhythm />
      <WhyStudyRoomsWork />
      <GroupEnergySelector mood={mood} onMoodChange={onMoodChange} />
    </>
  );
}

function RoomActivitySequence() {
  const reduceMotion = useReducedMotion();
  const steps = ["Goal set", "Room starts", "Focus check", "Shared break", "Back to work"];

  return (
    <motion.section className="border-t border-border px-5 py-10 sm:px-8" {...reveal}>
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 text-sm text-muted">
          {steps.map((step, index) => (
            <span key={step} className="flex items-center gap-4">
              <motion.span
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.28, delay: index * 0.08 }}
                className={index === steps.length - 1 ? "border-b border-focus pb-1 text-primary" : ""}
              >
                {step}
              </motion.span>
              {index < steps.length - 1 && (
                <motion.span
                  className="h-px w-8 bg-focus/70"
                  initial={reduceMotion ? false : { scaleX: 0 }}
                  whileInView={reduceMotion ? {} : { scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: index * 0.08 + 0.12 }}
                  style={{ transformOrigin: "left" }}
                  aria-hidden="true"
                />
              )}
            </span>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

function PomodoroRhythm() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section className="border-t border-border bg-pageWarm px-5 py-14 sm:px-8" {...reveal}>
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <div>
          <h2 className="font-serif text-4xl leading-tight text-primary">A timer is better when the room shares it.</h2>
          <p className="mt-4 max-w-xl leading-7 text-muted">
            Everyone sees the same focus block, the same break, and the same moment to come back.
          </p>
        </div>

        <div aria-hidden="true">
          <div className="flex items-center justify-between text-sm text-muted">
            <span>25 minutes focused</span>
            <span>5 minutes together</span>
            <span>one clearer next step</span>
          </div>
          <div className="mt-5 h-2 bg-border">
            <motion.div
              className="h-full origin-left bg-primary"
              initial={false}
              animate={reduceMotion ? { scaleX: 0.72 } : { scaleX: [0.15, 0.72, 0.72, 0.9] }}
              transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
          <div className="mt-2 h-2 bg-border">
            <motion.div
              className="ml-[72%] h-full w-[16%] bg-break"
              initial={false}
              animate={reduceMotion ? { opacity: 0.8 } : { opacity: [0.25, 0.25, 0.9, 0.35] }}
              transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
          <motion.p
            className="mt-4 text-sm text-muted"
            initial={false}
            animate={reduceMotion ? {} : { opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
          >
            Focus -&gt; break -&gt; return together.
          </motion.p>
        </div>
      </div>
    </motion.section>
  );
}

function WhyStudyRoomsWork() {
  return (
    <motion.section className="border-t border-border px-5 py-14 sm:px-8" {...reveal}>
      <div className="mx-auto max-w-6xl">
        <h2 className="font-serif text-4xl text-primary">Why study rooms can work</h2>
        <div className="mt-8 divide-y divide-border border-y border-border">
          {facts.map((fact) => (
            <div key={fact.heading} className="grid gap-4 py-6 md:grid-cols-[0.95fr_1.4fr]">
              <div>
                <h3 className="text-xl font-semibold text-primary">{fact.heading}</h3>
                <p className="mt-3 text-sm text-muted">{fact.source}</p>
              </div>
              <p className="leading-7 text-muted">{fact.body}</p>
            </div>
          ))}
        </div>
        <details className="mt-6 text-sm text-muted">
          <summary className="cursor-pointer font-medium text-primary">Sources</summary>
          <ul className="mt-3 space-y-2 leading-6">
            <li>Agarwal, Nunes & Blunt, 2021: Retrieval practice consistently benefits student learning: A systematic review of applied research in schools and classrooms.</li>
            <li>Mawson, Kang et al., 2025: Research on distributed practice and spacing effects in student learning.</li>
            <li>Loes, 2022: Research on collaborative learning, shared academic work, and student accountability.</li>
          </ul>
        </details>
      </div>
    </motion.section>
  );
}

function GroupEnergySelector({ mood, onMoodChange }: { mood: RoomMood; onMoodChange: (mood: RoomMood) => void }) {
  const active = moodCopy[mood];

  return (
    <motion.section className="border-t border-border bg-pageWarm px-5 py-14 sm:px-8" {...reveal}>
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div>
          <h2 className="font-serif text-4xl text-primary">What kind of room are you building?</h2>
          <p className="mt-4 leading-7 text-muted">
            Pick a feel for the group. Nothing is saved here; it just changes the room story above.
          </p>
        </div>
        <div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {(Object.keys(moodCopy) as RoomMood[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onMoodChange(option)}
                className={`rounded-control border px-4 py-3 text-left font-semibold transition ${
                  mood === option
                    ? "border-focus bg-focus text-white"
                    : "border-border text-primary hover:bg-surfaceHover"
                }`}
              >
                {moodCopy[option].label}
              </button>
            ))}
          </div>
          <p className="mt-5 border-l-2 border-focus pl-4 leading-7 text-muted">
            <span className="font-semibold text-primary">{active.label}</span>
            <br />
            {active.description}
          </p>
        </div>
      </div>
    </motion.section>
  );
}
