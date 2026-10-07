"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Nav } from "@/components/nav"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { submitReportedEvent } from "@/lib/reported-events"

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

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return
    }
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => setSignedInUserId(user?.id ?? null))
      .catch(() => setSignedInUserId(null))
  }, [])

  async function handleSubmit() {
    if (!signedInUserId || !title.trim() || !startTime) return
    setStatus("submitting")
    setError(null)
    try {
      const supabase = createClient()
      await submitReportedEvent(supabase, signedInUserId, {
        title: title.trim(),
        locationName: locationName.trim() || undefined,
        startTime: new Date(startTime).toISOString(),
        description: description.trim() || undefined,
        sourceUrl: sourceUrl.trim() || undefined,
      })
      router.push("/feed")
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Failed to submit report")
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Report free food</CardTitle>
            <p className="text-muted-foreground text-sm">
              Found free food that isn&apos;t on the feed? Share it — shown on{" "}
              <Link href="/feed" className="underline underline-offset-4">
                the feed
              </Link>{" "}
              labeled as a community report, not verified.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {signedInUserId === undefined ? null : signedInUserId === null ? (
              <p className="text-muted-foreground text-sm">
                <Link href="/login" className="underline underline-offset-4">
                  Sign in
                </Link>{" "}
                to submit a report.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="title">What&apos;s free?</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Free boba at the ASUC table"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Where</Label>
                  <Input
                    id="location"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    placeholder="Sproul Plaza"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startTime">When</Label>
                  <Input
                    id="startTime"
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Details (optional)</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="While supplies last"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sourceUrl">Link (optional)</Label>
                  <Input
                    id="sourceUrl"
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="A flyer photo, Instagram post, etc."
                  />
                </div>
                {status === "error" && <p className="text-destructive text-xs">{error}</p>}
                <Button
                  className="w-full"
                  disabled={!title.trim() || !startTime || status === "submitting"}
                  onClick={handleSubmit}
                >
                  {status === "submitting" ? "Submitting…" : "Submit report"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
