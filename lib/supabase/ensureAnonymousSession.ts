"use client";

import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

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
