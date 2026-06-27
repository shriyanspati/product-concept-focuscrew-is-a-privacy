"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { ConsentScreen } from "@/components/ConsentScreen";
import { SoryvoLogo } from "@/components/SoryvoLogo";
import { demoSubjects } from "@/lib/demoData";
import { createLiveRoom, joinLiveRoom, liveRoomsAvailable } from "@/lib/liveRoomApi";
import { localRoomAdapter } from "@/lib/storageAdapter";
import { getSupabaseBrowserClient, isEmailSession } from "@/lib/supabaseClient";
import type { RoomConfig } from "@/lib/types";

export function RoomSetup() {
  return (
    <Suspense fallback={<SetupShell loading />}>
      <RoomSetupInner />
    </Suspense>
  );
}

function RoomSetupInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const demoRequested = searchParams.get("demo") === "1";
  const nameFromSignIn = searchParams.get("name") ?? "";
  const [displayName, setDisplayName] = useState(demoRequested ? "Judge" : nameFromSignIn);
  const [subject, setSubject] = useState(demoRequested ? "AP Biology" : demoSubjects[0]);
  const [duration, setDuration] = useState(demoRequested ? 25 : 45);
  const [goal, setGoal] = useState(demoRequested ? "Review photosynthesis notes and finish a five-question check" : "");
  const [joinCode, setJoinCode] = useState(demoRequested ? "CREW42" : "");
  const judgeDemo = demoRequested;
  const [pendingConfig, setPendingConfig] = useState<RoomConfig | null>(null);
  const [pendingAction, setPendingAction] = useState<"create" | "join">("create");
  const [liveError, setLiveError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const reduceMotion = useReducedMotion();
  const liveAvailable = liveRoomsAvailable();
  const rhythm = getSessionRhythm(duration);
  const ticketGoal = goal.trim() || "Your first clear task will show here";
  const ticketSubject = subject || "Study session";

  useEffect(() => {
    if (!liveAvailable) {
      return;
    }

    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      return;
    }

    const supabaseClient = supabase;
    let cancelled = false;

    async function loadSession() {
      const { data } = await supabaseClient.auth.getSession();

      if (cancelled) {
        return;
      }

      const emailSession = isEmailSession(data.session);

      const metadataName = data.session?.user.user_metadata?.display_name;
      if (emailSession && !displayName.trim() && typeof metadataName === "string") {
        setDisplayName(metadataName);
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [displayName, liveAvailable]);

  async function startRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!judgeDemo && liveAvailable && !(await confirmEmailSession("/room"))) {
      return;
    }

    const roomCode = judgeDemo ? "CREW42" : liveAvailable ? "LIVE" : makeRoomCode();

    setLiveError("");
    setPendingAction("create");
    setPendingConfig({
      displayName: displayName.trim() || "Guest",
      subject,
      duration,
      goal: goal.trim() || "Finish one focused study task",
      roomCode,
      judgeDemo,
      mode: judgeDemo ? "demo" : liveAvailable ? "live" : "local",
      consentAccepted: false
    });
  }

  async function joinRoom() {
    const normalizedCode = (joinCode.trim() || "CREW42").toUpperCase();
    const codeValid = /^[A-Z0-9]{6}$/.test(normalizedCode);

    if (!codeValid) {
      setLiveError("Enter a six-character room code.");
      return;
    }

    if (!judgeDemo && normalizedCode !== "CREW42" && liveAvailable && !(await confirmEmailSession(`/room/${normalizedCode}`))) {
      return;
    }

    setLiveError("");
    setPendingAction("join");
    setPendingConfig({
      displayName: displayName.trim() || "Guest",
      subject,
      duration,
      goal: goal.trim() || "Finish one focused study task",
      roomCode: normalizedCode,
      judgeDemo: judgeDemo || normalizedCode === "CREW42",
      mode: judgeDemo || normalizedCode === "CREW42" ? "demo" : liveAvailable ? "live" : "local",
      consentAccepted: false
    });
  }

  async function confirmEmailSession(nextPath: string) {
    if (!liveAvailable) {
      return true;
    }

    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      return true;
    }

    const { data } = await supabase.auth.getSession();

    if (isEmailSession(data.session)) {
      return true;
    }

    const params = new URLSearchParams();
    const nextName = displayName.trim();

    if (nextName) {
      params.set("name", nextName);
    }

    params.set("next", nextPath);
    setLiveError("Sign in with email before creating or joining a live room.");
    router.push(`/signin?${params.toString()}`);
    return false;
  }

  async function acceptConsent() {
    if (!pendingConfig) {
      return;
    }

    setSubmitting(true);
    setLiveError("");

    try {
      if (pendingConfig.mode === "live") {
        const snapshot = pendingAction === "create"
          ? await createLiveRoom({
              displayName: pendingConfig.displayName,
              goal: pendingConfig.goal,
              duration: pendingConfig.duration,
              subject: pendingConfig.subject,
              title: `${pendingConfig.subject} room`
            })
          : await joinLiveRoom({
              roomCode: pendingConfig.roomCode,
              displayName: pendingConfig.displayName,
              goal: pendingConfig.goal
            });

        const acceptedConfig = {
          ...pendingConfig,
          roomCode: snapshot.room.roomCode,
          liveRoomId: snapshot.room.id,
          liveParticipantId: snapshot.currentParticipant.id,
          isHost: pendingAction === "create",
          consentAccepted: true
        };
        localRoomAdapter.saveRoomConfig(acceptedConfig);
        router.push(`/room/${acceptedConfig.roomCode}`);
        return;
      }

      const acceptedConfig = { ...pendingConfig, consentAccepted: true };
      localRoomAdapter.saveRoomConfig(acceptedConfig);
      router.push(`/room/${acceptedConfig.roomCode}`);
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : "Live room setup failed.");
      setPendingConfig(null);
    } finally {
      setSubmitting(false);
    }
  }

  if (pendingConfig) {
    return <ConsentScreen onAccept={acceptConsent} busy={submitting} />;
  }

  return (
    <SetupShell>
      <div className="w-full max-w-[1040px]">
        <div className="mb-10 max-w-2xl">
          <h1 className="font-serif text-4xl leading-tight text-primary sm:text-5xl">
            Set up a study room.
          </h1>
          <p className="mt-4 text-lg leading-8 text-muted">
            Pick a goal, choose a focus block, and send your friends the code.
          </p>
        </div>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.9fr)] lg:items-start">
          <form onSubmit={startRoom} className="min-w-0">
            <p className="text-sm font-medium text-muted">Create a room</p>
            <h2 className="mt-2 text-2xl font-semibold text-primary">What are you working on?</h2>

            <div className="mt-6 space-y-5">
              <Field label="Your name">
                <input
                  aria-label="Your name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Maya"
                  className="w-full rounded-control border border-border bg-surface px-4 py-3 text-primary placeholder:text-muted/70"
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Subject">
                  <select
                    aria-label="Subject"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    className="w-full rounded-control border border-border bg-surface px-4 py-3 text-primary"
                  >
                    {demoSubjects.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Focus block">
                  <div className="grid grid-cols-4 gap-2">
                    {[15, 25, 45, 60].map((minutes) => (
                      <button
                        type="button"
                        key={minutes}
                        onClick={() => setDuration(minutes)}
                        className={`rounded-small border px-3 py-3 font-semibold shadow-none transition duration-200 active:scale-[0.98] ${
                          duration === minutes
                            ? "border-focus bg-focus text-white shadow-subtle"
                            : "border-border bg-surface text-primary hover:border-borderStrong hover:bg-surfaceHover"
                        }`}
                      >
                        {minutes}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 flex items-center gap-2 text-sm text-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-focus" aria-hidden="true" />
                    {rhythm}
                  </p>
                </Field>
              </div>
              <Field label="What do you want to finish?">
                <textarea
                  aria-label="What do you want to finish?"
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  placeholder="Finish the first ten chemistry problems and mark anything confusing."
                  rows={4}
                  className="w-full resize-none rounded-control border border-border bg-surface px-4 py-3 text-primary placeholder:text-muted/70"
                />
              </Field>

              <div className="border-t border-border pt-4">
                <div className="mb-3 h-px w-10 bg-focus" aria-hidden="true" />
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Your room</p>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={`${ticketSubject}-${duration}-${ticketGoal}`}
                    initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                    animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
                    exit={reduceMotion ? {} : { opacity: 0, y: -4 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="mt-2"
                  >
                    <p className="text-sm text-muted">
                      {ticketSubject} - {duration} minutes
                    </p>
                    <p className="mt-1 line-clamp-2 text-primary">{ticketGoal}</p>
                  </motion.div>
                </AnimatePresence>
              </div>

              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-control bg-focus px-5 py-3 font-semibold text-white transition hover:bg-focusDark active:scale-[0.99] sm:w-auto"
              >
                Create room
              </button>
            </div>
          </form>

          <aside className="min-w-0 border-t border-border pt-8 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <h2 className="text-xl font-semibold text-primary">Already have a code?</h2>
            <p className="mt-2 text-sm leading-6 text-muted">Enter the code someone in your group sent you.</p>
            <div className="mt-5 space-y-4">
              <Field label="Room code">
                <input
                  aria-label="Room code"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  placeholder="CREW42"
                  className="w-full rounded-control border border-border bg-surface px-4 py-3 font-mono text-primary placeholder:text-muted/70"
                />
              </Field>
              <button
                type="button"
                onClick={joinRoom}
                className="inline-flex w-full items-center justify-center rounded-control border border-border px-5 py-3 font-semibold text-primary transition hover:border-borderStrong hover:bg-surfaceHover"
              >
                Join room
              </button>
            </div>
            {liveError && (
              <p className="mt-4 border-l-2 border-focus pl-3 text-sm text-primary">
                {liveError}
              </p>
            )}

            <div className="mt-8 border-t border-border pt-6">
              <h3 className="text-base font-semibold text-primary">Trying Soryvo on your own?</h3>
              <button
                type="button"
                onClick={() => router.push("/room/CREW42")}
                className="mt-4 inline-flex w-full items-center justify-center rounded-control border border-border px-5 py-3 font-semibold text-primary transition hover:border-borderStrong hover:bg-surfaceHover active:scale-[0.99]"
              >
                Try a sample room
              </button>
              <p className="mt-3 text-sm leading-6 text-muted">
                Loads a prefilled practice room with example classmates, a shared timer, and a reset flow. No invite needed.
              </p>
              <p className="mt-2 text-xs text-muted">For hackathon judging and quick walkthroughs.</p>
            </div>
          </aside>
        </div>

        {!liveAvailable && (
          <p className="mt-10 border-t border-border pt-5 text-sm text-muted">
            Live rooms are unavailable in this local preview. You can still try the sample room.
          </p>
        )}
      </div>
    </SetupShell>
  );
}

function SetupShell({ children, loading = false }: { children?: React.ReactNode; loading?: boolean }) {
  return (
    <main className="min-h-screen px-5 py-6 sm:px-8">
      <div className="mx-auto mb-10 flex max-w-[1040px] items-center justify-between border-b border-border pb-4">
        <Link href="/" className="flex items-center gap-3" aria-label="Soryvo home">
          <SoryvoLogo variant="mark" size={32} priority className="object-contain" />
          <span className="font-serif text-xl font-semibold">Soryvo</span>
        </Link>
        <Link href="/" className="text-sm font-medium text-muted transition hover:text-primary">
          Back to home
        </Link>
      </div>
      <div className="grid place-items-center">
        {loading ? <div className="border-t border-border pt-6 text-muted">Loading room setup...</div> : children}
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="mb-2 block text-sm font-medium text-muted">{label}</span>
      {children}
    </div>
  );
}

function getSessionRhythm(minutes: number) {
  const breakMinutes = minutes === 15 ? 3 : minutes === 25 ? 5 : 10;
  return `${minutes}-minute focus - ${breakMinutes}-minute break`;
}

function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}
