// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest"
import { authRedirectOrigin } from "./auth-origin"

beforeEach(() => vi.stubEnv("APP_ORIGIN", ""))
it("preserves local origins and accepts matching loopback hosts for a bound server", () => {
  expect(authRedirectOrigin(new Request("http://localhost:3000/auth/callback"))).toBe("http://localhost:3000")
  for (const host of ["localhost:3000", "127.0.0.1:3000", "[::1]:3000"]) {
    expect(authRedirectOrigin(new Request("http://0.0.0.0:3000/auth/callback", { headers: { host } }))).toBe(`http://${host}`)
  }
})
it("never redirects to arbitrary forwarded hosts or malformed local hosts", () => {
  for (const host of ["attacker.example.test:3000", "localhost:4000", "localhost:3000@attacker.example.test", "localhost:3000/path"]) {
    expect(() => authRedirectOrigin(new Request("http://0.0.0.0:3000/auth/callback", { headers: { host, "x-forwarded-host": "attacker.example.test" } }))).toThrow()
  }
})
it("rejects unsafe configured origins", () => {
  for (const origin of ["http://pilot.example.test", "https://user:password@pilot.example.test", "https://pilot.example.test/path", "https://pilot.example.test?next=other", "https://pilot.example.test#fragment", "https://0.0.0.0:3000", "invalid"]) {
    vi.stubEnv("APP_ORIGIN", origin)
    expect(() => authRedirectOrigin(new Request("http://localhost:3000/auth/callback"))).toThrow()
  }
})
