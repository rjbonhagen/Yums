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
  const [prefsResult, mealPlanResult] = await Promise.all([
    supabase
      .from("user_preferences")
      .select("weekly_budget, transportation, max_travel_minutes, optimize_for")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("meal_plans")
      .select("meal_swipes_remaining, dining_dollars_remaining, days_left_in_term")
      .eq("user_id", userId)
      .maybeSingle(),
  ])

  if (prefsResult.error) throw prefsResult.error
  if (!prefsResult.data) return null

  const mealPlanRow = mealPlanResult.error ? null : mealPlanResult.data
  const mealPlan: MealPlanInput | undefined = mealPlanRow
    ? {
        mealSwipesRemaining: mealPlanRow.meal_swipes_remaining,
        diningDollarsRemaining: mealPlanRow.dining_dollars_remaining,
        daysLeftInTerm: mealPlanRow.days_left_in_term,
      }
    : undefined

  return {
    budget: prefsResult.data.weekly_budget,
    transportation: prefsResult.data.transportation,
    maxTravelMinutes: prefsResult.data.max_travel_minutes,
    optimizeFor: prefsResult.data.optimize_for,
    mealPlan,
  }
}

/** Matches packages/database/schema.sql's meal_plans table. Called
 * alongside savePreferencesToSupabase from /start for a signed-in
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
