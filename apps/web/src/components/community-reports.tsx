"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatEventDateTime } from "@/lib/format"
import { createClient } from "@/lib/supabase/client"
import { deleteReportedEvent, type ReportedEvent } from "@/lib/reported-events"

/** /feed's crowdsourced-tips section — deliberately separate from
 * RecommendationsView's scored/ranked list (see reported-events.ts):
 * every item here is explicitly labeled unverified, never blended with
 * the live-sourced free-food/nearby-eats items. */
export function CommunityReports({ userId, reports }: { userId: string | null; reports: ReportedEvent[] }) {
  const [items, setItems] = useState(reports)
  const [removingId, setRemovingId] = useState<string | null>(null)

  async function handleRemove(id: string) {
    if (!userId) return
    const removed = items.find((i) => i.id === id)
    setItems((prev) => prev.filter((i) => i.id !== id))
    setRemovingId(id)
    try {
      await deleteReportedEvent(createClient(), userId, id)
    } catch {
      if (removed) setItems((prev) => [...prev, removed]) // revert — don't lose the report on a failed delete
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Community reports</h2>
          <Badge
            variant="outline"
            className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400"
          >
            Unverified — user-submitted
          </Badge>
        </div>
        <Link href="/report" className="text-primary text-sm underline underline-offset-4">
          + Report free food
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">No community reports right now.</p>
      ) : (
        items.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex items-start justify-between gap-4 py-4">
              <div>
                <p className="font-medium">{item.title}</p>
                {item.locationName && <p className="text-muted-foreground text-sm">{item.locationName}</p>}
                <p className="text-muted-foreground text-xs">{formatEventDateTime(item.startTime)}</p>
                {item.description && <p className="text-muted-foreground text-xs">{item.description}</p>}
                {item.sourceUrl && (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline underline-offset-4"
                  >
                    Source
                  </a>
                )}
              </div>
              {userId === item.userId && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-auto p-0 text-xs"
                  disabled={removingId === item.id}
                  onClick={() => handleRemove(item.id)}
                >
                  Remove
                </Button>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
