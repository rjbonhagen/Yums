"use client"

import { isAuthSessionMissingError } from "@supabase/supabase-js"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Nav } from "@/components/nav"
import {
  loadLocalPreferences,
  loadPreferencesFromSupabase,
  saveLocalPreferences,
  savePreferencesToSupabase,
  normalizePreferences,
  DEFAULT_PREFERENCES,
  type WeeklyPreferences,
} from "@/lib/preferences"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"

const OPTIMIZE_OPTIONS = [
  { value: "cheapest", label: "Free food first" },
  { value: "fast", label: "Shorter walks" },
] as const

const TRANSPORT_OPTIONS = [
  { value: "walking", label: "Walking" },
] as const

export default function StartPage() {
  const router = useRouter()
  const [budget, setBudget] = useState(60)
  const [optimizeFor, setOptimizeFor] = useState<WeeklyPreferences["optimizeFor"]>("cheapest")
  const [transportation, setTransportation] = useState<(typeof TRANSPORT_OPTIONS)[number]["value"]>("walking")
  const [maxTravelMinutes, setMaxTravelMinutes] = useState(20)
  const [restored, setRestored] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [syncError, setSyncError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let revision = 0
    let currentAccount: string | null | undefined
    function applyPrefs(saved: WeeklyPreferences) {
      setBudget(saved.budget)
      setOptimizeFor(saved.optimizeFor)
      setTransportation(saved.transportation)
      setMaxTravelMinutes(saved.maxTravelMinutes)
      setRestored(true)
    }

    async function restore(user: { id: string } | null, version: number) {
      if (!active || version !== revision) return
      currentAccount = user?.id ?? null
      setUserId(currentAccount)
      setLoading(true)
      setSyncError(null)
      setRestored(false)
      const browserPrefs = loadLocalPreferences()
      applyPrefs(DEFAULT_PREFERENCES)
      setRestored(false)
      if (!user) {
        if (browserPrefs) applyPrefs(browserPrefs)
        setLoading(false)
        return
      }
      try {
        const saved = await loadPreferencesFromSupabase(createClient(), user.id)
        if (active && version === revision && saved) applyPrefs(saved)
      } catch {
        if (active && version === revision) {
          if (browserPrefs) applyPrefs(browserPrefs)
          setSyncError("Couldn't load account preferences. Browser settings are shown; save again to sync them.")
        }
      } finally {
        if (active && version === revision) setLoading(false)
      }
    }

    if (!isSupabaseConfigured()) {
      void restore(null, revision)
      return () => { active = false }
    }

    // Signed-in users get their preferences from Supabase (synced across
    // devices) instead of this browser's localStorage — falls back to
    // localStorage if there's no session, same as an unconfigured deployment.
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (revision !== 0 || !active) return
      if (error && !isAuthSessionMissingError(error)) throw error
      return restore(user, revision)
    }).catch(() => {
      if (revision !== 0 || !active) return
      void restore(null, revision)
      setSyncError("Couldn't check your account. Retry before syncing preferences across devices.")
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || (event !== "SIGNED_IN" && event !== "SIGNED_OUT")) return
      const account = session?.user.id ?? null
      if (account === currentAccount) return
      revision++
      // Do not await database work inside the Auth event callback.
      void restore(session?.user ?? null, revision)
    })
    return () => { active = false; revision++; subscription.unsubscribe() }
  }, [])

  async function buildMyWeek() {
    if (saving || loading) return
    const prefs = normalizePreferences({ budget, optimizeFor, transportation, maxTravelMinutes })
    saveLocalPreferences(prefs)
    setSaving(true)
    setSyncError(null)
    try {
      if (isSupabaseConfigured()) {
        const supabase = createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error && !isAuthSessionMissingError(error)) throw error
        if ((user?.id ?? null) !== userId) {
          setSyncError("Your account changed. Reload this page before saving preferences.")
          return
        }
        if (user) await savePreferencesToSupabase(supabase, user.id, prefs)
      }
      const params = new URLSearchParams({
        budget: String(prefs.budget), optimizeFor: prefs.optimizeFor,
        transportation: prefs.transportation, maxTravelMinutes: String(prefs.maxTravelMinutes),
      })
      router.push(`/dashboard?${params.toString()}`)
      router.refresh()
    } catch {
      setSyncError("Saved in this browser, but couldn't sync your account preferences. Try again before continuing.")
    } finally { setSaving(false) }
  }

  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Yums</CardTitle>
          <p className="text-muted-foreground text-sm">
            Find free food and nearby eats around campus.
          </p>
          {restored && (
            <p className="text-muted-foreground text-xs">Restored your last saved preferences.</p>
          )}
          {syncError && <p role="alert" className="text-destructive text-sm">{syncError}</p>}
        </CardHeader>
        <CardContent className="space-y-6">
          <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); void buildMyWeek() }}>
          <fieldset className="space-y-6" disabled={loading || saving}>
          <div className="space-y-2">
            <Label htmlFor="budget">How much do you want to spend this week?</Label>
            <Input
              id="budget"
              type="number"
              min={0}
              max={1000}
              step="0.01"
              required
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="text-lg"
            />
          </div>

          <div className="space-y-2">
            <Label>What are you optimizing for?</Label>
            <div className="grid grid-cols-2 gap-2">
              {OPTIMIZE_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant={optimizeFor === opt.value ? "default" : "outline"}
                  onClick={() => setOptimizeFor(opt.value)}
                  aria-pressed={optimizeFor === opt.value}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>University</Label>
            <Input value="UC Berkeley" disabled />
            <p className="text-muted-foreground text-xs">This release covers UC Berkeley.</p>
          </div>

          <div className="space-y-2">
            <Label>Transportation</Label>
            <div className="grid grid-cols-2 gap-2">
              {TRANSPORT_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant={transportation === opt.value ? "default" : "outline"}
                  onClick={() => setTransportation(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">Walking estimates start at campus center. Nutrition and other travel modes aren&apos;t available.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxTravel">Max travel time (minutes)</Label>
            <Input
              id="maxTravel"
              type="number"
              min={1}
              max={120}
              required
              value={maxTravelMinutes}
              onChange={(e) => setMaxTravelMinutes(Number(e.target.value))}
            />
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={loading || saving}>
            {loading ? "Restoring preferences…" : saving ? "Saving…" : "Build My Week"}
          </Button>
          </fieldset>
          </form>
        </CardContent>
      </Card>
      </main>
    </div>
  )
}
