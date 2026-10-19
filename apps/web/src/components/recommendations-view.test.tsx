import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Recommendation } from "@yums/shared"
import { RecommendationsView } from "./recommendations-view"

const now = "2026-10-14T18:00:00Z"
function rec(id: string, startTime: string, overrides: Partial<Recommendation> = {}): Recommendation {
  return { id, kind: "free_food", title: `Food ${id}`, subtitle: "Club · Soda Hall", startTime,
    sourceUrl: `https://callink.berkeley.edu/event/${id}`, estimatedSavings: 0, score: 1, ...overrides }
}
const today = rec("1", "2026-10-14T20:00:00Z", { title: "Pizza lunch" })
const tomorrow = rec("2", "2026-10-15T20:00:00Z", { title: "Free boba" })

describe("free food feed", () => {
  it("shows only upcoming food and orders events by time", () => {
    render(<RecommendationsView now={now} recommendations={[
      tomorrow, rec("old", "2026-10-13T20:00:00Z"), today,
      { ...today, id: "place", kind: "nearby_eats", title: "A restaurant" },
    ]} />)
    expect(screen.getAllByRole("heading", { level: 3 }).map((item) => item.textContent)).toEqual(["Pizza lunch", "Free boba"])
    expect(screen.queryByText("A restaurant")).not.toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Map" })).not.toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: /Cal Link/ }).map((link) => link.getAttribute("href"))).toContain(today.sourceUrl)
  })
  it("filters today and tomorrow using Berkeley dates", async () => {
    const user = userEvent.setup()
    render(<RecommendationsView now={now} recommendations={[today, tomorrow]} />)
    await user.click(screen.getByRole("button", { name: "Today" }))
    expect(screen.getByText("Pizza lunch")).toBeInTheDocument()
    expect(screen.queryByText("Free boba")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Tomorrow" }))
    expect(screen.getByText("Free boba")).toBeInTheDocument()
    expect(screen.queryByText("Pizza lunch")).not.toBeInTheDocument()
  })
  it("keeps an ongoing event from the previous day in Today", async () => {
    render(<RecommendationsView now="2026-10-15T07:15:00Z" recommendations={[
      rec("late", "2026-10-15T06:30:00Z", { endTime: "2026-10-15T08:00:00Z" }),
    ]} />)
    await userEvent.setup().click(screen.getByRole("button", { name: "Today" }))
    expect(screen.getByText("Food late")).toBeInTheDocument()
  })
  it("searches event names and locations with a useful empty state", async () => {
    const user = userEvent.setup()
    render(<RecommendationsView now={now} recommendations={[today, tomorrow]} />)
    const search = screen.getByRole("textbox", { name: "Search free food" })
    await user.type(search, "boba")
    expect(screen.queryByText("Pizza lunch")).not.toBeInTheDocument()
    await user.clear(search)
    await user.type(search, "Soda Hall")
    expect(screen.getByText("Pizza lunch")).toBeInTheDocument()
    await user.clear(search)
    await user.type(search, "no match")
    expect(screen.getByText("No matching food events")).toBeInTheDocument()
  })
  it("keeps recurring dates separate and collapses duplicate announcements", () => {
    const duplicate = { ...today, id: "duplicate", sourceUrl: "https://callink.berkeley.edu/event/3" }
    render(<RecommendationsView now={now} recommendations={[
      { ...today, endTime: "2026-10-14T21:00:00Z", seriesKey: "same series" },
      { ...duplicate, endTime: "2026-10-14T21:00:00Z", seriesKey: "same series" },
      { ...tomorrow, seriesKey: "same series" },
    ]} />)
    expect(screen.getAllByRole("article")).toHaveLength(2)
    expect(screen.getAllByRole("button", { name: "Save" })).toHaveLength(2)
  })
  it("combines campus source, date, and search filters", async () => {
    const user = userEvent.setup()
    render(<RecommendationsView now={now} recommendations={[
      today, tomorrow,
      rec("calendar", "2026-10-15T21:00:00Z", { title: "Pizza social", sourceUrl: "https://events.berkeley.edu/event/1" }),
    ]} />)
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by campus source" }), "Berkeley calendar")
    expect(screen.queryByText("Pizza lunch")).not.toBeInTheDocument()
    expect(screen.getByText("Pizza social")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Today" }))
    expect(screen.getByText("No matching food events")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Tomorrow" }))
    await user.type(screen.getByRole("textbox", { name: "Search free food" }), "Soda Hall")
    expect(screen.getByText("Pizza social")).toBeInTheDocument()
  })
  it("explains an empty source result without adding sample offers", () => {
    render(<RecommendationsView now={now} recommendations={[]} />)
    expect(screen.getByText("No free-food listings found")).toBeInTheDocument()
    expect(screen.queryByRole("article")).not.toBeInTheDocument()
  })
  it("shows a public repost once and lets each publisher be selected", async () => {
    const user = userEvent.setup()
    const campus = { ...today, id: "campus", sourceUrl: "https://events.berkeley.edu/live/events/1",
      subtitle: "UC Berkeley Events Calendar · Soda Hall", seriesKey: "UC Berkeley Events Calendar::Pizza lunch", endTime: "2026-10-14T21:00:00Z" }
    const graduate = { ...campus, id: "graduate", sourceUrl: "https://grad.berkeley.edu/event/pizza-lunch/",
      subtitle: "Graduate Assembly · Soda Hall", seriesKey: "Graduate Assembly::Pizza lunch" }
    render(<RecommendationsView now={now} recommendations={[campus, graduate]} />)
    expect(screen.getAllByRole("article")).toHaveLength(1)
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by campus source" }), "Graduate Division")
    expect(screen.getAllByRole("article")).toHaveLength(1)
    expect(screen.getByRole("link", { name: /View announcement/ })).toHaveAttribute("href", graduate.sourceUrl)
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by campus source" }), "Berkeley calendar")
    expect(screen.getByRole("link", { name: /View announcement/ })).toHaveAttribute("href", campus.sourceUrl)
  })
})
