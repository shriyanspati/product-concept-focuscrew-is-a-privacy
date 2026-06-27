"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { z } from "zod";
import { SoryvoLogo } from "@/components/SoryvoLogo";
import { SoryvoRoomPreview } from "@/components/SoryvoRoomPreview";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabaseClient";

const emailSchema = z.string().trim().email();
const pendingDisplayNameKey = "soryvo:pending-display-name";
const pendingEmailKey = "soryvo:pending-email";

type SignInState = "form" | "sent" | "verified";

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
  const nextFromQuery = getSafeNextPath(searchParams.get("next"));
  const verified = searchParams.get("verified") === "1";
  const authError = searchParams.get("auth_error");
  const [displayName, setDisplayName] = useState(nameFromQuery);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<SignInState>("form");
  const [messageEmail, setMessageEmail] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [mounted, setMounted] = useState(false);
  const supabaseReady = isSupabaseConfigured();

  useEffect(() => {
    setMounted(true);

    const savedName = window.localStorage.getItem(pendingDisplayNameKey);
    const savedEmail = window.localStorage.getItem(pendingEmailKey);

    if (!nameFromQuery && savedName) {
      setDisplayName(savedName);
    }

    if (savedEmail) {
      setEmail(savedEmail);
      setMessageEmail(savedEmail);
    }
  }, [nameFromQuery]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    if (authError) {
      setError("That sign-in link could not be used. Please request a fresh link.");
    }

    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      return;
    }

    const supabaseClient = supabase;
    let cancelled = false;

    async function loadSession() {
      const { data } = await supabaseClient.auth.getSession();
      const session = data.session;
      const user = session?.user;

      if (cancelled || !user?.email || user.is_anonymous) {
        return;
      }

      const savedName = window.localStorage.getItem(pendingDisplayNameKey);
      const metadataName = typeof user.user_metadata?.display_name === "string"
        ? user.user_metadata.display_name
        : "";
      const nextName = (displayName || savedName || metadataName).trim();

      if (nextName && nextName !== metadataName) {
        await supabaseClient.auth.updateUser({
          data: {
            display_name: nextName
          }
        });
      }

      if (nextName) {
        setDisplayName(nextName);
      }

      setEmail(user.email);
      setMessageEmail(user.email);
      setState("verified");
      window.localStorage.removeItem(pendingEmailKey);
      if (nextName) {
        window.localStorage.setItem(pendingDisplayNameKey, nextName);
      }
    }

    if (verified) {
      void loadSession();
      return () => {
        cancelled = true;
      };
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [authError, displayName, mounted, verified]);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function sendMagicLink(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError("");

    const normalizedName = displayName.trim();
    const parsedEmail = emailSchema.safeParse(email);

    if (!normalizedName) {
      setError("Add a display name before continuing.");
      return;
    }

    if (!parsedEmail.success) {
      setError("Enter a valid email address.");
      return;
    }

    if (!supabaseReady) {
      setError("Email sign-in needs Supabase setup first.");
      return;
    }

    const normalizedEmail = parsedEmail.data.toLowerCase();
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setError("Email sign-in needs Supabase setup first.");
      return;
    }

    setSending(true);

    try {
      window.localStorage.setItem(pendingDisplayNameKey, normalizedName);
      window.localStorage.setItem(pendingEmailKey, normalizedEmail);

      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: buildCallbackUrl(window.location.origin, nextFromQuery),
          data: {
            display_name: normalizedName
          }
        }
      });

      if (signInError) {
        throw signInError;
      }

      setMessageEmail(normalizedEmail);
      setState("sent");
      setCooldown(60);
    } catch {
      setError("We could not send that sign-in link. Please check the email and try again.");
    } finally {
      setSending(false);
    }
  }

  function continueToRoom() {
    const nextName = displayName.trim();
    if (nextFromQuery) {
      router.push(nextFromQuery);
      return;
    }

    router.push(nextName ? `/room?name=${encodeURIComponent(nextName)}` : "/room");
  }

  function resetEmail() {
    setState("form");
    setCooldown(0);
    setError("");
  }

  return (
    <SignInShell>
      <section className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-5xl place-items-center py-10">
        <div className="grid w-full gap-12 lg:grid-cols-[0.72fr_1fr] lg:items-center">
          <div className="flex flex-col justify-center">
            {state === "verified" ? (
              <VerifiedState
                displayName={displayName}
                email={messageEmail}
                onContinue={continueToRoom}
              />
            ) : state === "sent" ? (
              <SentState
                email={messageEmail}
                cooldown={cooldown}
                error={error}
                sending={sending}
                onResend={() => void sendMagicLink()}
                onReset={resetEmail}
              />
            ) : (
              <>
                <p className="text-sm font-medium text-muted">Enter your room</p>
                <h1 className="mt-3 font-serif text-4xl leading-none text-primary">Start with your details.</h1>
                <p className="mt-4 text-sm leading-6 text-muted">
                  We&apos;ll send a one-time sign-in link. No password needed.
                </p>

                <form onSubmit={sendMagicLink} noValidate className="mt-7 space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-muted">Display name</span>
                    <input
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="Your name"
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

                  {error && <p className="border-l-2 border-focus pl-3 text-sm text-primary">{error}</p>}

                  <button
                    type="submit"
                    disabled={sending}
                    className="inline-flex w-full items-center justify-center rounded-control bg-focus px-5 py-3 font-semibold text-white transition hover:bg-focusDark disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sending ? "Sending link..." : "Continue with email"}
                  </button>

                  <div className="flex items-center gap-3 text-sm text-muted">
                    <span className="h-px flex-1 bg-border" />
                    or
                    <span className="h-px flex-1 bg-border" />
                  </div>

                  <Link
                    href="/room/CREW42"
                    className="inline-flex w-full items-center justify-center rounded-control border border-border px-5 py-3 font-semibold text-primary transition hover:border-borderStrong hover:bg-surfaceHover"
                  >
                    Try Judge Demo
                  </Link>
                </form>

                <p className="mt-5 text-sm leading-6 text-muted">
                  Your email is used only to sign you in and save your rooms.
                </p>
              </>
            )}
          </div>

          <div className="border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            <SoryvoRoomPreview compact currentUserName={displayName} />
          </div>
        </div>
      </section>
    </SignInShell>
  );
}

