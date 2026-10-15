// @vitest-environment node
import { readFile } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"
import { describe, expect, it } from "vitest"

const audit = await readFile(new URL("./pilot-audit.sql", import.meta.url), "utf8")

describe("read-only pilot database inventory", () => {
  it("reports missing schema and roles without failing on absent app tables", async () => {
    const db = await PGlite.create()
    try {
      const results = await db.exec(audit)
      const rows = results.flatMap((result) => result.rows) as Record<string, unknown>[]
      expect(rows.filter((row) => row.row_security === "missing")).toHaveLength(6)
      expect(rows.filter((row) => row.role_exists === false)).toHaveLength(12)
      expect(rows.find((row) => row.trigger_name === "on_auth_user_created")).toMatchObject({ trigger_exists: false })
    } finally { await db.close() }
  }, 20000)
  it("inventories the actual migrated schema and detects weakened security metadata", async () => {
    const db = await PGlite.create()
    try {
      await db.exec(`create schema auth; create table auth.users(id uuid primary key, email text);
        create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
        create function uuid_generate_v4() returns uuid language sql as $$ select gen_random_uuid() $$;
        create role authenticated; create role anon;`)
      const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8")
      await db.exec(schema.replace('create extension if not exists "uuid-ossp";', ""))
      await db.exec(await readFile(new URL("./migrations/20261007_chat_allowance.sql", import.meta.url), "utf8"))
      await db.exec(`insert into auth.users values ('11111111-1111-4111-8111-111111111111', 'private-fixture@example.test');
        insert into public.calendar_connections (user_id, access_token, expires_at)
        values ('11111111-1111-4111-8111-111111111111', 'private-fixture-token', now());`)
      const inventory = async () => (await db.exec(audit)).flatMap((result) => result.rows) as Record<string, unknown>[]
      const rows = await inventory()
      expect(JSON.stringify(rows)).not.toContain("private-fixture")
      expect(rows.filter((row) => row.row_security === "enabled")).toHaveLength(6)
      expect(rows.filter((row) => row.column_name && row.data_type === null)).toHaveLength(0)
      expect(rows.find((row) => row.function_name === "public.consume_chat_allowance()" && row.role_name === "anon"))
        .toMatchObject({ function_exists: true, security_definer: true, can_execute: false, public_can_execute: false })
      expect(rows.find((row) => row.function_name === "public.consume_chat_allowance()" && row.role_name === "authenticated"))
        .toMatchObject({ can_execute: true })
      expect(rows.find((row) => row.trigger_name === "on_auth_user_created"))
        .toMatchObject({ trigger_exists: true, enabled: "O" })
      await db.exec(`alter table public.recommendations disable row level security;
        grant execute on function public.consume_chat_allowance() to public;
        alter table auth.users disable trigger on_auth_user_created;`)
      const weakened = await inventory()
      expect(weakened.find((row) => row.table_name === "recommendations" && row.row_security))
        .toMatchObject({ row_security: "disabled" })
      expect(weakened.find((row) => row.function_name === "public.consume_chat_allowance()" && row.role_name === "anon"))
        .toMatchObject({ can_execute: true, public_can_execute: true })
      expect(weakened.find((row) => row.trigger_name === "on_auth_user_created"))
        .toMatchObject({ enabled: "D" })
      expect((await db.query("select count(*)::int as count from public.users")).rows).toEqual([{ count: 1 }])
      expect((await db.query("select access_token from public.calendar_connections")).rows).toEqual([{ access_token: "private-fixture-token" }])
    } finally { await db.close() }
  }, 20000)
})
