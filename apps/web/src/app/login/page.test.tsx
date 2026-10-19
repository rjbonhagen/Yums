import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
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
    await screen.findByText(/Signed in as/)
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
  it("signs in with Google without requesting Calendar or linking accounts", async () => {
    render(<LoginPage />)
    await userEvent.setup().click(screen.getByRole("button", { name: "Continue with Google" }))
    const options = signInWithOAuth.mock.calls[0][0].options
    expect(options.queryParams).toEqual({ prompt: "select_account" })
    expect(options.scopes).toBeUndefined()
    expect(linkIdentity).not.toHaveBeenCalled()
    expect(screen.queryByText(/Calendar/)).not.toBeInTheDocument()
  })
})