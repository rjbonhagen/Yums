import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SavedList } from "./saved-list"
import type { SavedItem } from "@/lib/saved-items"

const { unsaveItem, createClient, getUser, unsubscribe } = vi.hoisted(() => ({
  unsaveItem: vi.fn(),
  createClient: vi.fn(() => ({})),
  getUser: vi.fn(), unsubscribe: vi.fn(),
}))
let notify: (event: string, session: { user: { id: string } } | null) => void

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
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })
  createClient.mockReturnValue({ auth: { getUser, onAuthStateChange: (callback: typeof notify) => {
    notify = callback
    return { data: { subscription: { unsubscribe } } }
  } } })
  notify = () => {}
})

describe("SavedList", () => {
  it("replaces private items when the account or server snapshot changes", () => {
    const { rerender } = render(<SavedList userId="user-1" initialItems={[ITEM]} />)
    rerender(<SavedList userId="user-2" initialItems={[{ ...ITEM, id: "other", title: "Other account item" }]} />)
    expect(screen.queryByText("Free pizza")).not.toBeInTheDocument()
    expect(screen.getByText("Other account item")).toBeInTheDocument()
    rerender(<SavedList userId="user-2" initialItems={[]} />)
    expect(screen.queryByText("Other account item")).not.toBeInTheDocument()
  })
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

  it("hides private snapshots immediately when signing out", async () => {
    render(<SavedList userId="user-1" initialItems={[ITEM]} />)
    await act(async () => notify("SIGNED_OUT", null))
    expect(screen.queryByText("Free pizza")).not.toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent("Your account changed")
  })

  it("does not delete when the fresh account check differs", async () => {
    render(<SavedList userId="user-1" initialItems={[ITEM]} />)
    await act(async () => {})
    getUser.mockResolvedValueOnce({ data: { user: { id: "user-2" } }, error: null })
    await userEvent.click(screen.getByRole("button", { name: "Remove" }))
    expect(unsaveItem).not.toHaveBeenCalled()
    expect(screen.queryByText("Free pizza")).not.toBeInTheDocument()
  })

  it("preserves the item when Auth cannot verify removal", async () => {
    render(<SavedList userId="user-1" initialItems={[ITEM]} />)
    await act(async () => {})
    getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("offline") })
    await userEvent.click(screen.getByRole("button", { name: "Remove" }))
    expect(unsaveItem).not.toHaveBeenCalled()
    expect(screen.getByText("Free pizza")).toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't remove")
  })

  it("cannot restore private snapshots after a delayed delete fails following sign-out", async () => {
    let reject!: (error: Error) => void
    unsaveItem.mockReturnValueOnce(new Promise((_, fail) => { reject = fail }))
    const view = render(<SavedList userId="user-1" initialItems={[ITEM]} />)
    await userEvent.click(screen.getByRole("button", { name: "Remove" }))
    await act(async () => notify("SIGNED_OUT", null))
    await act(async () => reject(new Error("offline")))
    expect(screen.queryByText("Free pizza")).not.toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent("Your account changed")
    view.unmount()
    expect(unsubscribe).toHaveBeenCalled()
  })
})
