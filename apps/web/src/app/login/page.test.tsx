import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
const { getUser, signInWithOtp, signInWithOAuth, linkIdentity, unlinkIdentity, search, maybeSingle } = vi.hoisted(() => ({
  getUser: vi.fn(), signInWithOtp: vi.fn(), signInWithOAuth: vi.fn(), linkIdentity: vi.fn(), unlinkIdentity: vi.fn(), search: vi.fn(), maybeSingle: vi.fn(),
}))
vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: () => true,
  createClient: () => ({ auth: { getUser, signInWithOtp, signInWithOAuth, linkIdentity, unlinkIdentity }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) }),
}))
vi.mock("@/components/nav", () => ({ Nav: () => null }))
vi.mock("next/navigation", () => ({ useSearchParams: search }))
import LoginPage from "./page"
beforeEach(() => {
  vi.resetAllMocks()
  getUser.mockResolvedValue({ data: { user: null }, error: null })
  search.mockReturnValue(new URLSearchParams())
  signInWithOtp.mockResolvedValue({ error: null })
  signInWithOAuth.mockResolvedValue({ error: null })
  linkIdentity.mockResolvedValue({ error: null })
  unlinkIdentity.mockResolvedValue({ error: null })
  maybeSingle.mockResolvedValue({ data: null, error: null })
})

describe("existing Google login repair", () => {
  const otherIdentity = { identity_id: "other-google", provider: "google", identity_data: { email: "other@gmail.com" } }
  const account = { id: "account", email: "person@berkeley.edu", identities: [
    { identity_id: "email-login", provider: "email", identity_data: { email: "person@berkeley.edu" } },
    { identity_id: "own-google", provider: "google", identity_data: { email: "person@berkeley.edu" } },
    otherIdentity,
  ] }
  it("removes only the selected different-email Google identity", async () => {
    getUser.mockResolvedValue({ data: { user: account }, error: null })
    render(<LoginPage />)
    await userEvent.setup().click(await screen.findByRole("button", { name: "Remove linked login other@gmail.com" }))
    expect(unlinkIdentity).toHaveBeenCalledExactlyOnceWith(otherIdentity)
    expect(screen.getByRole("status")).toHaveTextContent("no longer a login")
    expect(screen.queryByRole("button", { name: "Remove linked login other@gmail.com" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Remove linked login person/ })).not.toBeInTheDocument()
  })
  it("refuses to change identities after the signed-in account changes", async () => {
    getUser.mockResolvedValue({ data: { user: account }, error: null })
    render(<LoginPage />)
    const removeButton = await screen.findByRole("button", { name: "Remove linked login other@gmail.com" })
    await screen.findByText(/Calendar isn't connected/)
    getUser.mockResolvedValue({ data: { user: { ...account, email: "another@berkeley.edu" } }, error: null })
    await userEvent.setup().click(removeButton)
    expect(unlinkIdentity).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent("Your account changed")
  })
  it("keeps a failed unlink available for retry", async () => {
    getUser.mockResolvedValue({ data: { user: account }, error: null })
    unlinkIdentity.mockResolvedValue({ error: new Error("Unable to remove login") })
    render(<LoginPage />)
    await userEvent.setup().click(await screen.findByRole("button", { name: "Remove linked login other@gmail.com" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to remove login")
    expect(screen.getByRole("button", { name: "Remove linked login other@gmail.com" })).toBeEnabled()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })
  it("explains the operator repair step when Supabase blocks removal", async () => {
    getUser.mockResolvedValue({ data: { user: account }, error: null })
    unlinkIdentity.mockResolvedValue({ error: { code: "manual_linking_disabled", message: "Manual linking is disabled" } })
    render(<LoginPage />)
    await userEvent.setup().click(await screen.findByRole("button", { name: "Remove linked login other@gmail.com" }))
    expect(screen.getByRole("alert")).toHaveTextContent("temporarily enable login removal")
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
describe("invited pilot sign-in", () => {
  it("submits a magic link by keyboard without creating uninvited accounts", async () => {
    vi.stubEnv("NEXT_PUBLIC_INVITE_ONLY", "true")
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.type(screen.getByLabelText("Email"), "person@berkeley.edu")
    await user.keyboard("{Enter}")
    expect(signInWithOtp).toHaveBeenCalledWith(expect.objectContaining({ email: "person@berkeley.edu", options: expect.objectContaining({ shouldCreateUser: false }) }))
    expect(await screen.findByText(/for a sign-in link/)).toBeInTheDocument()
  })
  it("shows an actionable callback failure", () => {
    search.mockReturnValue(new URLSearchParams("error=auth-failed"))
    render(<LoginPage />)
    expect(screen.getByRole("alert")).toHaveTextContent("Request a fresh link")
  })
  it("reconnects an already-linked Google identity with explicit Calendar scopes", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "person@berkeley.edu", identities: [{ provider: "google", identity_data: { email: "person@berkeley.edu" } }] } }, error: null })
    const user = userEvent.setup()
    render(<LoginPage />)
    await waitFor(() => expect(screen.getByRole("button", { name: "Retry Calendar connection" })).toBeInTheDocument())
    await user.click(screen.getByRole("button", { name: "Retry Calendar connection" }))
    expect(signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ scopes: "https://www.googleapis.com/auth/calendar.freebusy", redirectTo: expect.stringContaining("?calendar=connect") }) }))
    expect(linkIdentity).not.toHaveBeenCalled()
  })
  it("reports disconnect failures instead of claiming the connection was removed", async () => {
    maybeSingle.mockResolvedValue({ data: { user_id: "account" }, error: null })
    getUser.mockResolvedValue({ data: { user: { email: "person@berkeley.edu" } }, error: null })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }))
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.click(await screen.findByRole("button", { name: "Disconnect Google Calendar" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't disconnect")
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })
  it.each([{ identities: [] }, { identities: [{ provider: "google", identity_data: { email: "other@gmail.com" } }] }])("never links another Google login when connecting Calendar", async ({ identities }) => {
    getUser.mockResolvedValue({ data: { user: { email: "person@berkeley.edu", identities } }, error: null })
    render(<LoginPage />)
    await userEvent.setup().click(await screen.findByRole("button", { name: "Retry Calendar connection" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Different accounts cannot be linked")
    expect(signInWithOAuth).not.toHaveBeenCalled()
    expect(linkIdentity).not.toHaveBeenCalled()
  })
  it("requests Calendar consent and an account chooser during Google sign-in", async () => {
    render(<LoginPage />)
    await userEvent.setup().click(screen.getByRole("button", { name: "Continue with Google" }))
    expect(signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ scopes: "https://www.googleapis.com/auth/calendar.freebusy", queryParams: { access_type: "offline", prompt: "consent select_account" } }) }))
    expect(linkIdentity).not.toHaveBeenCalled()
  })
  it("shows the saved Calendar connection without offering another connection", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "account", email: "person@berkeley.edu" } }, error: null })
    maybeSingle.mockResolvedValue({ data: { user_id: "account" }, error: null })
    render(<LoginPage />)
    expect(await screen.findByText("Google Calendar connected.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Retry Calendar connection" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Disconnect Google Calendar" })).toBeInTheDocument()
  })
  it("does not claim a connection status when the account query fails", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "account", email: "person@berkeley.edu" } }, error: null })
    maybeSingle.mockResolvedValue({ data: null, error: new Error("offline") })
    render(<LoginPage />)
    expect(await screen.findByText(/Couldn't check your Calendar connection/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Disconnect Google Calendar" })).not.toBeInTheDocument()
  })
})