function buildCallbackUrl(origin: string, nextPath: string | null) {
  const url = new URL("/auth/callback", origin);

  if (nextPath) {
    url.searchParams.set("next", nextPath);
  }

  return url.toString();
}

function getSafeNextPath(next: string | null) {
  if (!next) {
    return null;
  }

  if (next === "/room" || /^\/room\/[A-Z0-9]{6}$/.test(next)) {
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

function SentState({
  email,
  cooldown,
  error,
  sending,
  onResend,
  onReset
}: {
  email: string;
  cooldown: number;
  error: string;
  sending: boolean;
  onResend: () => void;
  onReset: () => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-muted">Check your inbox.</p>
      <h1 className="mt-3 font-serif text-4xl leading-none text-primary">We sent a sign-in link.</h1>
      <p className="mt-5 leading-7 text-muted">
        We sent a sign-in link to:
        <br />
        <span className="font-medium text-primary">{email}</span>
      </p>
      <p className="mt-4 text-sm leading-6 text-muted">Open the link to continue to Soryvo.</p>
      {error && <p className="mt-5 border-l-2 border-focus pl-3 text-sm text-primary">{error}</p>}
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onResend}
          disabled={cooldown > 0 || sending}
          className="rounded-control bg-focus px-5 py-3 font-semibold text-white transition hover:bg-focusDark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : sending ? "Sending..." : "Resend link"}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-control border border-border px-5 py-3 font-semibold text-primary transition hover:bg-surfaceHover"
        >
          Use a different email
        </button>
      </div>
    </div>
  );
}

function VerifiedState({
  displayName,
  email,
  onContinue
}: {
  displayName: string;
  email: string;
  onContinue: () => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-muted">You&apos;re signed in.</p>
      <h1 className="mt-3 font-serif text-4xl leading-none text-primary">Continue to Soryvo.</h1>
      <p className="mt-5 leading-7 text-muted">
        Continue to create a room or join one with your group.
      </p>
      {displayName && (
        <p className="mt-4 text-sm text-muted">
          Room display name: <span className="font-medium text-primary">{displayName}</span>
        </p>
      )}
      {email && <p className="mt-2 text-sm text-muted">Signed in privately with {email}.</p>}
      <button
        type="button"
        onClick={onContinue}
        className="mt-7 inline-flex w-full items-center justify-center rounded-control bg-focus px-5 py-3 font-semibold text-white transition hover:bg-focusDark sm:w-auto"
      >
        Continue
      </button>
    </div>
  );
}
