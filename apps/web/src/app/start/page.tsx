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
  saveMealPlanToSupabase,
  type WeeklyPreferences,
} from "@/lib/preferences"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"

const OPTIMIZE_OPTIONS = [
  { value: "cheapest", label: "Cheapest" },
  { value: "healthy", label: "Healthy" },
  { value: "high_protein", label: "High Protein" },
  { value: "fast", label: "Fast" },
] as const

const TRANSPORT_OPTIONS = [
  { value: "walking", label: "Walking" },
  { value: "bike", label: "Bike" },
  { value: "car", label: "Car" },
  { value: "transit", label: "Transit" },
] as const

export default function StartPage() {
  const router = useRouter()
  const [budget, setBudget] = useState(60)
  const [optimizeFor, setOptimizeFor] = useState<WeeklyPreferences["optimizeFor"]>("cheapest")
  const [transportation, setTransportation] = useState<(typeof TRANSPORT_OPTIONS)[number]["value"]>("walking")
  const [maxTravelMinutes, setMaxTravelMinutes] = useState(20)
  const [mealSwipes, setMealSwipes] = useState("")
  const [diningDollars, setDiningDollars] = useState("")
  const [daysLeft, setDaysLeft] = useState("")
  const [restored, setRestored] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    function applyPrefs(saved: WeeklyPreferences) {
      setBudget(saved.budget)
      setOptimizeFor(saved.optimizeFor)
      setTransportation(saved.transportation)
      setMaxTravelMinutes(saved.maxTravelMinutes)
      if (saved.mealPlan) {
        setMealSwipes(String(saved.mealPlan.mealSwipesRemaining))
        setDiningDollars(String(saved.mealPlan.diningDollarsRemaining))
        setDaysLeft(String(saved.mealPlan.daysLeftInTerm))
      }
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
        // No row yet for a brand-new user — nothing to restore, not an error.
      }
    })
  }, [])

  async function buildMyWeek() {
    const hasMealPlan = mealSwipes !== "" && diningDollars !== "" && daysLeft !== ""
    const mealPlan = hasMealPlan
      ? {
          mealSwipesRemaining: Number(mealSwipes),
          diningDollarsRemaining: Number(diningDollars),
          daysLeftInTerm: Number(daysLeft),
        }
      : undefined

    const prefs: WeeklyPreferences = { budget, optimizeFor, transportation, maxTravelMinutes, mealPlan }

    if (userId && isSupabaseConfigured()) {
      setSaving(true)
      try {
        const supabase = createClient()
        await savePreferencesToSupabase(supabase, userId, prefs)
        if (mealPlan) await saveMealPlanToSupabase(supabase, userId, mealPlan)
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
    if (mealPlan) {
      params.set("mealSwipes", String(mealPlan.mealSwipesRemaining))
      params.set("diningDollars", String(mealPlan.diningDollarsRemaining))
      params.set("daysLeft", String(mealPlan.daysLeftInTerm))
    }
    router.push(`/dashboard?${params.toString()}`)
  }

  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Yums</CardTitle>
          <p className="text-muted-foreground text-sm">
            The cheapest way to live around campus.
          </p>
          {restored && (
            <p className="text-muted-foreground text-xs">Restored your last saved preferences.</p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="budget">How much do you want to spend this week?</Label>
            <Input
              id="budget"
              type="number"
              min={0}
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
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>University</Label>
            <Input value="UC Berkeley" disabled />
            <p className="text-muted-foreground text-xs">More campuses coming soon.</p>
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxTravel">Max travel time (minutes)</Label>
            <Input
              id="maxTravel"
              type="number"
              min={1}
              value={maxTravelMinutes}
              onChange={(e) => setMaxTravelMinutes(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label>Meal plan (optional)</Label>
            <p className="text-muted-foreground text-xs">
              We can&apos;t look this up for you — enter it from your dining account if you want pacing
              advice on the dashboard.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="mealSwipes" className="text-xs font-normal">
                  Swipes left
                </Label>
                <Input
                  id="mealSwipes"
                  type="number"
                  min={0}
                  value={mealSwipes}
                  onChange={(e) => setMealSwipes(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="diningDollars" className="text-xs font-normal">
                  Dining $
                </Label>
                <Input
                  id="diningDollars"
                  type="number"
                  min={0}
                  value={diningDollars}
                  onChange={(e) => setDiningDollars(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="daysLeft" className="text-xs font-normal">
                  Days left
                </Label>
                <Input
                  id="daysLeft"
                  type="number"
                  min={0}
                  value={daysLeft}
                  onChange={(e) => setDaysLeft(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Button className="w-full" size="lg" onClick={buildMyWeek} disabled={saving}>
            {saving ? "Saving…" : "Build My Week"}
          </Button>
        </CardContent>
      </Card>
      </main>
    </div>
  )
}
