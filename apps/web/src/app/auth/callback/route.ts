import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchBusyIntervals, verifyCalendarAccount } from "@/lib/google-calendar"
import { authRedirectOrigin } from "@/lib/auth-origin"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  let origin: string
  try { origin = authRedirectOrigin(request) } catch {
    return NextResponse.json({ error: "Sign-in is unavailable. Please contact the pilot organizer." }, { status: 503 })
  }
  const code = searchParams.get("code")
  const calendarRequested = searchParams.get("calendar") === "connect"
  try {
    if (code) {
      const supabase = await createClient()
      const initiatingUser = calendarRequested ? (await supabase.auth.getUser()).data.user : null
      if (calendarRequested && !initiatingUser) return NextResponse.redirect(`${origin}/login?error=calendar-failed`)
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) {
        // Honor existing Calendar reconnect links separately from ordinary sign-in.
        if (calendarRequested) {
          const token = data.session?.provider_token
          const user = data.session?.user
          if (calendarRequested && user?.id !== initiatingUser?.id) {
            await supabase.auth.signOut({ scope: "local" })
            return NextResponse.redirect(`${origin}/login?error=calendar-account`)
          }
          if (!token || !user?.email) return NextResponse.redirect(`${origin}/login?error=calendar-failed`)
          try {
            await verifyCalendarAccount(token, user.email)
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
        return NextResponse.redirect(`${origin}/`)
      }
    }
  } catch {
    // An unavailable auth service should leave a usable retry path.
  }
  return NextResponse.redirect(`${origin}/login?error=auth-failed`)
}
