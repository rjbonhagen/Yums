"use client"

import { isAuthSessionMissingError } from "@supabase/supabase-js"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Nav } from "@/components/nav"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { submitReportedEvent, validateReportedEvent } from "@/lib/reported-events"

/**
 * Crowdsourced free-food tip submission — for something a student found
 * that isn't on events.berkeley.edu or Cal Link. Shown on /feed's
 * "Community reports" section, always labeled unverified/user-submitted
 * (see lib/reported-events.ts) — this form collects real user input, it
 * doesn't verify or fact-check what's submitted.
 */
export default function ReportPage() {
  const router = useRouter()
  const [signedInUserId, setSignedInUserId] = useState<string | null | undefined>(() => isSupabaseConfigured() ? undefined : null)
  const [title, setTitle] = useState("")
  const [locationName, setLocationName] = useState("")
  const [startTime, setStartTime] = useState("")
  const [description, setDescription] = useState("")
  const [sourceUrl, setSourceUrl] = useState("")
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const accountRevision = useRef({ version: 0 })

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return
    }
    let active = true
    const accountState = accountRevision.current
    let changed = false
    let currentAccount: string | null | undefined
    const client = createClient()
    client.auth.getUser().then(({ data: { user }, error: authError }) => {
      if (!active || changed) return
      if (authError && !isAuthSessionMissingError(authError)) throw authError
      currentAccount = user?.id ?? null
      setSignedInUserId(currentAccount)
    }).catch(() => {
      if (!active || changed) return
      setSignedInUserId(null)
      setError("Couldn't check your account. Reload this page to try again.")
    })
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (!active || (event !== "SIGNED_IN" && event !== "SIGNED_OUT")) return
      const account = session?.user.id ?? null
      if (account === currentAccount) return
      changed = true
      currentAccount = account
      accountState.version++
      setSignedInUserId(account)
      setTitle(""); setLocationName(""); setStartTime(""); setDescription(""); setSourceUrl("")
      setStatus("idle")
      setError(null)
    })
    return () => { active = false; accountState.version++; subscription.unsubscribe() }
  }, [])

  async function handleSubmit() {
    if (!signedInUserId || !title.trim() || !startTime || status === "submitting") return
    const revision = accountRevision.current.version
    setStatus("submitting")
    setError(null)
    let input
    try {
      input = validateReportedEvent({ title, locationName, startTime, description, sourceUrl })
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Check the report details before submitting.")
      return
    }
    try {
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (revision !== accountRevision.current.version) return
      if (authError) throw authError
      if (user?.id !== signedInUserId) {
        setStatus("error")
        setError("Your account changed. Reload this page before submitting a report.")
        return
      }
      await submitReportedEvent(supabase, user.id, input)
      if (revision !== accountRevision.current.version) return
      router.push("/feed")
      router.refresh()
    } catch {
      if (revision !== accountRevision.current.version) return
      setStatus("error")
      setError("Couldn't confirm submission. Check your reports in the feed before trying again.")
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Share free food</CardTitle>
            <p className="text-muted-foreground text-sm">
              Found free food that isn&apos;t on the feed? Share it — shown on{" "}
              <Link href="/feed" className="underline underline-offset-4">
                the feed
              </Link>{" "}
              after review, labeled as a community report, not verified.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
            {signedInUserId === undefined ? <p role="status" className="text-muted-foreground text-sm">Checking your account…</p> : signedInUserId === null ? (
              <p className="text-muted-foreground text-sm">
                <Link href="/login" className="underline underline-offset-4">
                  Sign in
                </Link>{" "}
                to submit a report.
              </p>
            ) : (
              <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void handleSubmit() }}>
                <fieldset className="space-y-4" disabled={status === "submitting"}>
                <div className="space-y-2">
                  <Label htmlFor="title">What&apos;s free?</Label>
                  <Input
                    id="title"
                    required
                    maxLength={160}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Free boba at the ASUC table"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Where</Label>
                  <Input
                    id="location"
                    maxLength={160}
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    placeholder="Sproul Plaza"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startTime">When (your local time)</Label>
                  <Input
                    id="startTime"
                    type="datetime-local"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Details (optional)</Label>
                  <Input
                    id="description"
                    maxLength={2000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="While supplies last"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sourceUrl">Link (optional)</Label>
                  <Input
                    id="sourceUrl"
                    maxLength={2048}
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="A flyer photo, Instagram post, etc."
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={!title.trim() || !startTime || status === "submitting"}
                >
                  {status === "submitting" ? "Submitting…" : "Submit for review"}
                </Button>
                </fieldset>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
