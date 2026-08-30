import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Recommendation } from "@yums/shared"
import { NotificationToggle } from "./notification-toggle"

class MockNotification {
  static permission: NotificationPermission = "granted"
  static requestPermission = vi.fn(async () => MockNotification.permission)
  static instances: MockNotification[] = []
  title: string
  body?: string
  constructor(title: string, options?: { body?: string }) {
    this.title = title
    this.body = options?.body
    MockNotification.instances.push(this)
  }
}

beforeEach(() => {
  localStorage.clear()
  MockNotification.permission = "granted"
  MockNotification.instances = []
  vi.stubGlobal("Notification", MockNotification)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("NotificationToggle — permission/toggle UI (real timers)", () => {
  it("renders nothing when the Notification API isn't supported", () => {
    vi.stubGlobal("Notification", undefined)
    const { container } = render(<NotificationToggle freeFoodEvents={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("starts off and enables on click when permission is granted", async () => {
    const user = userEvent.setup()
    render(<NotificationToggle freeFoodEvents={[]} />)

    expect(screen.getByRole("button", { name: /remind me/i })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /remind me/i }))

    await waitFor(() => expect(screen.getByRole("button", { name: /reminders on/i })).toBeInTheDocument())
    expect(localStorage.getItem("yums.notifications-enabled")).toBe("true")
  })

  it("shows a blocked message when permission is denied, and stays off", async () => {
    MockNotification.permission = "denied"
    const user = userEvent.setup()
    render(<NotificationToggle freeFoodEvents={[]} />)

    await user.click(screen.getByRole("button", { name: /remind me/i }))

    await waitFor(() => expect(screen.getByText(/blocked/i)).toBeInTheDocument())
    expect(screen.getByRole("button", { name: /remind me/i })).toBeInTheDocument()
  })

  it("turns back off on a second click", async () => {
    const user = userEvent.setup()
    render(<NotificationToggle freeFoodEvents={[]} />)

    await user.click(screen.getByRole("button", { name: /remind me/i }))
    await waitFor(() => expect(screen.getByRole("button", { name: /reminders on/i })).toBeInTheDocument())

    await user.click(screen.getByRole("button", { name: /reminders on/i }))
    await waitFor(() => expect(screen.getByRole("button", { name: /remind me/i })).toBeInTheDocument())
    expect(localStorage.getItem("yums.notifications-enabled")).toBe("false")
  })
})

describe("NotificationToggle — reminder scheduling (fake timers)", () => {
  const NOW = new Date("2026-08-29T12:00:00Z")
  const EVENT_SOON: Recommendation = {
    id: "1",
    kind: "free_food",
    title: "Free pizza",
    subtitle: "ACM · Soda Hall",
    estimatedSavings: 8,
    startTime: "2026-08-29T12:25:00Z", // 25 min out — outside the 20-min lead window until 5 min pass
    score: 1,
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("fires ~20 min before an event's startTime once already enabled, not immediately", async () => {
    localStorage.setItem("yums.notifications-enabled", "true")
    await act(async () => {
      render(<NotificationToggle freeFoodEvents={[EVENT_SOON]} />)
    })

    expect(screen.getByRole("button", { name: /reminders on/i })).toBeInTheDocument()
    expect(MockNotification.instances).toHaveLength(0) // event is 25 min out, lead time is 20

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 1) // now inside the 20-min window
    })

    expect(MockNotification.instances).toHaveLength(1)
    expect(MockNotification.instances[0].title).toBe("Starting soon: Free pizza")
  })

  it("does not schedule anything for an event whose lead time already passed", async () => {
    localStorage.setItem("yums.notifications-enabled", "true")
    const pastEvent: Recommendation = { ...EVENT_SOON, startTime: "2026-08-29T12:01:00Z" } // 1 min out
    await act(async () => {
      render(<NotificationToggle freeFoodEvents={[pastEvent]} />)
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
    })

    expect(MockNotification.instances).toHaveLength(0)
  })
})
