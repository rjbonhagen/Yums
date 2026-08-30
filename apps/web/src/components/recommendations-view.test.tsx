import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Recommendation } from "@yums/shared"
import { RecommendationsView } from "./recommendations-view"

function rec(overrides: Partial<Recommendation>): Recommendation {
  return {
    id: "id",
    kind: "free_food",
    title: "title",
    estimatedSavings: 0,
    score: 1,
    ...overrides,
  }
}

const FREE_EVENT = rec({ id: "1", kind: "free_food", title: "Free pizza", subtitle: "ACM · Soda Hall" })
const NEARBY_PLACE = rec({ id: "2", kind: "nearby_eats", title: "Caffé Strada", subtitle: "2300 College Avenue" })

describe("RecommendationsView", () => {
  it("renders every recommendation by default", () => {
    render(<RecommendationsView recommendations={[FREE_EVENT, NEARBY_PLACE]} />)
    expect(screen.getByText("Free pizza")).toBeInTheDocument()
    expect(screen.getByText("Caffé Strada")).toBeInTheDocument()
  })

  it("shows an empty-state message when there are no recommendations at all", () => {
    render(<RecommendationsView recommendations={[]} />)
    expect(screen.getByText(/nothing found right now/i)).toBeInTheDocument()
  })

  it("filters to free food only", async () => {
    const user = userEvent.setup()
    render(<RecommendationsView recommendations={[FREE_EVENT, NEARBY_PLACE]} />)

    await user.click(screen.getByRole("button", { name: "Free food" }))

    expect(screen.getByText("Free pizza")).toBeInTheDocument()
    expect(screen.queryByText("Caffé Strada")).not.toBeInTheDocument()
  })

  it("filters to nearby eats only", async () => {
    const user = userEvent.setup()
    render(<RecommendationsView recommendations={[FREE_EVENT, NEARBY_PLACE]} />)

    await user.click(screen.getByRole("button", { name: "Nearby eats" }))

    expect(screen.getByText("Caffé Strada")).toBeInTheDocument()
    expect(screen.queryByText("Free pizza")).not.toBeInTheDocument()
  })

  it("searches by title", async () => {
    const user = userEvent.setup()
    render(<RecommendationsView recommendations={[FREE_EVENT, NEARBY_PLACE]} />)

    await user.type(screen.getByPlaceholderText(/search by name/i), "strada")

    expect(screen.getByText("Caffé Strada")).toBeInTheDocument()
    expect(screen.queryByText("Free pizza")).not.toBeInTheDocument()
  })

  it("searches by subtitle", async () => {
    const user = userEvent.setup()
    render(<RecommendationsView recommendations={[FREE_EVENT, NEARBY_PLACE]} />)

    await user.type(screen.getByPlaceholderText(/search by name/i), "soda hall")

    expect(screen.getByText("Free pizza")).toBeInTheDocument()
    expect(screen.queryByText("Caffé Strada")).not.toBeInTheDocument()
  })

  it("shows a distinct empty-state message when a filter/search excludes everything", async () => {
    const user = userEvent.setup()
    render(<RecommendationsView recommendations={[FREE_EVENT, NEARBY_PLACE]} />)

    await user.type(screen.getByPlaceholderText(/search by name/i), "nonexistent place")

    expect(screen.getByText(/nothing matches your filter\/search/i)).toBeInTheDocument()
  })

  describe("recurring-event grouping", () => {
    const MEETING_1 = rec({
      id: "m1",
      kind: "free_food",
      title: "Free pizza",
      subtitle: "ACM · Soda Hall",
      seriesKey: "ACM at UC Berkeley::Weekly General Meeting",
      startTime: "2026-09-01T18:00:00Z",
      sourceUrl: "https://events.berkeley.edu/1",
    })
    const MEETING_2 = rec({
      id: "m2",
      kind: "free_food",
      title: "Free pizza",
      subtitle: "ACM · Soda Hall",
      seriesKey: "ACM at UC Berkeley::Weekly General Meeting",
      startTime: "2026-09-08T18:00:00Z",
      sourceUrl: "https://events.berkeley.edu/2",
    })

    it("collapses two instances of the same exact seriesKey into one card", () => {
      render(<RecommendationsView recommendations={[MEETING_1, MEETING_2]} />)

      expect(screen.getByText(/recurring · 2 upcoming/i)).toBeInTheDocument()
      // Both dates still show, individually, inside the group.
      expect(screen.getByText(/Sep 1/)).toBeInTheDocument()
      expect(screen.getByText(/Sep 8/)).toBeInTheDocument()
    })

    it("does not group a lone free_food item even if it has a seriesKey", () => {
      render(<RecommendationsView recommendations={[MEETING_1, NEARBY_PLACE]} />)
      expect(screen.queryByText(/recurring/i)).not.toBeInTheDocument()
    })

    it("never groups items with different seriesKeys, even with the same display title", () => {
      const differentClub = rec({
        id: "m3",
        kind: "free_food",
        title: "Free pizza", // same displayed title as MEETING_1 — must not cause a false merge
        subtitle: "Different Club · Elsewhere",
        seriesKey: "Different Club::Totally Unrelated Event",
        startTime: "2026-09-03T18:00:00Z",
      })

      render(<RecommendationsView recommendations={[MEETING_1, differentClub]} />)

      expect(screen.queryByText(/recurring/i)).not.toBeInTheDocument()
    })
  })
})
