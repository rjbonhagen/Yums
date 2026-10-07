"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatEventDateTime } from "@/lib/format"
import { createClient } from "@/lib/supabase/client"
import { unsaveItem, type SavedItem } from "@/lib/saved-items"
import { removeGuestItem } from "@/lib/guest-saved-items"
import { eventEnd } from "@/lib/event-time"

/** Client component so items can be removed in place, without a full page
 * reload — /saved's server component just fetches the initial list and
 * hands it here. userId is passed down rather than re-derived client-side
 * since the server component already has it from the same session. */
export function SavedList({ userId, initialItems, guest = false }: { userId: string; initialItems: SavedItem[]; guest?: boolean }) {
  const [items, setItems] = useState(initialItems)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleRemove(id: string) {
    setError(null)
    const removed = items.find((i) => i.id === id)
    setItems((prev) => prev.filter((i) => i.id !== id))
    setRemovingId(id)
    try {
      if (guest) removeGuestItem(id)
      else await unsaveItem(createClient(), userId, id)
    } catch {
      if (removed) setItems((prev) => [...prev, removed]) // revert — don't lose the item on a failed delete
      setError("Couldn't remove this item. Try again.")
    } finally {
      setRemovingId(null)
    }
  }

  if (items.length === 0) {
    return <div>{error && <p role="alert">{error}</p>}<p className="text-muted-foreground text-sm">Nothing saved yet — tap Save on any item in the feed.</p></div>
  }

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      {items.map((item) => (
        <Card key={item.id}>
          <CardContent className="flex items-start justify-between gap-4 py-4">
            <div>
              <p className="font-medium">{item.title}</p>
              {item.isSample && <p className="text-xs text-amber-700">Sample listing · not a real offer</p>}
              {item.startTime && eventEnd(item.startTime, item.endTime).date <= new Date() && <p className="text-muted-foreground text-xs">Past event · saved snapshot</p>}
              {item.subtitle && <p className="text-muted-foreground text-sm">{item.subtitle}</p>}
              {item.startTime && <p className="text-muted-foreground text-xs">{formatEventDateTime(item.startTime)}</p>}
              {item.sourceUrl && (
                <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-xs underline underline-offset-4">
                  Source
                </a>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant={item.kind === "free_food" ? "default" : "secondary"}>
                {item.kind === "free_food" ? "FREE" : "Nearby"}
              </Badge>
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
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
