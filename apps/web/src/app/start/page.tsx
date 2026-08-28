"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Nav } from "@/components/nav"
import { loadLocalPreferences, saveLocalPreferences, type WeeklyPreferences } from "@/lib/preferences"

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

  useEffect(() => {
    const saved = loadLocalPreferences()
    if (saved) {
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
  }, [])

  function buildMyWeek() {
    const hasMealPlan = mealSwipes !== "" && diningDollars !== "" && daysLeft !== ""
    const mealPlan = hasMealPlan
      ? {
          mealSwipesRemaining: Number(mealSwipes),
          diningDollarsRemaining: Number(diningDollars),
          daysLeftInTerm: Number(daysLeft),
        }
      : undefined

    saveLocalPreferences({ budget, optimizeFor, transportation, maxTravelMinutes, mealPlan })

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
          <CardTitle className="text-2xl">CampusSaver</CardTitle>
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

          <Button className="w-full" size="lg" onClick={buildMyWeek}>
            Build My Week
          </Button>
        </CardContent>
      </Card>
      </main>
    </div>
  )
}
