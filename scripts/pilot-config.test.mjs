import assert from "node:assert/strict"
import test from "node:test"
import { checkPilotConfig } from "./pilot-config.mjs"

const configured = {
  YUMS_DEMO_MODE: "false", NEXT_PUBLIC_INVITE_ONLY: "true",
  NEXT_PUBLIC_SUPABASE_URL: "https://pilot.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_test",
}
const jwt = (role) => `header.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`

test("accepts publishable and legacy anon configuration", () => {
  assert.equal(checkPilotConfig(configured).errors.length, 0)
  assert.equal(checkPilotConfig({ ...configured, NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt("anon") }).errors.length, 0)
})
test("rejects missing settings and permissive pilot flags", () => {
  assert.equal(checkPilotConfig({}).errors.length, 4)
  assert.equal(checkPilotConfig({ ...configured, YUMS_DEMO_MODE: "true", NEXT_PUBLIC_INVITE_ONLY: "false" }).errors.length, 2)
})
test("rejects secret keys without exposing their contents", () => {
  for (const key of ["sb_secret_sensitive", jwt("service_role"), "malformed"]) {
    const result = checkPilotConfig({ ...configured, NEXT_PUBLIC_SUPABASE_ANON_KEY: key })
    assert.equal(result.errors.length, 1)
    assert.equal(JSON.stringify(result).includes(key), false)
  }
})
test("rejects unsafe or non-origin project URLs", () => {
  for (const url of ["http://pilot.supabase.co", "https://localhost", "https://user:password@pilot.supabase.co", "https://pilot.supabase.co/path", "https://pilot.supabase.co/?key=secret"]) {
    assert.equal(checkPilotConfig({ ...configured, NEXT_PUBLIC_SUPABASE_URL: url }).errors.length, 1)
  }
})
test("requires paired Calendar refresh credentials", () => {
  assert.equal(checkPilotConfig({ ...configured, GOOGLE_CLIENT_ID: "client" }).errors.length, 1)
  assert.equal(checkPilotConfig({ ...configured, GOOGLE_CLIENT_SECRET: "secret" }).errors.length, 1)
  assert.equal(checkPilotConfig({ ...configured, GOOGLE_CLIENT_ID: "client", GOOGLE_CLIENT_SECRET: "secret" }).errors.length, 0)
})
test("optional integrations produce actionable notices without secrets", () => {
  const result = checkPilotConfig({ ...configured, OPENAI_API_KEY: "provider-secret", GOOGLE_CLIENT_ID: "client", GOOGLE_CLIENT_SECRET: "calendar-secret" })
  assert.equal(result.warnings.length, 3)
  assert.equal(JSON.stringify(result).includes("provider-secret"), false)
  assert.equal(JSON.stringify(result).includes("calendar-secret"), false)
})
