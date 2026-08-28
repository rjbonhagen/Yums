import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Magic-link redirect target (see /login). Exchanges the emailed code for a
// real session cookie, then sends the user on to /start where preferences
// switch from localStorage to the authenticated Supabase read/write path.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Present only when this OAuth round-trip was a Google sign-in/link
      // with the calendar.freebusy scope (see /login's "Connect Google
      // Calendar" action). A plain magic-link sign-in has neither field —
      // that's the normal case, not an error, so this silently no-ops then.
      const providerToken = data.session?.provider_token
      const refreshToken = data.session?.provider_refresh_token
      if (providerToken && data.session?.user) {
        await supabase.from("calendar_connections").upsert({
          user_id: data.session.user.id,
          access_token: providerToken,
          refresh_token: refreshToken ?? null,
          // Google access tokens last ~1hr; refreshAccessToken() in
          // lib/google-calendar.ts renews this using refresh_token once it
          // expires — see that file's header comment.
          expires_at: new Date(Date.now() + 55 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
      }
      return NextResponse.redirect(`${origin}/start`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-failed`)
}
