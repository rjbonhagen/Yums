import Link from "next/link"

export function Nav() {
  return (
    <header className="border-b">
      <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold">
          CampusSaver
        </Link>
        <div className="flex gap-4 text-sm">
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
