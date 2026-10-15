import Link from "next/link"
import { AuthStatus } from "@/components/auth-status"

export function Nav() {
  return (
    <header className="border-b bg-background">
      <nav aria-label="Main navigation" className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-2xl font-semibold tracking-tight text-primary">
            Yums
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 text-sm">
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            Feed
          </Link>
          <Link href="/saved" className="text-muted-foreground hover:text-foreground">
            Saved
          </Link>
          <Link href="/report" className="font-medium text-primary hover:underline">
            Share food
          </Link>
          <AuthStatus />
        </div>
      </nav>
    </header>
  )
}
