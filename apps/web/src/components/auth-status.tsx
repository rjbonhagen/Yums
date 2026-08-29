"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"

/** Sign-in/sign-out control for Nav — only renders once Supabase is
 * configured, since there's no auth to show otherwise (see /login). */
export function AuthStatus() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setEmail(user?.email ?? null))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => setEmail(session?.user.email ?? null))
    return () => subscription.unsubscribe()
  }, [])

  if (!isSupabaseConfigured() || email === undefined) return null

  if (!email) {
    return (
      <Link href="/login" className="text-muted-foreground hover:text-foreground">
        Sign in
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/login" className="text-muted-foreground hover:text-foreground" title={`Signed in as ${email}`}>
        Account
      </Link>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground"
        onClick={async () => {
          const supabase = createClient()
          await supabase.auth.signOut()
          router.push("/")
          router.refresh()
        }}
      >
        Sign out
      </button>
    </div>
  )
}
