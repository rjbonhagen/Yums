import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
const { getUser, build } = vi.hoisted(() => ({ getUser: vi.fn(), build: vi.fn() }))
vi.mock("@/lib/supabase/client", () => ({ isSupabaseConfigured: () => true }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser } }) }))
vi.mock("@/lib/reported-events", () => ({ loadUpcomingReportedEvents: async () => [] }))
vi.mock("@/lib/recommendations", () => ({ buildRecommendations: build }))
vi.mock("@/components/nav", () => ({ Nav: () => null }))
vi.mock("@/components/recommendations-view", () => ({ RecommendationsView: ({ notices, children }: { notices?: ReactNode; children?: ReactNode }) => <><p>Public recommendations</p>{notices}{children}</> }))
vi.mock("@/components/community-reports", () => ({ CommunityReports: () => <p>Report list</p> }))
import FeedPage from "./page"
beforeEach(() => {
  vi.resetAllMocks()
  getUser.mockResolvedValue({ data: { user: null }, error: null })
  build.mockResolvedValue({ recommendations: [], meta: {
    freeFood: { source: "live" }, graduate: { source: "live" }, nearbyEats: { source: "live" },
  } })
})

describe("public food feed", () => {
  it("renders food while disclosing unavailable community reports during account outages", async () => {
    getUser.mockRejectedValue(new Error("account offline"))
    render(await FeedPage())
    expect(screen.getByText("Public recommendations")).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("Community reports are unavailable")
    expect(screen.queryByText("Report list")).not.toBeInTheDocument()
  })
  it("requests only food and discloses source outages without raw errors", async () => {
    build.mockResolvedValue({ recommendations: [], meta: {
      freeFood: { source: "unavailable", error: "internal connection detail" }, graduate: { source: "live" },
    } })
    render(await FeedPage())
    expect(build).toHaveBeenCalledWith({ maxTravelMinutes: 20, freeFoodOnly: true })
    expect(screen.getByRole("status")).toHaveTextContent("Berkeley calendar is unavailable")
    expect(screen.queryByText(/internal connection detail/)).not.toBeInTheDocument()
    expect(screen.queryByText(/budget|Calendar connection|OpenStreetMap/i)).not.toBeInTheDocument()
  })
  it("links public calendars without prompting for CalNet", async () => {
    render(await FeedPage())
    expect(screen.getByRole("link", { name: "Berkeley calendar" })).toHaveAttribute("href", "https://events.berkeley.edu/")
    expect(screen.getByRole("link", { name: "Graduate Division" })).toHaveAttribute("href", "https://grad.berkeley.edu/events-calendar/")
    expect(screen.queryByText(/CalNet|requires Berkeley/)).not.toBeInTheDocument()
  })
  it("discloses Graduate Division failures without hiding the other calendar", async () => {
    build.mockResolvedValue({ recommendations: [], meta: {
      freeFood: { source: "live" }, graduate: { source: "unavailable" },
    } })
    render(await FeedPage())
    expect(screen.getByRole("status")).toHaveTextContent("Graduate Division calendar is unavailable")
    expect(screen.getByRole("status")).toHaveTextContent("The other calendar is still being checked")
  })
  it("does not claim other campus sources are available when both imports are unavailable", async () => {
    build.mockResolvedValue({ recommendations: [], meta: {
      freeFood: { source: "unavailable" }, graduate: { source: "unavailable" },
    } })
    render(await FeedPage())
    expect(screen.queryByText(/Events from other sources still appear/)).not.toBeInTheDocument()
    expect(screen.getByText(/Campus events can’t be checked right now/)).toBeInTheDocument()
  })
})
