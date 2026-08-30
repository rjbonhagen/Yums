import Link from "next/link"
import { Nav } from "@/components/nav"
import { SavedList } from "@/components/saved-list"
import { isSupabaseConfigured } from "@/lib/supabase/client"
import { createClient } from "@/lib/supabase/server"
import { loadSavedItems } from "@/lib/saved-items"

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-3 px-4 py-8">
        <h1 className="text-2xl font-semibold">Saved</h1>
        {children}
      </main>
    </div>
  )
}

export default async function SavedPage() {
  if (!isSupabaseConfigured()) {
    return (
      <Shell>
        <p className="text-muted-foreground text-sm">
          Saving isn&apos;t configured on this deployment (no Supabase project connected) — see
          apps/web/.env.example.
        </p>
      </Shell>
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <Shell>
        <p className="text-muted-foreground text-sm">
          <Link href="/login" className="underline underline-offset-4">
            Sign in
          </Link>{" "}
          to save free food events and nearby eats from the{" "}
          <Link href="/feed" className="underline underline-offset-4">
            feed
          </Link>
          .
        </p>
      </Shell>
    )
  }

  const items = await loadSavedItems(supabase, user.id)

  return (
    <Shell>
      <p className="text-muted-foreground mb-2 text-sm">
        Items you&apos;ve saved from the{" "}
        <Link href="/feed" className="underline underline-offset-4">
          feed
        </Link>
        .
      </p>
      <SavedList userId={user.id} initialItems={items} />
    </Shell>
  )
}
