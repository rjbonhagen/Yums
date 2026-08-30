import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SavedList } from "./saved-list"
import type { SavedItem } from "@/lib/saved-items"

const { unsaveItem, createClient } = vi.hoisted(() => ({
  unsaveItem: vi.fn(),
  createClient: vi.fn(() => ({})),
}))

vi.mock("@/lib/saved-items", () => ({ unsaveItem }))
vi.mock("@/lib/supabase/client", () => ({ createClient }))

const ITEM: SavedItem = {
  id: "rec-1",
  kind: "free_food",
  title: "Free pizza",
  subtitle: "ACM · Soda Hall",
  startTime: "2026-08-29T18:00:00Z",
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("SavedList", () => {
  it("shows an empty-state message with no saved items", () => {
    render(<SavedList userId="user-1" initialItems={[]} />)
    expect(screen.getByText(/nothing saved yet/i)).toBeInTheDocument()
  })

  it("renders each saved item", () => {
    render(<SavedList userId="user-1" initialItems={[ITEM]} />)
    expect(screen.getByText("Free pizza")).toBeInTheDocument()
    expect(screen.getByText("ACM · Soda Hall")).toBeInTheDocument()
  })

  it("removes an item on success and calls unsaveItem scoped to the user", async () => {
    unsaveItem.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<SavedList userId="user-1" initialItems={[ITEM]} />)

    await user.click(screen.getByRole("button", { name: "Remove" }))

    await waitFor(() => expect(screen.getByText(/nothing saved yet/i)).toBeInTheDocument())
    expect(unsaveItem).toHaveBeenCalledWith(expect.anything(), "user-1", "rec-1")
  })

  it("puts the item back if the delete fails, instead of losing it silently", async () => {
    unsaveItem.mockRejectedValue(new Error("network error"))
    const user = userEvent.setup()
    render(<SavedList userId="user-1" initialItems={[ITEM]} />)

    await user.click(screen.getByRole("button", { name: "Remove" }))

    await waitFor(() => expect(screen.getByText("Free pizza")).toBeInTheDocument())
  })
})
