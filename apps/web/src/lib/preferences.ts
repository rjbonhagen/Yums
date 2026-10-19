import type { SupabaseClient } from "@supabase/supabase-js"

export interface WeeklyPreferences {
  budget: number
  optimizeFor: "cheapest" | "fast"
  transportation: "walking"
  maxTravelMinutes: number
}

const STORAGE_KEY = "yums.preferences"
export const PREFERENCES_COOKIE = "yums-preferences"
export const DEFAULT_PREFERENCES: WeeklyPreferences = {
  budget: 60, optimizeFor: "cheapest", transportation: "walking", maxTravelMinutes: 20,
}

export function normalizePreferences(value: unknown): WeeklyPreferences {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {}
  const bounded = (raw: unknown, fallback: number, min: number, max: number) => {
    if (typeof raw !== "string" && typeof raw !== "number") return fallback
    if (raw === "") return fallback
    const number = Number(raw)
    return Number.isFinite(number) && number >= min && number <= max ? number : fallback
  }
  return {
    budget: Math.round(bounded(input.budget, 60, 0, 1000) * 100) / 100,
    maxTravelMinutes: Math.round(bounded(input.maxTravelMinutes, 20, 1, 120)),
    optimizeFor: input.optimizeFor === "fast" ? "fast" : "cheapest",
    transportation: "walking",
  }
}

/** Store guest preferences in the browser. */
export function saveLocalPreferences(prefs: WeeklyPreferences): void {
  if (typeof window === "undefined") return
  const serialized = JSON.stringify(normalizePreferences(prefs))
  // A non-sensitive preference cookie lets server-rendered views use guest
  // settings on direct navigation. Authentication remains in Supabase cookies.
  document.cookie = `${PREFERENCES_COOKIE}=${encodeURIComponent(serialized)}; Path=/; Max-Age=31536000; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`
  try { window.localStorage.setItem(STORAGE_KEY, serialized) } catch { /* Cookie still persists settings. */ }
}

export function loadLocalPreferences(): WeeklyPreferences | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) return normalizePreferences(JSON.parse(raw))
  } catch {
    // Private browsing may disable localStorage; use the preference cookie.
  }
  try {
    const raw = document.cookie.split("; ").find((part) => part.startsWith(`${PREFERENCES_COOKIE}=`))?.slice(PREFERENCES_COOKIE.length + 1)
    return raw ? normalizePreferences(JSON.parse(decodeURIComponent(raw))) : null
  } catch { return null }
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

  return normalizePreferences({
    budget: data.weekly_budget,
    transportation: data.transportation,
    maxTravelMinutes: data.max_travel_minutes,
    optimizeFor: data.optimize_for,
  })
}
