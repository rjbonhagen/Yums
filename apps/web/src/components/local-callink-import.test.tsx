import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { LocalCalLinkImport } from "./local-callink-import"

const source = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:https://callink.berkeley.edu/event/123\r\nSUMMARY:Club evening\r\nDTSTART:20261030T023000Z\r\nDTEND:20261030T043000Z\r\nDESCRIPTION:Games and treats\r\nCATEGORIES:Free\r\nEND:VEVENT\r\nEND:VCALENDAR"
beforeEach(() => { sessionStorage.clear(); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-17T19:00:00Z")) })
afterEach(() => vi.useRealTimers())

describe("local calendar review", () => {
  it("requires food confirmation and keeps reviewed events only in this tab", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch")
    const user = userEvent.setup()
    const view = render(<LocalCalLinkImport />)
    fireEvent.change(screen.getByLabelText("Calendar file"), { target: { files: [{ size: source.length, text: async () => source }] } })
    await screen.findByRole("heading", { name: "2. Review 1 event" })
    expect(sessionStorage.length).toBe(0)
    await user.click(screen.getByRole("button", { name: "Keep selected in this tab (0)" }))
    expect(screen.getByRole("alert")).toHaveTextContent("confirm free food")
    await user.click(screen.getByRole("checkbox", { name: /I checked the source/ }))
    await user.click(screen.getByRole("button", { name: "Keep selected in this tab (1)" }))
    expect(screen.getByRole("heading", { name: "Your private imports (1)" })).toBeInTheDocument()
    expect(fetcher).not.toHaveBeenCalled()
    view.unmount()
    render(<LocalCalLinkImport />)
    expect(screen.getByRole("heading", { name: "Your private imports (1)" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Clear private imports" }))
    expect(screen.getByRole("heading", { name: "Your private imports (0)" })).toBeInTheDocument()
    expect(fetcher).not.toHaveBeenCalled()
    fetcher.mockRestore()
  })
  it("ignores a previous file's late completion after choosing a newer file", async () => {
    let finish!: (value: string) => void
    const pending = new Promise<string>((resolve) => { finish = resolve })
    render(<LocalCalLinkImport />)
    const picker = screen.getByLabelText("Calendar file")
    fireEvent.change(picker, { target: { files: [{ size: 100, text: () => pending }] } })
    fireEvent.change(picker, { target: { files: [{ size: source.length, text: async () => source.replace("Club evening", "Newer event") }] } })
    await screen.findByRole("heading", { name: "Newer event" })
    await act(async () => finish(source))
    expect(screen.queryByRole("heading", { name: "Club evening" })).not.toBeInTheDocument()
  })
  it("reports read failures without replacing private imports", async () => {
    render(<LocalCalLinkImport />)
    fireEvent.change(screen.getByLabelText("Calendar file"), { target: { files: [{ size: 100, text: async () => "<html>Sign in</html>" }] } })
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("could not be read"))
    const privateSection = screen.getByRole("region", { name: "Your private imports (0)" })
    expect(within(privateSection).queryByRole("article")).not.toBeInTheDocument()
    expect(sessionStorage.length).toBe(0)
  })
  it("makes the end date explicit for an event spanning more than one campus date", async () => {
    render(<LocalCalLinkImport />)
    const overnight = source.replace("DTEND:20261030T043000Z", "DTEND:20261031T043000Z")
    fireEvent.change(screen.getByLabelText("Calendar file"), { target: { files: [{ size: overnight.length, text: async () => overnight }] } })
    expect(await screen.findByText(/Fri, Oct 30, 9:30 PM/)).toBeInTheDocument()
  })
})
