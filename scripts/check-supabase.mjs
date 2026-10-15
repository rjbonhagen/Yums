import { checkSupabaseReadiness } from "./supabase-readiness.mjs"

const result = await checkSupabaseReadiness(process.env)
for (const passed of result.passed) console.log(`PASS: ${passed}`)
for (const error of result.errors) console.error(`ERROR: ${error}`)
console.log("Read-only checks: no account rows requested or remote changes made.")
console.log("These checks do not prove RLS, uniqueness, profile triggers, report constraints, quota permissions, SMTP delivery, redirect settings, or signed-in persistence. Complete the SQL-editor audit and two-account acceptance checks.")
if (result.errors.length) process.exitCode = 1
