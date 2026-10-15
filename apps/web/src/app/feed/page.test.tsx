import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }))
vi.mock("@/lib/supabase/client", () => ({ isSupabaseConfigured: () => true }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser } }) }))
vi.mock("@/lib/reported-events", () => ({ loadUpcomingReportedEvents: async () => [] }))
vi.mock("@/lib/google-calendar", () => ({ getConnectedCalendarAccessToken: async () => null }))
vi.mock("@/lib/server-preferences", () => ({ getPreferences: async () => ({ maxTravelMinutes: 20, optimizeFor: "cheapest" }) }))
vi.mock("@/lib/recommendations", () => ({ buildRecommendations: async () => ({ recommendations: [], meta: {
  freeFood: { source: "live" }, callink: { source: "live" }, nearbyEats: { source: "live" }, schedule: { source: "placeholder" },
} }) }))
vi.mock("@/components/nav", () => ({ Nav: () => null }))
vi.mock("@/components/recommendations-view", () => ({ RecommendationsView: () => <p>Public recommendations</p> }))
vi.mock("@/components/notification-toggle", () => ({ NotificationToggle: () => null }))
vi.mock("@/components/community-reports", () => ({ CommunityReports: () => <p>Report list</p> }))
import FeedPage from "./page"
beforeEach(() => vi.resetAllMocks())
describe("public feed during account outages", () => {
  it("renders source recommendations while disclosing unavailable community reports", async () => {
    getUser.mockRejectedValue(new Error("account offline"))
    render(await FeedPage())
    expect(screen.getByText("Public recommendations")).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("Community reports are unavailable")
    expect(screen.queryByText("Report list")).not.toBeInTheDocument()
  })
})
