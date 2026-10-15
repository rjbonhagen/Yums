export function checkPilotConfig(env) {
  const errors = []
  const warnings = []
  if (env.YUMS_DEMO_MODE !== "false") errors.push("Set YUMS_DEMO_MODE=false for live pilot data.")
  if (env.NEXT_PUBLIC_INVITE_ONLY !== "true") errors.push("Set NEXT_PUBLIC_INVITE_ONLY=true and disable new sign-ups in Supabase.")
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL)
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error()
    if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error()
  } catch {
    errors.push("Set NEXT_PUBLIC_SUPABASE_URL to the hosted HTTPS project origin.")
  }
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  let publicKey = key.startsWith("sb_publishable_") && key.length > "sb_publishable_".length
  if (!publicKey && key.split(".").length === 3) {
    try {
      publicKey = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role === "anon"
    } catch { /* Invalid public configuration is reported without printing it. */ }
  }
  if (!publicKey) errors.push("Set NEXT_PUBLIC_SUPABASE_ANON_KEY to a publishable or anon client key; never use a secret or service-role key.")
  if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) errors.push("Calendar refresh requires both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.")
  if (env.OPENAI_API_KEY) warnings.push("Provider chat is configured: verify the remote allowance migration and provider spend cap before release.")
  if (env.GOOGLE_CLIENT_ID) warnings.push("Calendar is configured: verify consent, callback allowlists, refresh, and disconnect with a real account.")
  if (!env.NEXT_PUBLIC_MAPBOX_TOKEN) warnings.push("Map is unavailable; the listing view remains available.")
  return { errors, warnings }
}
