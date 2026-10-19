import { describe, expect, it, vi } from "vitest"

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect }))
import StartPage from "./start/page"
import DashboardPage from "./dashboard/page"

describe("retired planning routes", () => {
  it.each([StartPage, DashboardPage])("sends old bookmarks to the food feed", (page) => {
    redirect.mockClear()
    page()
    expect(redirect).toHaveBeenCalledWith("/")
  })
})
