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

export function validateReportedEvent(input: ReportedEventInput, now = new Date()): ReportedEventInput {
  const title = input.title.trim()
  const description = input.description?.trim() || undefined
  const locationName = input.locationName?.trim() || undefined
  const sourceUrl = input.sourceUrl?.trim() || undefined
  if (!title || title.length > 160) throw new Error("Use a title between 1 and 160 characters.")
  if ((description?.length ?? 0) > 2000) throw new Error("Keep details under 2,000 characters.")
  if ((locationName?.length ?? 0) > 160) throw new Error("Keep the location under 160 characters.")
  const start = new Date(input.startTime)
  if (!Number.isFinite(start.getTime()) || start <= now || start.getTime() > now.getTime() + 7 * 86400000) {
    throw new Error("Choose a future event within the next seven days.")
  }
  if (sourceUrl) {
    let url: URL
    try { url = new URL(sourceUrl) } catch { throw new Error("Use a complete http or https source link.") }
    if (sourceUrl.length > 2048 || !["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      throw new Error("Use a complete http or https source link without login information.")
    }
  }
  return { title, description, locationName, startTime: start.toISOString(), sourceUrl }
}

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
 * event that already happened isn't useful on the feed.
 * Approved reports are public; pending/rejected records are author-only. */
export async function loadUpcomingReportedEvents(supabase: SupabaseClient): Promise<ReportedEvent[]> {
  const { data, error } = await supabase
    .from("user_reported_events")
    .select(SELECT_COLUMNS)
    .gte("start_time", new Date().toISOString())
    .lte("start_time", new Date(Date.now() + 7 * 86400000).toISOString())
    .order("start_time", { ascending: true })
  if (error) throw error
  return ((data ?? []) as ReportedEventRow[]).map(fromRow)
}

export async function submitReportedEvent(
  supabase: SupabaseClient,
  userId: string,
  input: ReportedEventInput,
): Promise<ReportedEvent> {
  const validated = validateReportedEvent(input)
  const { data, error } = await supabase
    .from("user_reported_events")
    .insert({
      user_id: userId,
      title: validated.title,
      description: validated.description ?? null,
      location_name: validated.locationName ?? null,
      start_time: validated.startTime,
      source_url: validated.sourceUrl ?? null,
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
