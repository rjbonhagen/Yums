import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Nav } from "@/components/nav"
import { buildRecommendations } from "@/lib/recommendations"

const STATS = [
  { value: "$24", label: "avg. weekly savings found" },
  { value: "3", label: "free food events near you today" },
  { value: "12 min", label: "typical walk to free food" },
]

const FEATURES = [
  {
    title: "Free Food Radar",
    body: "Club meetings, speaker series, and campus events with food, ranked by how close they are to your next class.",
  },
  {
    title: "Local Student Deals",
    body: "Student-ID discounts and happy-hour pricing at restaurants and cafes near campus, surfaced before they expire.",
  },
  {
    title: "Grocery Optimizer",
    body: "Compares prices across nearby stores and tells you when splitting a trip is actually worth the extra stop.",
  },
  {
    title: "Meal Plan Pacing",
    body: "Tracks swipes and dining dollars against days left in the term so nothing goes unused.",
  },
  {
    title: "Schedule Awareness",
    body: "Weighs opportunities against your class schedule — a 3-minute walk beats a 25-minute one, even if the food's the same.",
  },
  {
    title: "Save Money vs. Save Time",
    body: "One slider tunes every recommendation toward the cheapest option or the fewest trips, your call.",
  },
]

const STEPS = [
  { n: "01", title: "Tell it your week", body: "Budget, dietary needs, transportation, how far you'll walk." },
  { n: "02", title: "It scans campus", body: "Free food events, local deals, dining hall value, and grocery prices near you." },
  { n: "03", title: "You get a plan", body: "A day-by-day plan with exact costs, plus a ready-to-buy grocery basket." },
]

export default function HomePage() {
  const preview = buildRecommendations({ maxTravelMinutes: 20 }).slice(0, 3)

  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <main className="flex-1">
      {/* Hero */}
      <section className="border-b">
        <div className="mx-auto flex max-w-5xl flex-col items-center px-4 py-24 text-center">
          <Badge variant="secondary" className="mb-6 border-[#fdb515]/40 bg-[#fdb515]/15 text-[#003262] dark:text-[#fdb515]">
            Built for UC Berkeley
          </Badge>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-balance sm:text-6xl">
            The cheapest way to eat and live around campus
          </h1>
          <p className="text-muted-foreground mt-6 max-w-xl text-lg text-balance">
            CampusSaver finds free food, student deals, and cheap groceries near you, and
            turns them into a plan built around your schedule and your budget.
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
          {STATS.map((stat) => (
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
        <div className="mb-8 flex items-end justify-between">
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
                    {r.kind === "free_food" ? "FREE" : `$${r.estimatedSavings.toFixed(2)} off`}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm">{r.subtitle}</p>
                <p className="text-muted-foreground mt-1 text-xs">{r.distanceMinutes} min away</p>
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
