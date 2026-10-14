"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Nav } from "@/components/nav"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { UserIdentity } from "@supabase/supabase-js"

/**
 * Sign-in via magic link or Google with Calendar availability consent.
 * Once a session exists, /start
 * switches from localStorage to the real
 * savePreferencesToSupabase/loadPreferencesFromSupabase path (see
 * apps/web/src/lib/preferences.ts).
 */
export default function LoginPage() {
  return <Suspense fallback={<p className="p-8">Loading sign-in…</p>}><LoginForm /></Suspense>
}

function LoginForm() {
  const callbackError = useSearchParams().get("error")
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [calendarNotice, setCalendarNotice] = useState<string | null>(null)
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null)
  const [googleStatus, setGoogleStatus] = useState<"idle" | "redirecting" | "error">("idle")
  const [googleError, setGoogleError] = useState<string | null>(null)
  const [otherGoogleLogins, setOtherGoogleLogins] = useState<UserIdentity[]>([])
  const [unlinking, setUnlinking] = useState(false)
  const [accountNotice, setAccountNotice] = useState<string | null>(null)
  const [calendarState, setCalendarState] = useState<"checking" | "connected" | "not-connected" | "unavailable">("checking")

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        setSignedInEmail(user?.email ?? null)
        setOtherGoogleLogins(user?.identities?.filter((identity) => identity.provider === "google"
          && typeof identity.identity_data?.email === "string"
          && identity.identity_data.email.toLowerCase() !== user.email?.toLowerCase()) ?? [])
      })
      .catch(() => setError("Couldn't check your account. Try signing in again."))
  }, [])

  useEffect(() => {
    if (!signedInEmail) return
    let active = true
    async function checkCalendar() {
      try {
        const supabase = createClient()
        const { data: { user }, error: accountError } = await supabase.auth.getUser()
        if (accountError || !user || user.email !== signedInEmail) throw new Error("Account changed")
        const { data, error: connectionError } = await supabase.from("calendar_connections")
          .select("user_id").eq("user_id", user.id).maybeSingle()
        if (connectionError) throw connectionError
        if (active) setCalendarState(data ? "connected" : "not-connected")
      } catch {
        if (active) setCalendarState("unavailable")
      }
    }
    void checkCalendar()
    return () => { active = false }
  }, [signedInEmail])

  async function removeOtherGoogleLogin(identityId: string) {
    setUnlinking(true)
    setError(null)
    setAccountNotice(null)
    try {
      const supabase = createClient()
      const { data: { user }, error: accountError } = await supabase.auth.getUser()
      if (accountError || !user || user.email !== signedInEmail) throw new Error("Your account changed. Reload this page before removing a login.")
      const identity = user.identities?.find((item) => item.identity_id === identityId
        && item.provider === "google" && typeof item.identity_data?.email === "string"
        && item.identity_data.email.toLowerCase() !== user.email?.toLowerCase())
      if (!identity || (user.identities?.length ?? 0) < 2) throw new Error("This login cannot be removed. Reload and try again.")
      const { error: unlinkError } = await supabase.auth.unlinkIdentity(identity)
      if (unlinkError) {
        if (unlinkError.code === "manual_linking_disabled") throw new Error("The pilot organizer must temporarily enable login removal in Supabase, then disable it again after this link is removed.")
        throw unlinkError
      }
      setOtherGoogleLogins((identities) => identities.filter((item) => item.identity_id !== identityId))
      setAccountNotice(`${identity.identity_data?.email} is no longer a login for this account. Sign out, then sign in with that Google account to use it separately. Your saved items remain with ${user.email}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the linked Google login. Try again.")
    } finally {
      setUnlinking(false)
    }
  }

  async function sendMagicLink() {
    setStatus("sending")
    setError(null)
    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          shouldCreateUser: process.env.NEXT_PUBLIC_INVITE_ONLY !== "true",
        },
      })
      if (authError) throw authError
      setStatus("sent")
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Failed to send magic link")
    }
  }

  // Google sign-in requests availability access for the same Google account.
  async function signInWithGoogle() {
    setGoogleStatus("redirecting")
    setGoogleError(null)
    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: "https://www.googleapis.com/auth/calendar.freebusy",
          queryParams: { access_type: "offline", prompt: "consent select_account" },
        },
      })
      if (authError) throw authError
    } catch (err) {
      setGoogleStatus("error")
      setGoogleError(err instanceof Error ? err.message : "Failed to start Google sign-in")
    }
  }

  // Calendar consent must never link another login to the current account.
  async function connectGoogleCalendar() {
    setCalendarError(null)
    setCalendarNotice(null)
    try {
      const supabase = createClient()
      const { data: { user }, error: accountError } = await supabase.auth.getUser()
      if (accountError || !user) throw new Error("Sign in before connecting Calendar.")
      if (!user.email || !user.identities?.some((identity) => identity.provider === "google"
        && identity.identity_data?.email?.toLowerCase() === user.email?.toLowerCase())) {
        throw new Error("Sign out and sign in with Google using this account's email before connecting Calendar. Different accounts cannot be linked.")
      }
      const { error: linkError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          scopes: "https://www.googleapis.com/auth/calendar.freebusy",
          queryParams: { access_type: "offline", prompt: "consent select_account", login_hint: user.email },
          redirectTo: `${window.location.origin}/auth/callback?calendar=connect`,
        },
      })
      if (linkError) throw linkError
    } catch (err) {
      setCalendarError(err instanceof Error ? err.message : "Failed to start Google Calendar connection")
    }
  }

  const errorMessage = error ?? (callbackError === "calendar-account"
    ? "Calendar used a different account. You were signed out. Sign in again using the Google email that matches your Yums account."
    : callbackError === "auth-failed" ? "Sign-in could not be completed. Request a fresh link and try again." : null)
  const calendarMessage = calendarError ?? (callbackError === "calendar-failed" ? "Calendar connection could not be confirmed. Try connecting again." : null)

  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Sign in</CardTitle>
            <p className="text-muted-foreground text-sm">
              {process.env.NEXT_PUBLIC_INVITE_ONLY === "true" && "Invited Berkeley pilot users only. "}
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
              <div className="space-y-3">
                <p className="text-sm">Signed in as <span className="font-medium">{signedInEmail}</span>.</p>
                {otherGoogleLogins.map((identity) => (
                  <div key={identity.identity_id} className="space-y-2 rounded-md border p-3">
                    <p className="text-sm">Google login <strong>{identity.identity_data?.email}</strong> currently opens this account. Remove this link to use that email as a separate account. Your saved items stay with {signedInEmail}.</p>
                    <Button variant="outline" disabled={unlinking} onClick={() => removeOtherGoogleLogin(identity.identity_id)}>
                      {unlinking ? "Removing…" : `Remove linked login ${identity.identity_data?.email}`}
                    </Button>
                  </div>
                ))}
              </div>
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
                <p className="text-muted-foreground text-xs">Google sign-in also connects Calendar availability after you approve access. Yums checks busy times, without reading event titles or details.</p>
                {googleStatus === "error" && <p className="text-destructive text-xs">{googleError}</p>}

                <div className="flex items-center gap-2">
                  <div className="bg-border h-px flex-1" />
                  <span className="text-muted-foreground text-xs">or</span>
                  <div className="bg-border h-px flex-1" />
                </div>

                <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); sendMagicLink() }}>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@berkeley.edu"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={!email.trim() || status === "sending"}>
                  {status === "sending" ? "Sending…" : "Send magic link"}
                </Button>
                </form>
              </>
            )}
            {errorMessage && <p role="alert" className="text-destructive text-xs">{errorMessage}</p>}
            {accountNotice && <p role="status" className="text-sm">{accountNotice}</p>}
          </CardContent>
        </Card>

        {isSupabaseConfigured() && signedInEmail && (
          <Card className="mt-4 w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-lg">Google Calendar</CardTitle>
              <p className="text-muted-foreground text-sm">
                Google sign-in connects your calendar after you approve access. Yums uses busy times
                to find food opportunities that fit your schedule.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {calendarMessage && <p role="alert" className="text-destructive text-xs">{calendarMessage}</p>}
              {calendarNotice && <p role="status" className="text-muted-foreground text-xs">{calendarNotice}</p>}
              <p className="text-sm">{calendarState === "checking" ? "Checking Calendar connection…"
                : calendarState === "connected" ? "Google Calendar connected."
                : calendarState === "unavailable" ? "Couldn't check your Calendar connection. Reload to try again."
                : "Calendar isn't connected. Sign in with Google and approve Calendar access, or retry below."}</p>
              {(calendarState === "not-connected" || callbackError === "calendar-failed") && <Button className="w-full" variant="outline" onClick={connectGoogleCalendar}>
                Retry Calendar connection
              </Button>}
              {calendarState === "connected" && <Button className="w-full" variant="outline" onClick={async () => {
                setCalendarError(null)
                try {
                  const response = await fetch("/api/calendar/disconnect", { method: "POST" })
                  if (!response.ok) throw new Error("disconnect failed")
                  setCalendarState("not-connected")
                  setCalendarNotice("Stored Calendar connection removed. Reconnect to use your schedule again.")
                } catch { setCalendarError("Couldn't disconnect Calendar. Try again.") }
              }}>
                Disconnect Google Calendar
              </Button>}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
