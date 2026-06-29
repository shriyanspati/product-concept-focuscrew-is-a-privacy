"use client";

export {
  getSupabaseBrowserClient,
  getSupabasePublishableKey,
  getSupabaseUrl,
  isSupabaseConfigured
} from "@/lib/supabase/client";
export {
  ensureEmailSession,
  ensureLiveRoomSession,
  isEmailSession,
  isLiveRoomSession
} from "@/lib/supabase/ensureAnonymousSession";
