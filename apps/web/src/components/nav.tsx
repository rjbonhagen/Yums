import Link from "next/link"
import { AuthStatus } from "@/components/auth-status"

export function Nav() {
  return (
    <header className="border-b">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-semibold">
            Yums
          </Link>
        </div>
        <div className="flex gap-4 text-sm">
          <Link href="/start" className="text-muted-foreground hover:text-foreground">
            Build My Week
          </Link>
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
            Dashboard
          </Link>
          <Link href="/feed" className="text-muted-foreground hover:text-foreground">
            Feed
          </Link>
          <Link href="/saved" className="text-muted-foreground hover:text-foreground">
            Saved
          </Link>
          <AuthStatus />
        </div>
      </nav>
    </header>
  )
}
