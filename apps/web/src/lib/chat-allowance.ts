import { createClient } from "./supabase/server"

// Paid replies require a verified account and an atomic database allowance.
// Missing schema, auth failures, or quota exhaustion use the free reply path.
export async function reserveProviderReply(): Promise<boolean> {
  try {
    const client = await createClient()
    const { data: { user }, error } = await client.auth.getUser()
    if (error || !user) return false
    const result = await client.rpc("consume_chat_allowance")
    return !result.error && result.data === true
  } catch {
    return false
  }
}
