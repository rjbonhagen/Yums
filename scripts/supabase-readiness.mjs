import { checkPilotConfig } from "./pilot-config.mjs"

const tables = [
  ["users", "id", "20261007_user_sync.sql"],
  ["user_preferences", "user_id", "schema review"],
  ["recommendations", "id,save_key,end_time", "20261007_saved_identity.sql"],
  ["user_reported_events", "id,moderation_status", "20261007_report_moderation.sql"],
  ["chat_usage", "user_id", "20261007_chat_allowance.sql"],
]

// Public metadata checks only. Never invoke quota functions or request rows.
export async function checkSupabaseReadiness(env, fetcher = fetch) {
  const errors = checkPilotConfig(env).errors
  if (errors.length) return { errors, passed: [] }
  const origin = new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin
  const passed = []
  const options = () => ({
    method: "GET", redirect: "error",
    headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
    signal: AbortSignal.timeout(8000),
  })
  try {
    const response = await fetcher(`${origin}/auth/v1/settings`, options())
    if (!response.ok) errors.push(`Auth settings unavailable (HTTP ${response.status}). Check the public key and project.`)
    else {
      const settings = await response.json()
      if (settings.disable_signup !== true) errors.push("Disable new sign-ups in Supabase Authentication for the invited pilot.")
      else passed.push("Public sign-ups disabled")
      if (settings.external?.anonymous_users !== false) errors.push("Verify anonymous sign-ins are disabled in Supabase Authentication.")
      else passed.push("Anonymous sign-ins disabled")
    }
  } catch { errors.push("Auth settings could not be checked. Check project connectivity and retry.") }
  for (const [table, columns, migration] of tables) {
    try {
      const response = await fetcher(`${origin}/rest/v1/${table}?select=${columns}&limit=0`, options())
      if (response.ok) passed.push(`${table}: required columns available`)
      else {
        let code
        try { code = (await response.json()).code } catch { /* Report status only. */ }
        if (["42703", "PGRST204", "PGRST205", "42P01"].includes(code)) {
          errors.push(`${table}: required schema unavailable. Review ${migration} and the SQL-editor audit.`)
        } else errors.push(`${table}: metadata request failed (HTTP ${response.status}). Review project access and the SQL-editor audit.`)
      }
    } catch { errors.push(`${table}: metadata could not be checked. Retry when the project is reachable.`) }
  }
  return { errors, passed }
}
