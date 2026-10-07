"use client"

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

  useEffect(() => {
    function applyPrefs(saved: WeeklyPreferences) {
      setBudget(saved.budget)
      setOptimizeFor(saved.optimizeFor)
      setTransportation(saved.transportation)
      setMaxTravelMinutes(saved.maxTravelMinutes)
      setRestored(true)
    }

    if (!isSupabaseConfigured()) {
      const saved = loadLocalPreferences()
      if (saved) applyPrefs(saved)
      return
    }

    // Signed-in users get their preferences from Supabase (synced across
    // devices) instead of this browser's localStorage — falls back to
    // localStorage if there's no session, same as an unconfigured deployment.
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        const saved = loadLocalPreferences()
        if (saved) applyPrefs(saved)
        return
      }
      setUserId(user.id)
      try {
        const saved = await loadPreferencesFromSupabase(supabase, user.id)
        if (saved) applyPrefs(saved)
      } catch {
        const saved = loadLocalPreferences()
        if (saved) applyPrefs(saved)
      }
    }).catch(() => {
      const saved = loadLocalPreferences()
      if (saved) applyPrefs(saved)
    })
  }, [])

  async function buildMyWeek() {
    const prefs = normalizePreferences({ budget, optimizeFor, transportation, maxTravelMinutes })
    saveLocalPreferences(prefs)

    if (userId && isSupabaseConfigured()) {
      setSaving(true)
      try {
        const supabase = createClient()
        await savePreferencesToSupabase(supabase, userId, prefs)
      } catch {
        // Real Supabase write failed (network, RLS, etc.) — still fall back
        // to localStorage below so the user's input isn't lost.
        saveLocalPreferences(prefs)
      } finally {
        setSaving(false)
      }
    } else {
      saveLocalPreferences(prefs)
    }

    const params = new URLSearchParams({
      budget: String(budget),
      optimizeFor,
      transportation,
      maxTravelMinutes: String(maxTravelMinutes),
    })
    router.push(`/dashboard?${params.toString()}`)
    router.refresh()
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
        </CardHeader>
        <CardContent className="space-y-6">
          <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); void buildMyWeek() }}>
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
            <p className="text-muted-foreground text-xs">This demo covers UC Berkeley.</p>
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

          <Button type="submit" className="w-full" size="lg" disabled={saving}>
            {saving ? "Saving…" : "Build My Week"}
          </Button>
          </form>
        </CardContent>
      </Card>
      </main>
    </div>
  )
}
