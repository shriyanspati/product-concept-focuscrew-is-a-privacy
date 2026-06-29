"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { z } from "zod";
import { SoryvoLogo } from "@/components/SoryvoLogo";
import { SoryvoRoomPreview } from "@/components/SoryvoRoomPreview";
import { loadDebugIdentity, saveDebugIdentity } from "@/lib/debugAuth";
import { ensureLiveRoomSession } from "@/lib/supabase/ensureAnonymousSession";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabaseClient";

const emailSchema = z.string().trim().email();
const displayNameKey = "soryvo:pending-display-name";

export function SignInPage() {
  return (
    <Suspense fallback={<SignInShell loading />}>
      <SignInPageInner />
    </Suspense>
  );
}

function SignInPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nameFromQuery = searchParams.get("name") ?? "";
  const nextPath = getSafeNextPath(searchParams.get("next"));
  const [displayName, setDisplayName] = useState(nameFromQuery);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const savedIdentity = loadDebugIdentity();
    const savedName = window.localStorage.getItem(displayNameKey);

    if (!nameFromQuery) {
      setDisplayName(savedIdentity?.displayName || savedName || "");
    }
    setEmail(savedIdentity?.email || "");
  }, [nameFromQuery]);

  async function continueToSoryvo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const normalizedName = displayName.trim();
    const parsedEmail = emailSchema.safeParse(email);

    if (!normalizedName) {
      setError("Add your name before continuing.");
      return;
    }

    if (!parsedEmail.success) {
      setError("Enter a valid email address.");
      return;
    }

    const normalizedEmail = parsedEmail.data.toLowerCase();
    setSubmitting(true);

    try {
      if (isSupabaseConfigured()) {
        const session = await ensureLiveRoomSession();
        const supabase = getSupabaseBrowserClient();

        if (!session) {
          throw new Error("Guest session could not be created.");
        }

        if (supabase && session.user.user_metadata?.display_name !== normalizedName) {
          const { error: updateError } = await supabase.auth.updateUser({
            data: { display_name: normalizedName, soryvo_guest: true }
          });
          if (updateError) {
            throw updateError;
          }
        }
      }

      saveDebugIdentity({ displayName: normalizedName, email: normalizedEmail });
      window.localStorage.setItem(displayNameKey, normalizedName);

      const destination = nextPath ?? `/room?name=${encodeURIComponent(normalizedName)}`;
      router.push(destination);
    } catch (signInError) {
      console.error("[Soryvo] Guest sign-in failed", signInError);
      const detail = signInError instanceof Error ? signInError.message : "Unknown sign-in error";
      setError(`Could not start your guest session: ${detail}. Enable Anonymous Sign-Ins in Supabase Auth settings.`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SignInShell>
      <section className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-5xl place-items-center py-10">
        <div className="grid w-full gap-12 lg:grid-cols-[0.72fr_1fr] lg:items-center">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-medium text-muted">Enter your room</p>
            <h1 className="mt-3 font-serif text-4xl leading-none text-primary">Start with your details.</h1>
            <p className="mt-4 text-sm leading-6 text-muted">
              No password and no email verification. Your email stays private and your name is what the room sees.
            </p>

            <form onSubmit={continueToSoryvo} noValidate className="mt-7 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-muted">Display name</span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  required
                  className="w-full rounded-control border border-border bg-surface px-4 py-3 text-primary placeholder:text-muted/70"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-muted">Email</span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full rounded-control border border-border bg-surface px-4 py-3 text-primary placeholder:text-muted/70"
                />
              </label>

              {error && <p className="border-l-2 border-alert pl-3 text-sm text-primary">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center rounded-control bg-focus px-5 py-3 font-semibold text-white transition hover:bg-focusDark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Entering Soryvo..." : "Continue to Soryvo"}
              </button>

              <Link
                href="/room/CREW42"
                className="inline-flex w-full items-center justify-center rounded-control border border-border px-5 py-3 font-semibold text-primary transition hover:border-borderStrong hover:bg-surfaceHover"
              >
                Try Judge Demo
              </Link>
            </form>
          </div>

          <div className="border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            <SoryvoRoomPreview compact currentUserName={displayName} />
          </div>
        </div>
      </section>
    </SignInShell>
  );
}

function getSafeNextPath(next: string | null) {
  if (next === "/room" || (next && /^\/room\/[A-Z0-9]{6}$/.test(next))) {
    return next;
  }
  return null;
}

function SignInShell({ children, loading = false }: { children?: React.ReactNode; loading?: boolean }) {
  return (
    <main className="min-h-screen bg-background px-5 py-5 sm:px-8">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between border-b border-border pb-4">
        <Link href="/" className="flex items-center gap-3" aria-label="Soryvo home">
          <SoryvoLogo variant="mark" size={30} priority className="shrink-0 object-contain" />
          <span className="font-serif text-2xl tracking-wide text-primary">Soryvo</span>
        </Link>
        <Link href="/" className="text-sm font-medium text-muted transition hover:text-primary">
          Back to home
        </Link>
      </nav>
      {loading ? (
        <div className="mx-auto mt-16 max-w-5xl border-t border-border pt-6 text-muted">Loading sign-in...</div>
      ) : children}
    </main>
  );
}
