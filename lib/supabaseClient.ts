"use client";

export {
  getSupabaseBrowserClient,
  getSupabasePublishableKey,
  getSupabaseUrl,
  isSupabaseConfigured
} from "@/lib/supabase/client";
export { ensureEmailSession, isEmailSession } from "@/lib/supabase/ensureAnonymousSession";
