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
})
