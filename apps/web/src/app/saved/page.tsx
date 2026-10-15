import Link from "next/link"
import { isAuthSessionMissingError } from "@supabase/supabase-js"
import { Nav } from "@/components/nav"
import { SavedList } from "@/components/saved-list"
import { GuestSavedList } from "@/components/guest-saved-list"
import { isSupabaseConfigured } from "@/lib/supabase/client"
import { createClient } from "@/lib/supabase/server"
import { loadSavedItems } from "@/lib/saved-items"

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-5 px-5 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Saved food</h1>
        {children}
      </main>
    </div>
  )
}

export default async function SavedPage() {
  if (!isSupabaseConfigured()) {
    return (
      <Shell>
        <GuestSavedList />
      </Shell>
    )
  }

  const account = await (async () => {
    const client = await createClient()
    const { data: { user }, error } = await client.auth.getUser()
    if (error && !isAuthSessionMissingError(error)) throw error
    return { client, user }
  })().catch(() => null)
  if (!account) {
    return <Shell><p role="status" className="text-muted-foreground text-sm">Couldn&apos;t check your account. Account saves are unavailable; refresh to retry.</p><GuestSavedList /></Shell>
  }
  const { client: supabase, user } = account

  if (!user) {
    return (
      <Shell>
        <p className="text-muted-foreground text-sm">
          <Link href="/login" className="underline underline-offset-4">
            Sign in
          </Link>{" "}
          to sync saves across devices. Browse the{" "}
          <Link href="/feed" className="underline underline-offset-4">
            feed
          </Link>
          .
        </p>
        <GuestSavedList />
      </Shell>
    )
  }

  const items = await loadSavedItems(supabase, user.id).catch(() => null)

  return (
    <Shell>
      <p className="text-muted-foreground mb-2 text-sm">
        Items you&apos;ve saved from the{" "}
        <Link href="/feed" className="underline underline-offset-4">
          feed
        </Link>
        .
      </p>
      {items ? <SavedList userId={user.id} initialItems={items.filter((item) => item.kind === "free_food")} /> : <p role="status" className="text-muted-foreground text-sm">Couldn&apos;t load your account saves. Refresh to try again.</p>}
      <h2 className="text-lg font-semibold">Browser-only saves</h2>
      <GuestSavedList />
    </Shell>
  )
}
