"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Nav } from "@/components/nav"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { UserIdentity } from "@supabase/supabase-js"

export default function LoginPage() {
  return <Suspense fallback={<p className="p-8">Loading sign-in…</p>}><LoginForm /></Suspense>
}

function LoginForm() {
  const callbackError = useSearchParams().get("error")
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null)
  const [googleStatus, setGoogleStatus] = useState<"idle" | "redirecting" | "error">("idle")
  const [googleError, setGoogleError] = useState<string | null>(null)
  const [otherGoogleLogins, setOtherGoogleLogins] = useState<UserIdentity[]>([])
  const [unlinking, setUnlinking] = useState(false)
  const [accountNotice, setAccountNotice] = useState<string | null>(null)

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

  // Let the user choose the Google account used for saved events.
  async function signInWithGoogle() {
    setGoogleStatus("redirecting")
    setGoogleError(null)
    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { prompt: "select_account" },
        },
      })
      if (authError) throw authError
    } catch (err) {
      setGoogleStatus("error")
      setGoogleError(err instanceof Error ? err.message : "Failed to start Google sign-in")
    }
  }

  const errorMessage = error ?? (callbackError === "calendar-account"
    ? "Calendar used a different account. You were signed out. Sign in again using the Google email that matches your Yums account."
    : callbackError === "auth-failed" ? "Sign-in could not be completed. Request a fresh link and try again." : null)

  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">{signedInEmail ? "Your account" : "Keep your food finds"}</CardTitle>
            <p className="text-muted-foreground text-sm">
              {process.env.NEXT_PUBLIC_INVITE_ONLY === "true" && "Invited Berkeley pilot users only. "}
              Sign in to keep saved events across devices. You can browse and save in this browser without an account.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isSupabaseConfigured() ? (
              <p className="text-muted-foreground text-sm">
                Account sign-in is unavailable. You can still browse food events and save them in this browser.
              </p>
            ) : signedInEmail ? (
              <div className="space-y-3">
                <p className="text-sm">Signed in as <span className="font-medium">{signedInEmail}</span>.</p>
                <Link href="/saved" className="inline-block py-2 text-sm text-primary underline underline-offset-4">View your saved food</Link>
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

      </main>
    </div>
  )
}
