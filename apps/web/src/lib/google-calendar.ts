// Real schedule-awareness, replacing the flat scheduleScore placeholder in
// packages/shared/optimizer.ts's callers. Uses Google's public Calendar
// FreeBusy API (calendar.freebusy scope) — real busy/free intervals from
// the signed-in user's own primary calendar, never a guess. A user must
// explicitly connect via /login's "Connect Google Calendar" action; this
// never runs for someone who hasn't granted the scope.

const FREEBUSY_URL = "https://www.googleapis.com/calendar/v3/freeBusy"
const TOKEN_URL = "https://oauth2.googleapis.com/token"

export async function verifyCalendarAccount(accessToken: string, email: string): Promise<void> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  })
  if (!response.ok) throw new Error("Could not verify Calendar account")
  const identity = await response.json() as { email?: string; email_verified?: boolean }
  if (identity.email_verified !== true || typeof identity.email !== "string"
    || identity.email.toLowerCase() !== email.toLowerCase()) {
    throw new Error("Calendar must use the same email as your Yums account")
  }
}

export interface BusyInterval {
  start: string // ISO 8601
  end: string
}

interface FreeBusyResponse {
  calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: unknown[] }>
}

/**
 * Real Google Calendar FreeBusy lookup for the signed-in user's primary
 * calendar. Throws on failure (expired token, revoked access, network) —
 * callers must catch and fall back to the documented placeholder score
 * rather than guessing at availability.
 */
export async function fetchBusyIntervals(accessToken: string, timeMin: Date, timeMax: Date): Promise<BusyInterval[]> {
  const res = await fetch(FREEBUSY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: [{ id: "primary" }],
    }),
    signal: AbortSignal.timeout(6000),
  })

  if (!res.ok) throw new Error(`Google FreeBusy API returned ${res.status}`)

  const body = (await res.json()) as FreeBusyResponse
  const primary = body?.calendars?.primary
  if (!primary || primary.errors?.length || !Array.isArray(primary.busy)) {
    throw new Error("Google Calendar could not confirm availability")
  }
  if (!primary.busy.every((interval) => typeof interval.start === "string" && typeof interval.end === "string"
    && Number.isFinite(Date.parse(interval.start)) && Number.isFinite(Date.parse(interval.end))
    && Date.parse(interval.end) > Date.parse(interval.start))) {
    throw new Error("Google Calendar returned invalid availability")
  }
  return primary.busy
}

/**
 * Google access tokens are short-lived (~1hr). Exchanges a stored refresh
 * token for a new access token, per Google's documented OAuth2 refresh
 * flow. Requires GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET (see
 * apps/web/.env.example) — these are the app's own OAuth client
 * credentials, separate from Supabase's provider configuration, needed
 * because Supabase doesn't proxy third-party API token refreshes.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not configured — see apps/web/.env.example")
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(6000),
  })

  if (!res.ok) throw new Error(`Google token refresh returned ${res.status}`)

  const body = (await res.json()) as { access_token: string; expires_in: number }
  if (!body?.access_token || typeof body.access_token !== "string" || !Number.isFinite(body.expires_in) || body.expires_in <= 0) {
    throw new Error("Google token refresh returned invalid credentials")
  }
  return { accessToken: body.access_token, expiresAt: new Date(Date.now() + body.expires_in * 1000) }
}

/**
 * Server-only: resolves the signed-in user's Google Calendar access token
 * from calendar_connections (see packages/database/schema.sql), refreshing
 * it first if expired. Returns null whenever a real token isn't available
 * for any reason (no session, no connection, refresh failure) — callers
 * treat that as "no calendar," never as an error to surface, since not
 * connecting is the normal/default state (see /login).
 */
export async function getConnectedCalendarAccessToken(): Promise<string | null> {
  try { return await resolveConnectedCalendarToken() } catch { return null }
}

async function resolveConnectedCalendarToken(): Promise<string | null> {
  const { isSupabaseConfigured } = await import("./supabase/client")
  if (!isSupabaseConfigured()) return null

  const { createClient } = await import("./supabase/server")
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: connection } = await supabase
    .from("calendar_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", user.id)
    .maybeSingle()
  if (!connection) return null

  if (new Date(connection.expires_at) > new Date()) {
    return connection.access_token
  }

  if (!connection.refresh_token) return null

  try {
    const { accessToken, expiresAt } = await refreshAccessToken(connection.refresh_token)
    await supabase
      .from("calendar_connections")
      .update({ access_token: accessToken, expires_at: expiresAt.toISOString(), updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
    return accessToken
  } catch {
    return null
  }
}

export function scheduleScoreFromBusyIntervals(
  busy: BusyInterval[],
  eventStart: Date,
  eventEnd: Date,
): number {
  const overlaps = busy.some((b) => {
    const busyStart = new Date(b.start)
    const busyEnd = new Date(b.end)
    return eventStart < busyEnd && eventEnd > busyStart
  })
  return overlaps ? 0.1 : 1.0
}
