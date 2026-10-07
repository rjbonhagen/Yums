import { cookies } from "next/headers"
import { createClient } from "./supabase/server"
import { isSupabaseConfigured } from "./supabase/client"
import { DEFAULT_PREFERENCES, PREFERENCES_COOKIE, loadPreferencesFromSupabase, normalizePreferences, type WeeklyPreferences } from "./preferences"

export async function getPreferences(overrides: Record<string, unknown> = {}): Promise<WeeklyPreferences> {
  let preferences = DEFAULT_PREFERENCES
  const raw = (await cookies()).get(PREFERENCES_COOKIE)?.value
  try { if (raw) preferences = normalizePreferences(JSON.parse(decodeURIComponent(raw))) } catch { /* Ignore malformed cookies. */ }
  if (isSupabaseConfigured()) {
    try {
      const client = await createClient()
      const { data: { user } } = await client.auth.getUser()
      if (user) preferences = await loadPreferencesFromSupabase(client, user.id) ?? preferences
    } catch { /* Use the browser's settings when preference sync is unavailable. */ }
  }
  return normalizePreferences({ ...preferences, ...Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined)) })
}
