import type { SupabaseClient } from "@supabase/supabase-js"

export interface MealPlanInput {
  mealSwipesRemaining: number
  diningDollarsRemaining: number
  daysLeftInTerm: number
}

export interface WeeklyPreferences {
  budget: number
  optimizeFor: "cheapest" | "healthy" | "high_protein" | "fast" | "custom"
  transportation: "walking" | "bike" | "car" | "transit"
  maxTravelMinutes: number
  mealPlan?: MealPlanInput
}

const STORAGE_KEY = "campussaver.preferences"

/**
 * Client-side persistence that works today with zero configuration. This
 * is what /start actually uses right now — see savePreferencesToSupabase
 * below for the real-backend path that takes over once a Supabase project
 * and auth flow exist (docs/architecture.md).
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
 * user_preferences table. Correct and ready to call, but nothing in the
 * app invokes it yet — that requires an authenticated session, which needs
 * a login flow (magic link / OAuth) this MVP doesn't have. Wire it in once
 * auth exists: call from a server action in /start's submit handler,
 * passing the session's user id.
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

/** Matches packages/database/schema.sql's meal_plans table. Same
 * not-wired-in-yet status as the functions above — needs an authenticated
 * session. */
export async function saveMealPlanToSupabase(
  supabase: SupabaseClient,
  userId: string,
  mealPlan: MealPlanInput,
): Promise<void> {
  const { error } = await supabase.from("meal_plans").upsert({
    user_id: userId,
    meal_swipes_remaining: mealPlan.mealSwipesRemaining,
    dining_dollars_remaining: mealPlan.diningDollarsRemaining,
    days_left_in_term: mealPlan.daysLeftInTerm,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}
