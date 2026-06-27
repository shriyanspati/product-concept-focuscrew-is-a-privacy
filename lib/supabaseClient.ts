"use client";

export {
  getSupabaseBrowserClient,
  getSupabasePublishableKey,
  getSupabaseUrl,
  isSupabaseConfigured
} from "@/lib/supabase/client";
export { ensureAnonymousSession, ensureEmailSession, isEmailSession } from "@/lib/supabase/ensureAnonymousSession";
