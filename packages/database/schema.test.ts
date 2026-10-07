// @vitest-environment node
import { readFile } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

let db: PGlite
const A = "11111111-1111-4111-8111-111111111111"
const B = "22222222-2222-4222-8222-222222222222"

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
    insert into auth.users values ('${A}', 'a@example.test'), ('${B}', 'b@example.test');
    insert into public.user_preferences (user_id) values ('${A}'), ('${B}');
    insert into public.recommendations (user_id, kind, title, save_key, source_url)
      values ('${A}', 'free_food', 'A event', 'a', 'https://example.test/a'),
             ('${B}', 'free_food', 'B event', 'b', 'https://example.test/b');
    insert into public.calendar_connections (user_id, access_token, expires_at)
      values ('${A}', 'a-test-token', now()), ('${B}', 'b-test-token', now());
    insert into public.user_reported_events (user_id, title, start_time)
      values ('${A}', 'A report', now()), ('${B}', 'B report', now());
  `)
}, 20000)
beforeEach(async () => {
  await db.exec(`reset role; set request.jwt.claim.sub = '${A}'; set role authenticated;`)
})
afterAll(async () => { await db?.close() })

describe("database constraints and account isolation", () => {
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
    await db.exec("reset role; set role anon;")
    expect((await db.query("select title from public.user_reported_events")).rows).toHaveLength(2)
    await expect(db.query("delete from public.user_reported_events")).rejects.toThrow(/permission denied/i)
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
