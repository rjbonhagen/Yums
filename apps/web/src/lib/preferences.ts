import type { SupabaseClient } from "@supabase/supabase-js"

export interface WeeklyPreferences {
  budget: number
  optimizeFor: "cheapest" | "healthy" | "high_protein" | "fast" | "custom"
  transportation: "walking" | "bike" | "car" | "transit"
  maxTravelMinutes: number
}

const STORAGE_KEY = "yums.preferences"

/**
 * Client-side persistence with zero configuration required. /start uses
 * this when there's no Supabase project configured or no signed-in user —
 * see savePreferencesToSupabase below for the authenticated path, wired in
 * at /start via the /login magic-link flow (docs/architecture.md).
 */
export function saveLocalPreferences(prefs: WeeklyPreferences): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}

export function loadLocalPreferences(): WeeklyPreferences | null {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as WeeklyPreferences
  } catch {
    return null
  }
}

/**
 * Real Supabase write, matching packages/database/schema.sql's
 * user_preferences table. Called from /start's submit handler for signed-in
 * users (see the /login magic-link flow and apps/web/src/middleware.ts for
 * session handling) — requires the auth.users -> public.users sync trigger
 * in schema.sql to have run first so the FK on user_id resolves.
 */
export async function savePreferencesToSupabase(
  supabase: SupabaseClient,
  userId: string,
  prefs: WeeklyPreferences,
): Promise<void> {
  const { error } = await supabase.from("user_preferences").upsert({
    user_id: userId,
    weekly_budget: prefs.budget,
    transportation: prefs.transportation,
    max_travel_minutes: prefs.maxTravelMinutes,
    optimize_for: prefs.optimizeFor,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function loadPreferencesFromSupabase(
  supabase: SupabaseClient,
  userId: string,
): Promise<WeeklyPreferences | null> {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("weekly_budget, transportation, max_travel_minutes, optimize_for")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    budget: data.weekly_budget,
    transportation: data.transportation,
    maxTravelMinutes: data.max_travel_minutes,
    optimizeFor: data.optimize_for,
  }
}
