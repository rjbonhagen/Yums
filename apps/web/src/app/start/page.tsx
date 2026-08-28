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
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    const saved = loadLocalPreferences()
    if (saved) {
      setBudget(saved.budget)
      setOptimizeFor(saved.optimizeFor)
      setTransportation(saved.transportation)
      setMaxTravelMinutes(saved.maxTravelMinutes)
      setRestored(true)
    }
  }, [])

  function buildMyWeek() {
    const prefs = { budget, optimizeFor, transportation, maxTravelMinutes }
    saveLocalPreferences(prefs)
    const params = new URLSearchParams({
      budget: String(budget),
      optimizeFor,
      transportation,
      maxTravelMinutes: String(maxTravelMinutes),
    })
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

          <Button className="w-full" size="lg" onClick={buildMyWeek}>
            Build My Week
          </Button>
        </CardContent>
      </Card>
      </main>
    </div>
  )
}
