import { describe, expect, it } from "vitest"
import { localImportsEnabled } from "./local-imports"

describe("local import availability", () => {
  it("requires an explicit switch and a configured loopback origin", () => {
    expect(localImportsEnabled({})).toBe(false)
    expect(localImportsEnabled({ APP_ORIGIN: "http://localhost:3000" })).toBe(false)
    expect(localImportsEnabled({ YUMS_ENABLE_LOCAL_IMPORTS: "true" })).toBe(false)
    for (const APP_ORIGIN of ["http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000"]) {
      expect(localImportsEnabled({ APP_ORIGIN, YUMS_ENABLE_LOCAL_IMPORTS: "true" })).toBe(true)
    }
  })
  it("stays disabled for hosted origins, lookalike hosts, credentials, and paths", () => {
    for (const APP_ORIGIN of ["https://getyums.food", "http://0.0.0.0:3000", "http://localhost.evil.test", "http://user:pass@localhost:3000", "http://localhost:3000/private", "http://localhost:3000?x=1", "invalid"]) {
      expect(localImportsEnabled({ APP_ORIGIN, YUMS_ENABLE_LOCAL_IMPORTS: "true" })).toBe(false)
    }
  })
})
