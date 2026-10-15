import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { AuthSessionMissingError } from "@supabase/supabase-js"
const { createClient, getUser, loadSavedItems } = vi.hoisted(() => ({ createClient: vi.fn(), getUser: vi.fn(), loadSavedItems: vi.fn() }))
vi.mock("@/lib/supabase/client", () => ({ isSupabaseConfigured: () => true }))
vi.mock("@/lib/supabase/server", () => ({ createClient }))
vi.mock("@/lib/saved-items", () => ({ loadSavedItems }))
vi.mock("@/components/nav", () => ({ Nav: () => null }))
vi.mock("@/components/guest-saved-list", () => ({ GuestSavedList: () => <p>Browser saves</p> }))
vi.mock("@/components/saved-list", () => ({ SavedList: () => <p>Account saves</p> }))
import SavedPage from "./page"
beforeEach(() => {
  vi.resetAllMocks()
  createClient.mockResolvedValue({ auth: { getUser } })
})
describe("Saved page account failures", () => {
  it("shows browser saves and a sign-in prompt for a missing session", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() })
    render(await SavedPage())
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login")
    expect(screen.getByText("Browser saves")).toBeInTheDocument()
    expect(loadSavedItems).not.toHaveBeenCalled()
  })
  it("keeps browser saves usable when authentication is offline", async () => {
    getUser.mockRejectedValue(new Error("offline"))
    render(await SavedPage())
    expect(screen.getByRole("status")).toHaveTextContent("Account saves are unavailable")
    expect(screen.getByText("Browser saves")).toBeInTheDocument()
    expect(loadSavedItems).not.toHaveBeenCalled()
  })
  it("queries only the verified account and distinguishes a failed query from an empty list", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "verified-user" } }, error: null })
    loadSavedItems.mockRejectedValue(new Error("database offline"))
    render(await SavedPage())
    expect(loadSavedItems).toHaveBeenCalledWith(expect.anything(), "verified-user")
    expect(screen.getByRole("status")).toHaveTextContent("Couldn't load your account saves")
    expect(screen.queryByText("Account saves")).not.toBeInTheDocument()
  })
})
