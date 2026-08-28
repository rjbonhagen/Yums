import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { isSupabaseConfigured } from "./client"

/**
 * Refreshes the Supabase auth session cookie on every request so a signed-in
 * user stays signed in across navigation. No-ops when Supabase isn't
 * configured (see apps/web/.env.example) — the app runs auth-free on
 * localStorage-only preferences in that case, same as today.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next({ request })

  if (!isSupabaseConfigured()) return response

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options)
        },
      },
    },
  )

  // Required: this call refreshes the session token and must not be
  // removed, even though the result is unused here (Supabase SSR docs).
  await supabase.auth.getUser()

  return response
}
