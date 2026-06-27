import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = getSafeNextPath(requestUrl.searchParams.get("next"));
  const redirectUrl = new URL(nextPath ?? "/signin", requestUrl.origin);
  redirectUrl.searchParams.set("verified", "1");

  if (!code) {
    redirectUrl.searchParams.set("auth_error", "missing_code");
    return NextResponse.redirect(redirectUrl);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    redirectUrl.searchParams.set("auth_error", "missing_supabase");
    return NextResponse.redirect(redirectUrl);
  }

  const response = NextResponse.redirect(redirectUrl);
  const secure = requestUrl.protocol === "https:";
  const cookieOptions = {
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax" as const,
    secure
  };

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: "pkce",
      persistSession: true,
      storage: {
        getItem(key: string) {
          return request.cookies.get(key)?.value ?? null;
        },
        setItem(key: string, value: string) {
          response.cookies.set(key, value, cookieOptions);
        },
        removeItem(key: string) {
          response.cookies.set(key, "", { ...cookieOptions, maxAge: 0 });
        }
      }
    }
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const fallbackUrl = new URL("/signin", requestUrl.origin);
    fallbackUrl.searchParams.set("auth_error", "link_failed");
    return NextResponse.redirect(fallbackUrl);
  }

  return response;
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
