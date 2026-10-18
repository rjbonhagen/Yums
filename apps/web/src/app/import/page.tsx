import Link from "next/link"
import { notFound } from "next/navigation"
import { localImportsEnabled } from "@/lib/local-imports"
import { LocalCalLinkImport } from "@/components/local-callink-import"

export const dynamic = "force-dynamic"

export default function ImportPage() {
  if (!localImportsEnabled()) notFound()
  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-primary text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-5">
          <Link href="/" className="text-4xl font-bold tracking-[-3px]">yums</Link>
          <Link href="/" className="text-sm underline underline-offset-4">Back to the food feed</Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl space-y-7 px-5 py-9">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-primary">Personal preview · This browser tab only</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your Cal Link events</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">Sign into Cal Link on Berkeley’s website, open an event, and choose iCal/Outlook. Bring that calendar file here to review it. Imported events stay in this tab and are never added to the public feed or your account saves.</p>
        </div>
        <LocalCalLinkImport />
      </main>
    </div>
  )
}
