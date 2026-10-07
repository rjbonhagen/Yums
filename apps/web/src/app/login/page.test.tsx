import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
const { getUser, signInWithOtp, signInWithOAuth, linkIdentity, search } = vi.hoisted(() => ({
  getUser: vi.fn(), signInWithOtp: vi.fn(), signInWithOAuth: vi.fn(), linkIdentity: vi.fn(), search: vi.fn(),
}))
vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: () => true,
  createClient: () => ({ auth: { getUser, signInWithOtp, signInWithOAuth, linkIdentity } }),
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
    getUser.mockResolvedValue({ data: { user: { email: "person@berkeley.edu", identities: [{ provider: "google" }] } }, error: null })
    const user = userEvent.setup()
    render(<LoginPage />)
    await waitFor(() => expect(screen.getByRole("button", { name: "Connect Google Calendar" })).toBeInTheDocument())
    await user.click(screen.getByRole("button", { name: "Connect Google Calendar" }))
    expect(signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ scopes: "https://www.googleapis.com/auth/calendar.freebusy", redirectTo: expect.stringContaining("?calendar=connect") }) }))
    expect(linkIdentity).not.toHaveBeenCalled()
  })
  it("reports disconnect failures instead of claiming the connection was removed", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "person@berkeley.edu" } }, error: null })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }))
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.click(await screen.findByRole("button", { name: "Disconnect Google Calendar" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't disconnect")
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })
})
