import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_PREFERENCES } from "@/lib/preferences"
const mocks = vi.hoisted(() => ({ build: vi.fn() }))
vi.mock("@/lib/recommendations", () => ({ buildRecommendations: mocks.build }))
vi.mock("@/components/nav", () => ({ Nav: () => null }))
vi.mock("@/lib/google-calendar", () => ({ getConnectedCalendarAccessToken: async () => null }))
vi.mock("@/lib/server-preferences", () => ({ getPreferences: async () => DEFAULT_PREFERENCES }))
import HomePage from "./page"
import DashboardPage from "./dashboard/page"

const source = { source: "live" }
const outage = { source: "unavailable", error: "source timeout" }
const meta = { freeFood: source, callink: source, nearbyEats: source, schedule: { source: "placeholder" } }
beforeEach(() => { vi.clearAllMocks() })

describe("discovery pages distinguish outages from empty sources", () => {
  it("discloses all failed discovery sources on the homepage with unknown counts", async () => {
    mocks.build.mockResolvedValue({ recommendations: [], meta: { ...meta, freeFood: outage, callink: outage, nearbyEats: outage } })
    render(await HomePage())
    expect(screen.getByText(/Berkeley calendar is unavailable/)).toBeInTheDocument()
    expect(screen.getByText(/Cal Link is unavailable/)).toBeInTheDocument()
    expect(screen.getByText(/Nearby places are unavailable/)).toBeInTheDocument()
    expect(screen.getByText("free food events on campus today").parentElement).toHaveTextContent("—")
    expect(screen.getByText("nearby places listed").parentElement).toHaveTextContent("—")
  })
  it("keeps zero counts when sources successfully return no matches", async () => {
    mocks.build.mockResolvedValue({ recommendations: [], meta })
    render(await HomePage())
    expect(screen.queryByText(/is unavailable/)).not.toBeInTheDocument()
    expect(screen.getByText("free food events on campus today").parentElement).toHaveTextContent("0")
    expect(screen.getByText("nearby places listed").parentElement).toHaveTextContent("0")
  })
  it("does not claim an empty calendar when both event sources are unreachable", async () => {
    mocks.build.mockResolvedValue({ recommendations: [], meta: { ...meta, freeFood: outage, callink: outage } })
    render(await DashboardPage({ searchParams: Promise.resolve({}) } as Parameters<typeof DashboardPage>[0]))
    expect(screen.getByText(/Couldn't check today's free-food offers/)).toBeInTheDocument()
    expect(screen.getByText("Food events").parentElement).toHaveTextContent("—")
    expect(screen.queryByText(/No free food found/)).not.toBeInTheDocument()
  })
  it("limits an empty-food statement to available sources during partial outages", async () => {
    mocks.build.mockResolvedValue({ recommendations: [], meta: { ...meta, callink: outage } })
    render(await DashboardPage({ searchParams: Promise.resolve({}) } as Parameters<typeof DashboardPage>[0]))
    expect(screen.getByText(/No free food found in the available sources/)).toBeInTheDocument()
    expect(screen.getByText("Food events").parentElement).toHaveTextContent("0")
    expect(screen.getByText(/Cal Link unreachable/)).toBeInTheDocument()
  })
})
