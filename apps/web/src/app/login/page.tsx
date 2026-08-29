"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Nav } from "@/components/nav"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"

/**
 * Sign-in, via magic-link or Google OAuth (identity only — no calendar
 * scope, see signInWithGoogle below). Once a session exists, /start
 * switches from localStorage to the real
 * savePreferencesToSupabase/loadPreferencesFromSupabase path (see
 * apps/web/src/lib/preferences.ts).
 */
export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null)
  const [googleStatus, setGoogleStatus] = useState<"idle" | "redirecting" | "error">("idle")
  const [googleError, setGoogleError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => setSignedInEmail(user?.email ?? null))
  }, [])

  async function sendMagicLink() {
    setStatus("sending")
    setError(null)
    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (authError) throw authError
      setStatus("sent")
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Failed to send magic link")
    }
  }

  // Sign-in-only Google OAuth, separate from connectGoogleCalendar below —
  // no calendar.freebusy scope requested here, so this never triggers
  // Google's OAuth consent screen for calendar access. If this email
  // matches an existing magic-link account, Supabase's automatic identity
  // linking attaches this Google identity to that same user rather than
  // creating a duplicate.
  async function signInWithGoogle() {
    setGoogleStatus("redirecting")
    setGoogleError(null)
    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      if (authError) throw authError
    } catch (err) {
      setGoogleStatus("error")
      setGoogleError(err instanceof Error ? err.message : "Failed to start Google sign-in")
    }
  }

  // Real schedule-awareness (docs/architecture.md) — links Google's OAuth
  // identity to the current session with the calendar.freebusy scope, so
  // /auth/callback can store a real access/refresh token. Requires a
  // signed-in session already (magic link above) and a Google OAuth
  // provider configured in the Supabase project dashboard.
  async function connectGoogleCalendar() {
    setCalendarError(null)
    try {
      const supabase = createClient()
      const { error: linkError } = await supabase.auth.linkIdentity({
        provider: "google",
        options: {
          scopes: "https://www.googleapis.com/auth/calendar.freebusy",
          queryParams: { access_type: "offline", prompt: "consent" },
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (linkError) throw linkError
    } catch (err) {
      setCalendarError(err instanceof Error ? err.message : "Failed to start Google Calendar connection")
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Sign in</CardTitle>
            <p className="text-muted-foreground text-sm">
              Get a magic link so your budget and preferences sync across devices instead of staying in
              this browser&apos;s local storage.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isSupabaseConfigured() ? (
              <p className="text-muted-foreground text-sm">
                Sign-in isn&apos;t configured on this deployment (no Supabase project connected) — your
                preferences will keep saving to this browser only. See apps/web/.env.example.
              </p>
            ) : signedInEmail ? (
              <p className="text-sm">
                Signed in as <span className="font-medium">{signedInEmail}</span>.
              </p>
            ) : status === "sent" ? (
              <p className="text-sm">
                Check <span className="font-medium">{email}</span> for a sign-in link.
              </p>
            ) : (
              <>
                <Button
                  className="w-full"
                  variant="outline"
                  disabled={googleStatus === "redirecting"}
                  onClick={signInWithGoogle}
                >
                  {googleStatus === "redirecting" ? "Redirecting…" : "Continue with Google"}
                </Button>
                {googleStatus === "error" && <p className="text-destructive text-xs">{googleError}</p>}

                <div className="flex items-center gap-2">
                  <div className="bg-border h-px flex-1" />
                  <span className="text-muted-foreground text-xs">or</span>
                  <div className="bg-border h-px flex-1" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@berkeley.edu"
                  />
                </div>
                {status === "error" && <p className="text-destructive text-xs">{error}</p>}
                <Button className="w-full" disabled={!email || status === "sending"} onClick={sendMagicLink}>
                  {status === "sending" ? "Sending…" : "Send magic link"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {isSupabaseConfigured() && signedInEmail && (
          <Card className="mt-4 w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-lg">Schedule awareness</CardTitle>
              <p className="text-muted-foreground text-sm">
                Connect Google Calendar so recommendations can tell when you&apos;re actually free, instead
                of the flat placeholder score used otherwise.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {calendarError && <p className="text-destructive text-xs">{calendarError}</p>}
              <Button className="w-full" variant="outline" onClick={connectGoogleCalendar}>
                Connect Google Calendar
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
