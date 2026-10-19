// @vitest-environment node
import { readFile } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

let db: PGlite
const A = "11111111-1111-4111-8111-111111111111"
const B = "22222222-2222-4222-8222-222222222222"
const EXISTING = "33333333-3333-4333-8333-333333333333"
const LEGACY = "44444444-4444-4444-8444-444444444444"
const NON_EMAIL = "55555555-5555-4555-8555-555555555555"

beforeAll(async () => {
  db = await PGlite.create()
  // Supabase supplies auth.users/auth.uid; this harness supplies the same
  // contract and substitutes core UUID generation for the optional extension.
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function uuid_generate_v4() returns uuid language sql as $$ select gen_random_uuid() $$;
    insert into auth.users values ('${EXISTING}', 'existing@example.test');
  `)
  const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8")
  await db.exec(schema.replace('create extension if not exists "uuid-ossp";', ""))
  await db.exec(`
    create role authenticated;
    create role anon;
    grant usage on schema public, auth to authenticated, anon;
    grant select, insert, update, delete on public.users, public.user_preferences,
      public.recommendations, public.calendar_connections, public.user_reported_events to authenticated;
    grant select on public.user_reported_events to anon;
    grant select, insert, update, delete on public.universities, public.event_sources,
      public.events, public.businesses, public.deals to authenticated, anon;
    insert into auth.users values ('${A}', 'a@example.test'), ('${B}', 'b@example.test');
    insert into public.user_preferences (user_id) values ('${A}'), ('${B}');
    insert into public.recommendations (user_id, kind, title, save_key, source_url)
      values ('${A}', 'free_food', 'A event', 'a', 'https://example.test/a'),
             ('${B}', 'free_food', 'B event', 'b', 'https://example.test/b');
    insert into public.calendar_connections (user_id, access_token, expires_at)
      values ('${A}', 'a-test-token', now()), ('${B}', 'b-test-token', now());
    insert into public.user_reported_events (user_id, title, start_time)
      values ('${A}', 'A report', now()), ('${B}', 'B report', now());
    update public.user_reported_events set moderation_status = 'approved' where user_id = '${B}';
  `)
  // Hosted projects can grant anon explicit function execution by default.
  // Revoking PUBLIC alone must not leave that independent grant in place.
  await db.exec("alter default privileges grant execute on functions to anon;")
  await db.exec(await readFile(new URL("./migrations/20261007_chat_allowance.sql", import.meta.url), "utf8"))
  await db.exec("grant select, insert, update, delete on public.chat_usage to authenticated;")
}, 20000)
beforeEach(async () => {
  await db.exec(`reset role; set request.jwt.claim.sub = '${A}'; set role authenticated;`)
})
afterAll(async () => { await db?.close() })

describe("database constraints and account isolation", () => {
  it("keeps catalog data readable but blocks client writes even with broad table grants", async () => {
    await db.exec(`reset role;
      insert into public.event_sources (name, adapter_key) values ('Campus source', 'test');
      insert into public.events (organization, title, start_time, source_url)
        values ('Campus', 'Public event', now(), 'https://example.test/event');
      insert into public.businesses (name) values ('Public business');
      insert into public.deals (description, discount_type) values ('Public deal', 'other');`)
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`reset role; set request.jwt.claim.sub = '${role === "authenticated" ? A : ""}'; set role ${role};`)
      for (const [table, column] of [["universities", "name"], ["event_sources", "name"], ["events", "title"], ["businesses", "name"], ["deals", "description"]]) {
        expect((await db.query(`select * from public.${table}`)).rows.length).toBeGreaterThan(0)
        expect((await db.query(`update public.${table} set ${column} = 'Changed' returning id`)).rows).toHaveLength(0)
        expect((await db.query(`delete from public.${table} returning id`)).rows).toHaveLength(0)
      }
      await expect(db.query("insert into public.universities (name, slug) values ('Untrusted', 'untrusted')")).rejects.toThrow(/row-level security/i)
      await expect(db.query("insert into public.event_sources (name, adapter_key) values ('Untrusted', 'untrusted')")).rejects.toThrow(/row-level security/i)
      await expect(db.query("insert into public.events (organization, title, start_time, source_url) values ('Untrusted', 'Untrusted', now(), 'https://example.test/untrusted')")).rejects.toThrow(/row-level security/i)
      await expect(db.query("insert into public.businesses (name) values ('Untrusted')")).rejects.toThrow(/row-level security/i)
      await expect(db.query("insert into public.deals (description, discount_type) values ('Untrusted', 'other')")).rejects.toThrow(/row-level security/i)
    }
  })
  it("denies anonymous quota execution even when project defaults explicitly grant it", async () => {
    const { rows } = await db.query("select has_function_privilege('anon', 'public.consume_chat_allowance()', 'EXECUTE') as anon_execute, has_function_privilege('authenticated', 'public.consume_chat_allowance()', 'EXECUTE') as authenticated_execute")
    expect(rows).toEqual([{ anon_execute: false, authenticated_execute: true }])
  })
  it("creates app profiles for Auth accounts that predate the schema", async () => {
    await db.exec("reset role;")
    expect((await db.query("select email from public.users where id = $1", [EXISTING])).rows).toEqual([{ email: "existing@example.test" }])
    await db.query("insert into public.user_preferences (user_id) values ($1)", [EXISTING])
  })
  it("backfills missing profiles repeatably without overwriting existing profiles", async () => {
    await db.exec(`reset role;
      drop trigger on_auth_user_created on auth.users;
      insert into auth.users values ('${LEGACY}', 'legacy@example.test'), ('${NON_EMAIL}', null);
      update public.users set email = 'preserved@example.test' where id = '${EXISTING}';`)
    const migration = await readFile(new URL("./migrations/20261007_user_sync.sql", import.meta.url), "utf8")
    await db.exec(migration)
    await db.exec(migration)
    expect((await db.query("select email from public.users where id = $1", [LEGACY])).rows).toEqual([{ email: "legacy@example.test" }])
    expect((await db.query("select email from public.users where id = $1", [EXISTING])).rows).toEqual([{ email: "preserved@example.test" }])
    expect((await db.query("select id from public.users where id = $1", [NON_EMAIL])).rows).toHaveLength(0)
    const nextAccount = "66666666-6666-4666-8666-666666666666"
    const nextNonEmail = "77777777-7777-4777-8777-777777777777"
    await db.query("insert into auth.users (id, email) values ($1, 'next@example.test'), ($2, null)", [nextAccount, nextNonEmail])
    expect((await db.query("select email from public.users where id = $1", [nextAccount])).rows).toEqual([{ email: "next@example.test" }])
    expect((await db.query("select id from public.users where id = $1", [nextNonEmail])).rows).toHaveLength(0)
    await db.query("insert into public.user_preferences (user_id) values ($1)", [LEGACY])
    await db.exec(`set request.jwt.claim.sub = '${LEGACY}'; set role authenticated;`)
    expect((await db.query("select user_id from public.user_preferences")).rows).toEqual([{ user_id: LEGACY }])
  })
  it("rejects invalid report content even when callers bypass the app", async () => {
    for (const title of [" ", "x".repeat(161)]) {
      await expect(db.query("insert into public.user_reported_events (user_id, title, start_time) values ($1, $2, now())", [A, title])).rejects.toThrow(/reports_content_limits/)
    }
    for (const source of ["javascript:alert(1)", "data:text/html,hello", "https://user:password@example.com/"]) {
      await expect(db.query("insert into public.user_reported_events (user_id, title, start_time, source_url) values ($1, 'Free food', now(), $2)", [A, source])).rejects.toThrow(/reports_content_limits/)
    }
  })
  it("adds repeatable report validation without deleting legacy records", async () => {
    await db.exec(`reset role; alter table public.user_reported_events drop constraint reports_content_limits;
      insert into public.user_reported_events (user_id, title, start_time) values ('${A}', '', now());`)
    const migration = await readFile(new URL("./migrations/20261007_report_validation.sql", import.meta.url), "utf8")
    await db.exec(migration)
    await db.exec(migration)
    expect((await db.query("select title from public.user_reported_events where title = ''")).rows).toHaveLength(1)
    await expect(db.query("update public.user_reported_events set moderation_status = 'approved' where title = ''")).rejects.toThrow(/reports_content_limits/)
    await db.exec("delete from public.user_reported_events where title = '';")
  })
  it("limits provider attempts atomically, prevents client resets, and isolates accounts", async () => {
    expect((await db.query("select consume_chat_allowance() as allowed")).rows).toEqual([{ allowed: true }])
    expect((await db.query("select consume_chat_allowance() as allowed")).rows).toEqual([{ allowed: false }])
    expect((await db.query("update public.chat_usage set requests = 0 returning user_id")).rows).toHaveLength(0)
    await expect(db.query("insert into public.chat_usage (user_id, usage_date) values ($1, current_date)", [A])).rejects.toThrow(/row-level security/i)
    for (let attempt = 1; attempt < 20; attempt++) {
      await db.exec("reset role; update public.chat_usage set last_request_at = now() - interval '6 seconds'; set role authenticated;")
      expect((await db.query("select consume_chat_allowance() as allowed")).rows).toEqual([{ allowed: true }])
    }
    await db.exec("reset role; update public.chat_usage set last_request_at = now() - interval '6 seconds'; set role authenticated;")
    expect((await db.query("select consume_chat_allowance() as allowed")).rows).toEqual([{ allowed: false }])
    await db.exec(`reset role; set request.jwt.claim.sub = '${B}'; set role authenticated;`)
    expect((await db.query("select consume_chat_allowance() as allowed")).rows).toEqual([{ allowed: true }])
    await db.exec("reset role; set request.jwt.claim.sub = ''; set role anon;")
    await expect(db.query("select consume_chat_allowance()")).rejects.toThrow(/permission denied/i)
  })
  it("isolates account saves, preferences, and Calendar tokens", async () => {
    for (const table of ["recommendations", "user_preferences", "calendar_connections"]) {
      const { rows } = await db.query<{ user_id: string }>(`select user_id from public.${table}`)
      expect(rows.length).toBeGreaterThan(0)
      expect(rows.every((row) => row.user_id === A)).toBe(true)
    }
    await expect(db.query("insert into public.recommendations (user_id, kind, title, save_key) values ($1, 'free_food', 'forbidden', 'forbidden')", [B])).rejects.toThrow(/row-level security/i)
    const result = await db.query("delete from public.recommendations where user_id = $1 returning id", [B])
    expect(result.rows).toHaveLength(0)
  })
  it("allows public report reads but restricts changes to the author", async () => {
    expect((await db.query("select title from public.user_reported_events")).rows).toHaveLength(2)
    const result = await db.query("delete from public.user_reported_events where user_id = $1 returning id", [B])
    expect(result.rows).toHaveLength(0)
    await db.exec("reset role; set request.jwt.claim.sub = ''; set role anon;")
    expect((await db.query("select title from public.user_reported_events")).rows).toHaveLength(1)
    await expect(db.query("delete from public.user_reported_events")).rejects.toThrow(/permission denied/i)
  })
  it("prevents authors from publishing reports or changing approved content", async () => {
    await expect(db.query("update public.user_reported_events set moderation_status = 'approved' where user_id = $1", [A])).rejects.toThrow(/row-level security/i)
    await expect(db.query("insert into public.user_reported_events (user_id, title, start_time, moderation_status) values ($1, 'Self-approved', now(), 'approved')", [A])).rejects.toThrow(/row-level security/i)
    await db.exec(`reset role; set request.jwt.claim.sub = '${B}'; set role authenticated;`)
    expect((await db.query("update public.user_reported_events set title = 'Changed after approval' where user_id = $1 returning id", [B])).rows).toHaveLength(0)
    await db.exec("reset role; set request.jwt.claim.sub = ''; set role anon;")
    expect((await db.query("select title from public.user_reported_events")).rows).toEqual([{ title: "B report" }])
  })
  it("upgrades existing reports to pending and keeps moderation migration repeatable", async () => {
    await db.exec("reset role; alter table public.user_reported_events drop column moderation_status cascade;")
    const migration = await readFile(new URL("./migrations/20261007_report_moderation.sql", import.meta.url), "utf8")
    await db.exec(migration)
    await db.exec(migration)
    await db.exec("set request.jwt.claim.sub = ''; set role anon;")
    expect((await db.query("select title from public.user_reported_events")).rows).toHaveLength(0)
  })
  it("makes repeated cloud saves idempotent through the uniqueness constraint", async () => {
    for (let index = 0; index < 2; index++) {
      await db.query("insert into public.recommendations (user_id, kind, title, save_key) values ($1, 'free_food', 'saved', 'same-key') on conflict (user_id, save_key) do update set title = excluded.title", [A])
    }
    expect((await db.query("select id from public.recommendations where save_key = 'same-key'")).rows).toHaveLength(1)
  })
  it("upgrades legacy saves, keeps the newest duplicate, and can run again", async () => {
    await db.exec(`reset role; alter table public.recommendations drop column save_key cascade;
      insert into public.recommendations (user_id, kind, title, source_url, start_time, created_at)
      values ('${A}', 'free_food', 'Older snapshot', 'https://example.test/duplicate', '2026-10-07T20:00:00Z', '2026-10-05T20:00:00Z'),
             ('${A}', 'free_food', 'Newest snapshot', 'https://example.test/duplicate', '2026-10-07T20:00:00Z', '2026-10-06T20:00:00Z');`)
    const migration = await readFile(new URL("./migrations/20261007_saved_identity.sql", import.meta.url), "utf8")
    await db.exec(migration)
    await db.exec(migration)
    const { rows } = await db.query<{ title: string; save_key: string }>("select title, save_key from public.recommendations where source_url = 'https://example.test/duplicate'")
    expect(rows).toEqual([{ title: "Newest snapshot", save_key: "free_food::https://example.test/duplicate::2026-10-07T20:00:00.000Z" }])
  })
})
