import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"
import { RecommendationsView } from "./recommendations-view"
import { AuthSessionMissingError } from "@supabase/supabase-js"

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), load: vi.fn(), save: vi.fn(), remove: vi.fn(), unsubscribe: vi.fn() }))
let notify: (event: string, session: { user: { id: string } } | null) => void
vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: () => true,
  createClient: () => ({ auth: { getUser: mocks.getUser, onAuthStateChange: (callback: typeof notify) => {
    notify = callback
    return { data: { subscription: { unsubscribe: mocks.unsubscribe } } }
  } } }),
}))
vi.mock("@/lib/saved-items", () => ({ loadSavedItems: mocks.load, saveRecommendation: mocks.save, unsaveItem: mocks.remove }))
vi.mock("@/lib/guest-saved-items", () => ({ useGuestSavedItems: () => [], saveGuestItem: vi.fn(), removeGuestItem: vi.fn() }))

const listing = { id: "live", kind: "free_food" as const, title: "Campus lunch", sourceUrl: "https://events.berkeley.edu/1", estimatedSavings: 8, score: 1 }
const saved = { ...listing, id: "saved-a" }
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: "a" } }, error: null })
  mocks.load.mockResolvedValue([])
  mocks.save.mockResolvedValue(saved)
  mocks.remove.mockResolvedValue(undefined)
  notify = () => {}
})
async function ready() {
  render(<RecommendationsView recommendations={[listing]} />)
  await waitFor(() => expect(mocks.load).toHaveBeenCalled())
  await act(async () => {})
}

it("allows browser saves for a signed-out session without an account error", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() })
  render(<RecommendationsView recommendations={[listing]} />)
  await act(async () => {})
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: "Save" }))
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  expect(mocks.save).not.toHaveBeenCalled()
})

it("saves with a fresh account check and restores the button on failure", async () => {
  mocks.save.mockRejectedValueOnce(new Error("offline"))
  await ready()
  await userEvent.click(screen.getByRole("button", { name: "Save" }))
  expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save this item")
  expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("aria-pressed", "false")
  await userEvent.click(screen.getByRole("button", { name: "Save" }))
  expect(mocks.save).toHaveBeenLastCalledWith(expect.anything(), "a", listing)
  expect(screen.getByRole("button", { name: "Saved" })).toHaveAttribute("aria-pressed", "true")
  expect(mocks.getUser).toHaveBeenCalledTimes(3)
})

it("does not write when the fresh account differs or cannot be verified", async () => {
  await ready()
  mocks.getUser.mockResolvedValueOnce({ data: { user: { id: "b" } }, error: null })
  await userEvent.click(screen.getByRole("button", { name: "Save" }))
  expect(screen.getByRole("alert")).toHaveTextContent("Your account changed")
  mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("unavailable") })
  await userEvent.click(screen.getByRole("button", { name: "Save" }))
  expect(screen.getByRole("alert")).toHaveTextContent("Couldn't check your account")
  expect(mocks.save).not.toHaveBeenCalled()
})

it("clears previous saves and ignores late save completion after account changes", async () => {
  const pending = deferred<typeof saved>()
  mocks.save.mockReturnValueOnce(pending.promise)
  await ready()
  await userEvent.click(screen.getByRole("button", { name: "Save" }))
  await act(async () => notify("SIGNED_IN", { user: { id: "b" } }))
  await act(async () => pending.resolve(saved))
  expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("aria-pressed", "false")
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
})

it("ignores a previous account's late load and prevents writes while restoring", async () => {
  const pending = deferred<typeof saved[]>()
  mocks.load.mockReturnValueOnce(pending.promise)
  await ready()
  await userEvent.click(screen.getByRole("button", { name: "Save" }))
  expect(mocks.save).not.toHaveBeenCalled()
  await act(async () => notify("SIGNED_IN", { user: { id: "b" } }))
  await act(async () => pending.resolve([saved]))
  expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("aria-pressed", "false")
})

it("sign-out clears saves and obsolete delete failures cannot restore them", async () => {
  mocks.load.mockResolvedValueOnce([saved])
  const pending = deferred<void>()
  mocks.remove.mockReturnValueOnce(pending.promise.then(() => { throw new Error("offline") }))
  await ready()
  await userEvent.click(screen.getByRole("button", { name: "Saved" }))
  await act(async () => notify("SIGNED_OUT", null))
  await act(async () => pending.resolve())
  expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("aria-pressed", "false")
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
})

it("ignores obsolete Auth responses and unsubscribes on unmount", async () => {
  const pending = deferred<{ data: { user: { id: string } }; error: null }>()
  mocks.getUser.mockReturnValueOnce(pending.promise)
  const view = render(<RecommendationsView recommendations={[listing]} />)
  await act(async () => notify("SIGNED_IN", { user: { id: "b" } }))
  await act(async () => pending.resolve({ data: { user: { id: "a" } }, error: null }))
  expect(mocks.load).toHaveBeenCalledTimes(1)
  expect(mocks.load).toHaveBeenCalledWith(expect.anything(), "b")
  view.unmount()
  expect(mocks.unsubscribe).toHaveBeenCalled()
})

