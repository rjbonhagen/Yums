import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AuthStatus } from "./auth-status"

const { isSupabaseConfigured, createClient, router } = vi.hoisted(() => ({
  isSupabaseConfigured: vi.fn(),
  createClient: vi.fn(),
  router: { push: vi.fn(), refresh: vi.fn() },
}))

vi.mock("@/lib/supabase/client", () => ({ isSupabaseConfigured, createClient }))
vi.mock("next/navigation", () => ({ useRouter: () => router }))

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
  it("recovers sign-in navigation when the account check fails", async () => {
    isSupabaseConfigured.mockReturnValue(true)
    mockSupabaseUser(null)
    createClient().auth.getUser = () => Promise.reject(new Error("offline"))
    render(<AuthStatus />)
    await waitFor(() => expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument())
  })
  it("keeps the signed-in state and shows an error when sign-out fails", async () => {
    isSupabaseConfigured.mockReturnValue(true)
    mockSupabaseUser("rj@berkeley.edu")
    createClient().auth.signOut = () => Promise.resolve({ error: new Error("offline") })
    render(<AuthStatus />)
    await waitFor(() => expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument())
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign out" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't sign out")
    expect(router.push).not.toHaveBeenCalled()
    expect(screen.getByRole("link", { name: "Account" })).toBeInTheDocument()
  })
  it("refreshes private server content after an external sign-out", async () => {
    isSupabaseConfigured.mockReturnValue(true)
    mockSupabaseUser("rj@berkeley.edu")
    let notify: (event: string, session: unknown) => void = () => {}
    createClient().auth.onAuthStateChange = (callback: typeof notify) => {
      notify = callback
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    }
    render(<AuthStatus />)
    await waitFor(() => expect(screen.getByRole("link", { name: "Account" })).toBeInTheDocument())
    const { act } = await import("@testing-library/react")
    await act(async () => notify("SIGNED_OUT", null))
    expect(router.refresh).toHaveBeenCalled()
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument()
  })
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
