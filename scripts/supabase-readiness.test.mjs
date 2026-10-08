import assert from "node:assert/strict"
import test from "node:test"
import { checkSupabaseReadiness } from "./supabase-readiness.mjs"

const env = {
  YUMS_DEMO_MODE: "false", NEXT_PUBLIC_INVITE_ONLY: "true",
  NEXT_PUBLIC_SUPABASE_URL: "https://pilot.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_test",
}
const response = (body, status = 200) => new Response(JSON.stringify(body), { status })
const settings = { disable_signup: true, external: { anonymous_users: false } }

test("checks metadata without requesting private records or performing writes", async () => {
  const requests = []
  const result = await checkSupabaseReadiness(env, async (url, options) => {
    requests.push(url)
    assert.equal(options.method, "GET")
    assert.equal(options.redirect, "error")
    assert.deepEqual(options.headers, { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY })
    assert.equal(options.body, undefined)
    if (url.includes("/rest/v1/")) assert.equal(new URL(url).searchParams.get("limit"), "0")
    assert.ok(!url.includes("/rpc/"))
    return response(url.includes("/auth/") ? settings : [])
  })
  assert.equal(requests.length, 6)
  assert.equal(result.errors.length, 0)
  assert.equal(result.passed.length, 7)
})

test("rejects secret keys and unsafe origins before making requests", async () => {
  for (const overrides of [
    { NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_secret_private" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://user:password@pilot.supabase.co" },
    { NEXT_PUBLIC_SUPABASE_URL: "http://pilot.supabase.co" },
  ]) {
    const result = await checkSupabaseReadiness({ ...env, ...overrides }, () => { assert.fail("must not send invalid configuration") })
    assert.ok(result.errors.length)
  }
})

test("reports missing migrations without exposing provider response content", async () => {
  const result = await checkSupabaseReadiness(env, async (url) => {
    if (url.includes("/auth/")) return response(settings)
    if (url.includes("/recommendations?")) return response({ code: "42703", message: "private response content" }, 400)
    if (url.includes("/user_reported_events?")) return response({ code: "42703" }, 400)
    if (url.includes("/chat_usage?")) return response({ code: "PGRST205" }, 404)
    return response([])
  })
  assert.equal(result.errors.length, 3)
  assert.ok(result.errors.some((error) => error.includes("20261007_saved_identity.sql")))
  assert.ok(result.errors.some((error) => error.includes("20261007_report_moderation.sql")))
  assert.ok(result.errors.some((error) => error.includes("20261007_chat_allowance.sql")))
  assert.ok(!JSON.stringify(result).includes("private response content"))
})

test("unknown or permissive Auth settings cannot pass invitation checks", async () => {
  for (const auth of [{}, { disable_signup: false, external: { anonymous_users: true } }]) {
    const result = await checkSupabaseReadiness(env, async (url) => response(url.includes("/auth/") ? auth : []))
    assert.equal(result.errors.length, 2)
  }
})

test("network failures and rejected keys stay visible without leaking exceptions", async () => {
  const unavailable = await checkSupabaseReadiness(env, async () => { throw new Error("private connection details") })
  assert.equal(unavailable.errors.length, 6)
  assert.ok(!JSON.stringify(unavailable).includes("private connection details"))
  const denied = await checkSupabaseReadiness(env, async () => response({ message: "private response content" }, 401))
  assert.equal(denied.errors.length, 6)
  assert.ok(denied.errors.every((error) => error.includes("HTTP 401")))
})
