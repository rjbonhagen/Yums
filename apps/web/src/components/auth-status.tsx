"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"

/** Sign-in/sign-out control for Nav. Still links to /login when Supabase
 * isn't configured — that page shows its own honest "not configured"
 * message rather than a broken form, so hiding the link entirely would
 * just make /login unreachable without a reason. */
export function AuthStatus() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null | undefined>(undefined)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    let active = true
    let sessionChanged = false
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (active && !sessionChanged) setEmail(user?.email ?? null)
    }).catch(() => { if (active && !sessionChanged) setEmail(null) })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      sessionChanged = true
      setEmail(session?.user.email ?? null)
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") router.refresh()
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [router])

  if (!isSupabaseConfigured()) {
    return (
      <Link href="/login" className="text-muted-foreground hover:text-foreground">
        Sign in
      </Link>
    )
  }

  if (email === undefined) return null

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
        disabled={signingOut}
        onClick={async () => {
          setSigningOut(true)
          setError(null)
          try {
            const { error: authError } = await createClient().auth.signOut()
            if (authError) throw authError
            setEmail(null)
            router.push("/")
            router.refresh()
          } catch {
            setError("Couldn't sign out. Try again.")
          } finally { setSigningOut(false) }
        }}
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
      {error && <span role="alert" className="text-destructive text-xs">{error}</span>}
    </div>
  )
}
