import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { AuthStatus } from "./auth-status"

const { isSupabaseConfigured, createClient } = vi.hoisted(() => ({
  isSupabaseConfigured: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock("@/lib/supabase/client", () => ({ isSupabaseConfigured, createClient }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))

function mockSupabaseUser(email: string | null) {
  createClient.mockReturnValue({
    auth: {
      getUser: () => Promise.resolve({ data: { user: email ? { email } : null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut: () => Promise.resolve({ error: null }),
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("AuthStatus", () => {
  it("still links to /login when Supabase isn't configured, instead of hiding sign-in entirely", () => {
    isSupabaseConfigured.mockReturnValue(false)
    render(<AuthStatus />)

    const link = screen.getByRole("link", { name: "Sign in" })
    expect(link).toHaveAttribute("href", "/login")
  })

  it("shows a Sign in link when configured but signed out", async () => {
    isSupabaseConfigured.mockReturnValue(true)
    mockSupabaseUser(null)
    render(<AuthStatus />)

    await waitFor(() => expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument())
  })

  it("shows Account/Sign out when signed in", async () => {
    isSupabaseConfigured.mockReturnValue(true)
    mockSupabaseUser("rj@berkeley.edu")
    render(<AuthStatus />)

    await waitFor(() => expect(screen.getByRole("link", { name: "Account" })).toBeInTheDocument())
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument()
  })
})
