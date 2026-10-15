import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import StartPage from "./page"

const mocks = vi.hoisted(() => ({
  configured: vi.fn(), createClient: vi.fn(), loadLocal: vi.fn(), saveLocal: vi.fn(),
  loadCloud: vi.fn(), saveCloud: vi.fn(), router: { push: vi.fn(), refresh: vi.fn() },
}))
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }))
vi.mock("@/components/nav", () => ({ Nav: () => null }))
vi.mock("@/lib/supabase/client", () => ({ isSupabaseConfigured: mocks.configured, createClient: mocks.createClient }))
vi.mock("@/lib/preferences", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/preferences")>(),
  loadLocalPreferences: mocks.loadLocal, saveLocalPreferences: mocks.saveLocal,
  loadPreferencesFromSupabase: mocks.loadCloud, savePreferencesToSupabase: mocks.saveCloud,
}))

const browserPrefs = { budget: 45, optimizeFor: "fast", transportation: "walking", maxTravelMinutes: 8 }
const accountPrefs = { ...browserPrefs, budget: 80 }
let notify: (event: string, session: { user: { id: string } } | null) => void
let getUser: ReturnType<typeof vi.fn>
const unsubscribe = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  mocks.configured.mockReturnValue(true)
  mocks.loadLocal.mockReturnValue(browserPrefs)
  mocks.loadCloud.mockResolvedValue(accountPrefs)
  mocks.saveCloud.mockResolvedValue(undefined)
  getUser = vi.fn().mockResolvedValue({ data: { user: { id: "account-a" } }, error: null })
  notify = () => {}
  mocks.createClient.mockReturnValue({ auth: {
    getUser,
    onAuthStateChange: (callback: typeof notify) => {
      notify = callback
      return { data: { subscription: { unsubscribe } } }
    },
  } })
})

async function restored() {
  await waitFor(() => expect(screen.getByRole("button", { name: "Build My Week" })).toBeEnabled())
}

describe("pilot onboarding account persistence", () => {
  it("restores guest settings and submits without account configuration", async () => {
    mocks.configured.mockReturnValue(false)
    render(<StartPage />)
    await restored()
    expect(screen.getByLabelText("How much do you want to spend this week?")).toHaveValue(45)
    await userEvent.setup().click(screen.getByRole("button", { name: "Build My Week" }))
    expect(mocks.saveLocal).toHaveBeenCalledWith(browserPrefs)
    expect(mocks.saveCloud).not.toHaveBeenCalled()
    expect(mocks.router.push).toHaveBeenCalledWith("/dashboard?budget=45&optimizeFor=fast&transportation=walking&maxTravelMinutes=8")
  })
  it("preserves input and stays on the form when account sync fails, then permits retry", async () => {
    mocks.saveCloud.mockRejectedValueOnce(new Error("network failure"))
    render(<StartPage />)
    await restored()
    const user = userEvent.setup()
    await user.clear(screen.getByLabelText("How much do you want to spend this week?"))
    await user.type(screen.getByLabelText("How much do you want to spend this week?"), "35")
    await user.click(screen.getByRole("button", { name: "Build My Week" }))
    expect(screen.getByRole("alert")).toHaveTextContent("couldn't sync")
    expect(screen.getByLabelText("How much do you want to spend this week?")).toHaveValue(35)
    expect(mocks.saveLocal).toHaveBeenCalledWith({ ...accountPrefs, budget: 35 })
    expect(mocks.router.push).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Build My Week" }))
    await waitFor(() => expect(mocks.router.push).toHaveBeenCalled())
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
  it("discloses account preference read failures", async () => {
    mocks.loadCloud.mockRejectedValue(new Error("offline"))
    render(<StartPage />)
    await restored()
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load account preferences")
    expect(screen.getByLabelText("How much do you want to spend this week?")).toHaveValue(45)
  })
  it("does not silently treat an Auth service failure as a successful guest save", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: new Error("Auth unavailable") })
    render(<StartPage />)
    await restored()
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't check your account")
    await userEvent.setup().click(screen.getByRole("button", { name: "Build My Week" }))
    expect(mocks.saveCloud).not.toHaveBeenCalled()
    expect(mocks.router.push).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent("couldn't sync")
  })
  it("verifies the current account again before writing", async () => {
    render(<StartPage />)
    await restored()
    getUser.mockResolvedValue({ data: { user: { id: "account-b" } }, error: null })
    await userEvent.setup().click(screen.getByRole("button", { name: "Build My Week" }))
    expect(mocks.saveCloud).not.toHaveBeenCalled()
    expect(mocks.router.push).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent("Your account changed")
  })
  it("ignores a delayed account load after sign-out", async () => {
    let finish: (value: typeof accountPrefs) => void = () => {}
    mocks.loadCloud.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    render(<StartPage />)
    await waitFor(() => expect(mocks.loadCloud).toHaveBeenCalled())
    expect(screen.getByRole("button", { name: "Restoring preferences…" })).toBeDisabled()
    await act(async () => { notify("SIGNED_OUT", null) })
    await act(async () => { finish(accountPrefs) })
    await restored()
    expect(screen.getByLabelText("How much do you want to spend this week?")).toHaveValue(45)
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    await userEvent.setup().click(screen.getByRole("button", { name: "Build My Week" }))
    expect(mocks.saveCloud).not.toHaveBeenCalled()
    expect(mocks.router.push).toHaveBeenCalled()
  })
  it("loads a newly signed-in account without retaining the previous account's form", async () => {
    render(<StartPage />)
    await restored()
    mocks.loadCloud.mockResolvedValue({ ...accountPrefs, budget: 25 })
    await act(async () => { notify("SIGNED_IN", { user: { id: "account-b" } }) })
    await restored()
    expect(screen.getByLabelText("How much do you want to spend this week?")).toHaveValue(25)
    expect(mocks.loadCloud).toHaveBeenLastCalledWith(mocks.createClient(), "account-b")
  })
  it("unsubscribes and discards account loads when the form unmounts", async () => {
    render(<StartPage />).unmount()
    await act(async () => {})
    expect(unsubscribe).toHaveBeenCalledOnce()
    expect(mocks.loadCloud).not.toHaveBeenCalled()
  })
})
