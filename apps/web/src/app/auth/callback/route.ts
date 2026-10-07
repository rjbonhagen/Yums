import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchBusyIntervals } from "@/lib/google-calendar"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const calendarRequested = searchParams.get("calendar") === "connect"
  try {
    if (code) {
      const supabase = await createClient()
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) {
        // Plain Google sign-in also supplies a provider token. Store Calendar
        // credentials only for an explicit connection and a successful scope check.
        if (calendarRequested) {
          const token = data.session?.provider_token
          const user = data.session?.user
          if (!token || !user) return NextResponse.redirect(`${origin}/login?error=calendar-failed`)
          try {
            const now = new Date()
            await fetchBusyIntervals(token, now, new Date(now.getTime() + 60000))
            const previous = await supabase.from("calendar_connections")
              .select("refresh_token").eq("user_id", user.id).maybeSingle()
            if (previous.error) throw previous.error
            const saved = await supabase.from("calendar_connections").upsert({
              user_id: user.id, access_token: token,
              refresh_token: data.session?.provider_refresh_token ?? previous.data?.refresh_token ?? null,
              expires_at: new Date(Date.now() + 55 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            if (saved.error) throw saved.error
          } catch {
            return NextResponse.redirect(`${origin}/login?error=calendar-failed`)
          }
        }
        return NextResponse.redirect(`${origin}/start`)
      }
    }
  } catch {
    // An unavailable auth service should leave a usable retry path.
  }
  return NextResponse.redirect(`${origin}/login?error=auth-failed`)
}
