import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ReportPage from "./page"

const mocks = vi.hoisted(() => ({ configured: vi.fn(), createClient: vi.fn(), submit: vi.fn(), router: { push: vi.fn(), refresh: vi.fn() } }))
vi.mock("@/lib/supabase/client", () => ({ isSupabaseConfigured: mocks.configured, createClient: mocks.createClient }))
vi.mock("@/lib/reported-events", async (original) => ({ ...await original<typeof import("@/lib/reported-events")>(), submitReportedEvent: mocks.submit }))
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }))
vi.mock("@/components/nav", () => ({ Nav: () => null }))

let getUser: ReturnType<typeof vi.fn>
let notify: (event: string, session: { user: { id: string } } | null) => void
const unsubscribe = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  mocks.configured.mockReturnValue(true)
  mocks.submit.mockResolvedValue({ id: "report", moderationStatus: "pending" })
  getUser = vi.fn().mockResolvedValue({ data: { user: { id: "author-a" } }, error: null })
  notify = () => {}
  mocks.createClient.mockReturnValue({ auth: { getUser, onAuthStateChange: (callback: typeof notify) => {
    notify = callback
    return { data: { subscription: { unsubscribe } } }
  } } })
})

async function fillReport() {
  await screen.findByLabelText("What's free?")
  fireEvent.change(screen.getByLabelText("What's free?"), { target: { value: "Free pizza" } })
  fireEvent.change(screen.getByLabelText("When (your local time)"), { target: { value: new Date(Date.now() + 86400000).toISOString().slice(0, 16) } })
}

describe("report submission account and error handling", () => {
  it("requires sign-in when account configuration is absent", () => {
    mocks.configured.mockReturnValue(false)
    render(<ReportPage />)
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login")
    expect(screen.queryByLabelText("What's free?")).not.toBeInTheDocument()
  })
  it("supports keyboard submission and refreshes the feed after success", async () => {
    render(<ReportPage />)
    await fillReport()
    await userEvent.setup().type(screen.getByLabelText("Details (optional)"), "While supplies last{Enter}")
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledWith(expect.anything(), "author-a", expect.objectContaining({ title: "Free pizza", description: "While supplies last" })))
    expect(mocks.router.push).toHaveBeenCalledWith("/feed")
    expect(mocks.router.refresh).toHaveBeenCalledOnce()
    expect(getUser).toHaveBeenCalledTimes(2)
  })
  it("shows future-date validation before sending a report", async () => {
    render(<ReportPage />)
    await fillReport()
    fireEvent.change(screen.getByLabelText("When (your local time)"), { target: { value: "2000-01-01T12:00" } })
    await userEvent.setup().click(screen.getByRole("button", { name: "Submit for review" }))
    expect(screen.getByRole("alert")).toHaveTextContent("future event within the next seven days")
    expect(mocks.submit).not.toHaveBeenCalled()
    expect(getUser).toHaveBeenCalledOnce()
  })
  it("keeps the draft and explains an unconfirmed submission without raw database details", async () => {
    mocks.submit.mockRejectedValue(new Error("private database detail"))
    render(<ReportPage />)
    await fillReport()
    await userEvent.setup().click(screen.getByRole("button", { name: "Submit for review" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't confirm submission")
    expect(screen.getByRole("alert")).not.toHaveTextContent("private database detail")
    expect(screen.getByLabelText("What's free?")).toHaveValue("Free pizza")
    expect(mocks.router.push).not.toHaveBeenCalled()
  })
  it("refuses to submit for an account different from the loaded form", async () => {
    render(<ReportPage />)
    await fillReport()
    getUser.mockResolvedValue({ data: { user: { id: "author-b" } }, error: null })
    await userEvent.setup().click(screen.getByRole("button", { name: "Submit for review" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Your account changed")
    expect(mocks.submit).not.toHaveBeenCalled()
  })
  it("does not submit while the Auth service cannot verify the account", async () => {
    render(<ReportPage />)
    await fillReport()
    getUser.mockResolvedValue({ data: { user: null }, error: new Error("offline") })
    await userEvent.setup().click(screen.getByRole("button", { name: "Submit for review" }))
    expect(mocks.submit).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't confirm submission")
  })
  it("clears a previous account's draft when another account signs in", async () => {
    render(<ReportPage />)
    await fillReport()
    await act(async () => notify("SIGNED_IN", { user: { id: "author-b" } }))
    expect(screen.getByLabelText("What's free?")).toHaveValue("")
    expect(screen.getByLabelText("When (your local time)")).toHaveValue("")
  })
  it("ignores a delayed initial account lookup after sign-out", async () => {
    let finish: (value: unknown) => void = () => {}
    getUser.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    render(<ReportPage />)
    expect(screen.getByRole("status")).toHaveTextContent("Checking your account")
    await act(async () => notify("SIGNED_OUT", null))
    await act(async () => finish({ data: { user: { id: "author-a" } }, error: null }))
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument()
    expect(screen.queryByLabelText("What's free?")).not.toBeInTheDocument()
  })
  it("does not redirect a newly signed-in account when an older submission finishes", async () => {
    let finish: (value: unknown) => void = () => {}
    mocks.submit.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    render(<ReportPage />)
    await fillReport()
    await userEvent.setup().click(screen.getByRole("button", { name: "Submit for review" }))
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledOnce())
    await act(async () => notify("SIGNED_IN", { user: { id: "author-b" } }))
    await act(async () => finish({ id: "report" }))
    expect(mocks.router.push).not.toHaveBeenCalled()
    expect(screen.getByLabelText("What's free?")).toHaveValue("")
  })
  it("discloses lookup failures and unsubscribes when leaving the page", async () => {
    getUser.mockRejectedValue(new Error("Auth failure"))
    const view = render(<ReportPage />)
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Couldn't check your account"))
    view.unmount()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
