import type { SupabaseClient } from "@supabase/supabase-js"

// Crowdsourced free-food tips — a student reports something they found
// that isn't on either live feed (events.berkeley.edu, Cal Link). Kept in
// its own table (user_reported_events, see packages/database/schema.sql)
// and shown in its own clearly-labeled, unverified section on /feed —
// never merged into buildRecommendations()'s scored/ranked list, since
// that list's whole guarantee is "every item is a real, live source."
export interface ReportedEvent {
  id: string
  userId: string
  title: string
  description?: string
  locationName?: string
  latitude?: number
  longitude?: number
  startTime: string
  sourceUrl?: string
  createdAt: string
  moderationStatus: "pending" | "approved" | "rejected"
}

export interface ReportedEventInput {
  title: string
  description?: string
  locationName?: string
  startTime: string
  sourceUrl?: string
}

interface ReportedEventRow {
  id: string
  user_id: string
  title: string
  description: string | null
  location_name: string | null
  latitude: number | null
  longitude: number | null
  start_time: string
  source_url: string | null
  created_at: string
  moderation_status: "pending" | "approved" | "rejected"
}

const SELECT_COLUMNS =
  "id, user_id, title, description, location_name, latitude, longitude, start_time, source_url, created_at, moderation_status"

function fromRow(row: ReportedEventRow): ReportedEvent {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description ?? undefined,
    locationName: row.location_name ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    startTime: row.start_time,
    sourceUrl: row.source_url ?? undefined,
    createdAt: row.created_at,
    moderationStatus: row.moderation_status,
  }
}

/** Upcoming reports only (startTime in the future) — a report for an
 * event that already happened isn't useful on the feed. Publicly
 * Approved reports are public; pending/rejected records are author-only. */
export async function loadUpcomingReportedEvents(supabase: SupabaseClient): Promise<ReportedEvent[]> {
  const { data, error } = await supabase
    .from("user_reported_events")
    .select(SELECT_COLUMNS)
    .gte("start_time", new Date().toISOString())
    .order("start_time", { ascending: true })
  if (error) throw error
  return ((data ?? []) as ReportedEventRow[]).map(fromRow)
}

export async function submitReportedEvent(
  supabase: SupabaseClient,
  userId: string,
  input: ReportedEventInput,
): Promise<ReportedEvent> {
  const { data, error } = await supabase
    .from("user_reported_events")
    .insert({
      user_id: userId,
      title: input.title,
      description: input.description ?? null,
      location_name: input.locationName ?? null,
      start_time: input.startTime,
      source_url: input.sourceUrl ?? null,
      moderation_status: "pending",
    })
    .select(SELECT_COLUMNS)
    .single()
  if (error) throw error
  return fromRow(data as ReportedEventRow)
}

export async function deleteReportedEvent(supabase: SupabaseClient, userId: string, id: string): Promise<void> {
  const { error } = await supabase.from("user_reported_events").delete().eq("id", id).eq("user_id", userId)
  if (error) throw error
}
