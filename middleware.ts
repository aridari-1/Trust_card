// middleware.ts  (place at project root, same level as app/)
// Handles session refresh in one place — prevents parallel server requests
// from each trying to use the same refresh token simultaneously.

import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write updated tokens to both the request and response
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value)
          );
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — runs once per request in middleware,
  // not once per server component. This is what stops the race condition.
  await supabase.auth.getUser();

  return res;
}

export const config = {
  matcher: [
    // Run on all routes except static files and api routes
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};