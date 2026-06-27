"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

export function getSupabasePublishableKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

export function isSupabaseConfigured() {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}

export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(getSupabaseUrl(), getSupabasePublishableKey(), {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: "pkce",
        persistSession: true,
        storage: browserCookieStorage()
      },
      realtime: {
        params: {
          eventsPerSecond: 8
        }
      }
    });
  }

  return browserClient;
}

function browserCookieStorage() {
  return {
    getItem(key: string) {
      if (typeof window === "undefined") {
        return null;
      }

      const localValue = window.localStorage.getItem(key);
      if (localValue) {
        return localValue;
      }

      const cookie = document.cookie
        .split("; ")
        .find((item) => item.startsWith(`${encodeURIComponent(key)}=`));

      return cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : null;
    },
    setItem(key: string, value: string) {
      if (typeof window === "undefined") {
        return;
      }

      window.localStorage.setItem(key, value);
      document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; Path=/; Max-Age=2592000; SameSite=Lax`;
    },
    removeItem(key: string) {
      if (typeof window === "undefined") {
        return;
      }

      window.localStorage.removeItem(key);
      document.cookie = `${encodeURIComponent(key)}=; Path=/; Max-Age=0; SameSite=Lax`;
    }
  };
}
