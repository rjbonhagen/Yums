import Link from "next/link"
import { Badge } from "@/components/ui/badge"

export function Nav() {
  return (
    <header className="border-b">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-semibold">
            CampusSaver
          </Link>
          <Badge
            variant="outline"
            className="text-muted-foreground border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400"
            title="This demo runs on sample data, not live campus/store feeds. See docs/data-sources.md."
          >
            Demo Mode
          </Badge>
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
        </div>
      </nav>
    </header>
  )
}
