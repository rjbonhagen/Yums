import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Nav } from "@/components/nav"
import { buildRecommendations } from "@/lib/recommendations"
import { isToday } from "@/lib/event-time"
export const revalidate = 120

const FEATURES = [
  {
    title: "Free Food Radar",
    body: "Live from Berkeley's public events calendar — club meetings, speaker series, and campus events with food.",
  },
  {
    title: "Nearby Eats",
    body: "Browse cafes and restaurants near campus from OpenStreetMap. Menu prices and discounts aren't verified.",
  },
  {
    title: "Real Distances",
    body: "Approximate walking times use source coordinates and start at campus center. Events with no coordinates show distance unknown.",
  },
  {
    title: "Save Money vs. Save Time",
    body: "Set a max travel time and every recommendation is ranked against it, your call.",
  },
]

const STEPS = [
  { n: "01", title: "Tell it your week", body: "Set a budget target and how far you'll walk." },
  { n: "02", title: "It scans campus", body: "Live free food events and real nearby eateries, ranked by distance." },
  { n: "03", title: "You get a plan", body: "A ranked feed of what's actually happening today, near you, right now." },
]

export default async function HomePage() {
  const { recommendations, meta } = await buildRecommendations({ maxTravelMinutes: 20 })
  const todayRecommendations = recommendations.filter((r) => r.kind !== "free_food" || isToday(r.startTime, new Date(), r.endTime))
  const preview = todayRecommendations.slice(0, 3)
  const freeFoodCount = todayRecommendations.filter((r) => r.kind === "free_food").length
  const eatsCount = recommendations.filter((r) => r.kind === "nearby_eats").length
  const closest = [...todayRecommendations].filter((r) => r.distanceMinutes != null).sort((a, b) => a.distanceMinutes! - b.distanceMinutes!)[0]

  const stats = [
    { value: String(freeFoodCount), label: "free food events on campus today" },
    { value: String(eatsCount), label: "nearby places listed" },
    {
      value: closest?.distanceMinutes != null ? `${closest.distanceMinutes} min` : "—",
      label: "closest opportunity right now",
    },
  ]

  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <main className="flex-1">
      {meta.freeFood.source === "demo" && <p role="status" className="bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">Sample demo data · examples only, not real food offers.</p>}
      {meta.freeFood.source === "unavailable" && <p role="status" className="bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">Berkeley calendar is unavailable. Its events are omitted.</p>}
      {/* Hero */}
      <section className="border-b">
        <div className="mx-auto flex max-w-5xl flex-col items-center px-4 py-24 text-center">
          <Badge variant="secondary" className="mb-6 border-[#fdb515]/40 bg-[#fdb515]/15 text-[#003262] dark:text-[#fdb515]">
            Built for UC Berkeley
          </Badge>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-balance sm:text-6xl">
            Find your next free bite around campus
          </h1>
          <p className="text-muted-foreground mt-6 max-w-xl text-lg text-balance">
            Discover campus events offering free food and nearby places to eat.
            Choose shorter walks or free food first, and connect your calendar to check conflicts.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/start"
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-6 py-3 text-sm font-medium transition-colors"
            >
              Build My Week
            </Link>
            <Link
              href="/feed"
              className="hover:bg-muted rounded-lg border px-6 py-3 text-sm font-medium transition-colors"
            >
              See today&apos;s feed
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b">
        <div className="mx-auto grid max-w-5xl grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-1 px-6 py-10 text-center">
              <span className="text-4xl font-semibold">{stat.value}</span>
              <span className="text-muted-foreground text-sm">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-4 py-24">
        <div className="mb-12 max-w-xl">
          <h2 className="text-3xl font-semibold tracking-tight">Everything that goes into your week, in one place</h2>
          <p className="text-muted-foreground mt-3">
            You shouldn&apos;t have to check six apps to figure out how to eat cheap this week.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title}>
              <CardContent className="py-6">
                <h3 className="mb-2 font-medium">{f.title}</h3>
                <p className="text-muted-foreground text-sm">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-b bg-muted/40">
        <div className="mx-auto max-w-5xl px-4 py-24">
          <h2 className="mb-12 text-3xl font-semibold tracking-tight">How it works</h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.n}>
                <span className="text-muted-foreground text-sm font-mono">{step.n}</span>
                <h3 className="mt-2 mb-2 font-medium">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live preview */}
      <section className="mx-auto max-w-5xl px-4 py-24">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-3xl font-semibold tracking-tight">Happening near campus today</h2>
          <Link href="/feed" className="text-sm underline underline-offset-4">
            View full feed →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {preview.map((r) => (
            <Card key={r.id}>
              <CardContent className="py-5">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="font-medium">{r.title}</p>
                  <Badge variant={r.kind === "free_food" ? "default" : "secondary"}>
                    {r.kind === "free_food" ? "FREE" : r.kind === "nearby_eats" ? "Nearby" : `$${r.estimatedSavings.toFixed(2)} off`}
                  </Badge>
                </div>
                {r.isSample && <p className="text-xs text-amber-700">Sample listing</p>}
                {r.subtitle && <p className="text-muted-foreground text-sm">{r.subtitle}</p>}
                <p className="text-muted-foreground mt-1 text-xs">
                  {r.distanceMinutes != null ? `${r.distanceMinutes} min away` : "distance unknown"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t">
        <div className="mx-auto flex max-w-5xl flex-col items-center px-4 py-24 text-center">
          <h2 className="max-w-lg text-3xl font-semibold tracking-tight text-balance">
            Ready to see what you could save this week?
          </h2>
          <Link
            href="/start"
            className="bg-primary text-primary-foreground hover:bg-primary/90 mt-8 rounded-lg px-6 py-3 text-sm font-medium transition-colors"
          >
            Build My Week
          </Link>
        </div>
      </section>
      </main>
    </div>
  )
}
