"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FoodPhoto } from "@/components/food-photo"
import { formatEventDateTime } from "@/lib/format"
import { createClient } from "@/lib/supabase/client"
import { deleteReportedEvent, type ReportedEvent } from "@/lib/reported-events"

/** Community tips keep their review status separate from campus listings. */
export function CommunityReports({ userId, reports }: { userId: string | null; reports: ReportedEvent[] }) {
  const [items, setItems] = useState(reports)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleRemove(id: string) {
    if (!userId) return
    setError(null)
    const removed = items.find((i) => i.id === id)
    setItems((prev) => prev.filter((i) => i.id !== id))
    setRemovingId(id)
    try {
      await deleteReportedEvent(createClient(), userId, id)
    } catch {
      if (removed) setItems((prev) => [...prev, removed]) // revert — don't lose the report on a failed delete
      setError("Couldn't remove this report. Try again.")
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">Community reports</h2>
          <Badge
            variant="outline"
            className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400"
          >
            Unverified — user-submitted
          </Badge>
        </div>
        <Link href="/report" className="text-primary text-sm underline underline-offset-4">
          Share food
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">Student tips for the next seven days. Check the source before heading out.</p>
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">No community reports right now.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">{items.map((item) => (
          <article key={item.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <FoodPhoto text={`${item.title} ${item.description ?? ""}`} time={formatEventDateTime(item.startTime)} />
            <div className="space-y-2 p-4 sm:p-[18px]">
                <p className="text-xs text-muted-foreground">Community tip · Unverified</p>
                <h3 className="text-lg font-semibold leading-snug tracking-tight">{item.title}</h3>
                {item.moderationStatus !== "approved" && (
                  <p className="text-muted-foreground text-xs">
                    {item.moderationStatus === "pending" ? "Awaiting review · visible only to you" : "Not approved · visible only to you"}
                  </p>
                )}
                {item.locationName && <p className="text-muted-foreground text-sm">{item.locationName}</p>}
                {item.description && <p className="text-muted-foreground text-xs">{item.description}</p>}
              <div className="flex min-h-10 items-center justify-between gap-3 border-t pt-2">
                {item.sourceUrl && (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2 text-xs text-primary underline underline-offset-4"
                  >
                    Source
                  </a>
                )}
              {userId === item.userId && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="ml-auto min-h-10 px-3 text-xs"
                  disabled={removingId === item.id}
                  onClick={() => handleRemove(item.id)}
                >
                  Remove
                </Button>
              )}
              </div>
            </div>
          </article>
        ))}</div>
      )}
    </div>
  )
}
