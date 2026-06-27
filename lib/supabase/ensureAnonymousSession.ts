"use client";

import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export async function ensureAnonymousSession() {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (sessionData.session) {
    return sessionData.session;
  }

  const { data, error } = await supabase.auth.signInAnonymously();

  if (error || !data.session) {
    throw error ?? new Error("Anonymous sign-in failed.");
  }

  return data.session;
}

export function isEmailSession(session: Session | null | undefined) {
  return Boolean(session?.user?.email && !session.user.is_anonymous);
}

export async function ensureEmailSession() {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (!isEmailSession(data.session)) {
    throw new Error("Sign in with email before creating or joining a live room.");
  }

  return data.session;
}
