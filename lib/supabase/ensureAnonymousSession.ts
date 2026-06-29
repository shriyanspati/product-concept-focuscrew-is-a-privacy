"use client";

import type { Session } from "@supabase/supabase-js";
import { isDebugAuthEnabled } from "@/lib/debugAuth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function isEmailSession(session: Session | null | undefined) {
  return Boolean(session?.user?.email && !session.user.is_anonymous);
}

export function isLiveRoomSession(session: Session | null | undefined) {
  return isEmailSession(session) || Boolean(isDebugAuthEnabled() && session?.user?.is_anonymous);
}

export async function ensureLiveRoomSession() {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (isLiveRoomSession(data.session)) {
    return data.session;
  }

  if (!isDebugAuthEnabled()) {
    throw new Error("Sign in with email before creating or joining a live room.");
  }

  const { data: anonymousData, error: anonymousError } = await supabase.auth.signInAnonymously();

  if (anonymousError || !anonymousData.session) {
    throw anonymousError ?? new Error("Development sign-in failed. Enable Anonymous Sign-Ins in Supabase Auth settings.");
  }

  return anonymousData.session;
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
