import type { SupabaseClient } from "@supabase/supabase-js"
import type { Recommendation } from "@yums/shared"

// Persists to the `recommendations` table (see packages/database/schema.sql
// for why that table — not a new one — is used for this). A save is a
// denormalized snapshot of a Recommendation at save time, not a live
// pointer back to it: the free-food event or OSM place it came from won't
// necessarily still be returned by buildRecommendations() later.
export interface SavedItem {
  id: string
  kind: "free_food" | "nearby_eats"
  title: string
  subtitle?: string
  sourceUrl?: string
  latitude?: number
  longitude?: number
  startTime?: string
}

interface SavedItemRow {
  id: string
  kind: "free_food" | "nearby_eats"
  title: string
  subtitle: string | null
  source_url: string | null
  latitude: number | null
  longitude: number | null
  start_time: string | null
}

const SELECT_COLUMNS = "id, kind, title, subtitle, source_url, latitude, longitude, start_time"

function fromRow(row: SavedItemRow): SavedItem {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    startTime: row.start_time ?? undefined,
  }
}

export async function loadSavedItems(supabase: SupabaseClient, userId: string): Promise<SavedItem[]> {
  const { data, error } = await supabase
    .from("recommendations")
    .select(SELECT_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  if (error) throw error
  return ((data ?? []) as SavedItemRow[]).map(fromRow)
}

export async function saveRecommendation(
  supabase: SupabaseClient,
  userId: string,
  r: Recommendation,
): Promise<SavedItem> {
  const { data, error } = await supabase
    .from("recommendations")
    .insert({
      user_id: userId,
      kind: r.kind,
      title: r.title,
      subtitle: r.subtitle ?? null,
      estimated_savings: r.estimatedSavings,
      distance_minutes: r.distanceMinutes ?? null,
      start_time: r.startTime ?? null,
      source_url: r.sourceUrl ?? null,
      latitude: r.latitude ?? null,
      longitude: r.longitude ?? null,
      score: r.score,
    })
    .select(SELECT_COLUMNS)
    .single()
  if (error) throw error
  return fromRow(data as SavedItemRow)
}

export async function unsaveItem(supabase: SupabaseClient, userId: string, id: string): Promise<void> {
  const { error } = await supabase.from("recommendations").delete().eq("id", id).eq("user_id", userId)
  if (error) throw error
}
