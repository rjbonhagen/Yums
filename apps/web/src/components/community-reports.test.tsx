import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CommunityReports } from "./community-reports"
import type { ReportedEvent } from "@/lib/reported-events"

const { deleteReportedEvent, createClient } = vi.hoisted(() => ({
  deleteReportedEvent: vi.fn(),
  createClient: vi.fn(() => ({})),
}))

vi.mock("@/lib/reported-events", async () => {
  const actual = await vi.importActual<typeof import("@/lib/reported-events")>("@/lib/reported-events")
  return { ...actual, deleteReportedEvent }
})
vi.mock("@/lib/supabase/client", () => ({ createClient }))

const REPORT: ReportedEvent = {
  id: "report-1",
  userId: "author-1",
  title: "Free samosas outside Sproul",
  locationName: "Sproul Plaza",
  startTime: "2026-08-29T18:00:00Z",
  createdAt: "2026-08-29T10:00:00Z",
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("CommunityReports", () => {
  it("labels the section as unverified/user-submitted", () => {
    render(<CommunityReports userId={null} reports={[REPORT]} />)
    expect(screen.getByText(/unverified/i)).toBeInTheDocument()
  })

  it("shows a message when there are no reports", () => {
    render(<CommunityReports userId={null} reports={[]} />)
    expect(screen.getByText(/no community reports right now/i)).toBeInTheDocument()
  })

  it("does not show a Remove button for a report someone else submitted", () => {
    render(<CommunityReports userId="viewer-1" reports={[REPORT]} />)
    expect(screen.getByText("Free samosas outside Sproul")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument()
  })

  it("shows a Remove button for the viewer's own report and removes it on click", async () => {
    deleteReportedEvent.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<CommunityReports userId="author-1" reports={[REPORT]} />)

    await user.click(screen.getByRole("button", { name: "Remove" }))

    await waitFor(() => expect(screen.getByText(/no community reports right now/i)).toBeInTheDocument())
    expect(deleteReportedEvent).toHaveBeenCalledWith(expect.anything(), "author-1", "report-1")
  })

  it("puts the report back if the delete fails", async () => {
    deleteReportedEvent.mockRejectedValue(new Error("network error"))
    const user = userEvent.setup()
    render(<CommunityReports userId="author-1" reports={[REPORT]} />)

    await user.click(screen.getByRole("button", { name: "Remove" }))

    await waitFor(() => expect(screen.getByText("Free samosas outside Sproul")).toBeInTheDocument())
  })
})
