import Link from "next/link"
import { AuthStatus } from "@/components/auth-status"

export function Nav({ tone = "light", active }: { tone?: "light" | "teal"; active?: "discover" | "saved" | "share" }) {
  const teal = tone === "teal"
  const navLink = "border-b-2 border-transparent py-2 transition-colors hover:border-current aria-[current=page]:border-current"
  return (
    <header className={teal ? "bg-primary text-white" : "border-b bg-background text-primary"}>
      <nav aria-label="Main navigation" className="mx-auto flex w-full max-w-[1184px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <Link href="/" aria-label="Yums home" className="text-[38px] font-bold leading-none tracking-[-3px] sm:text-[42px]">
            yums
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] sm:gap-x-7 sm:text-sm">
          <Link href="/" className={navLink} aria-current={active === "discover" ? "page" : undefined}>
            Discover
          </Link>
          <Link href="/saved" className={navLink} aria-current={active === "saved" ? "page" : undefined}>
            Saved
          </Link>
          <Link href="/report" aria-current={active === "share" ? "page" : undefined}
            className={`rounded-full px-4 py-2.5 font-semibold sm:px-5 ${teal ? "bg-white text-primary hover:bg-accent" : "bg-primary text-white hover:bg-primary/90"}`}>
            Share free food
          </Link>
          <div className={teal ? "flex items-center [&_a]:text-white/85 [&_button]:text-white/85 [&_a]:hover:text-white [&_button]:hover:text-white" : "flex items-center"}>
            <AuthStatus />
          </div>
        </div>
      </nav>
    </header>
  )
}
