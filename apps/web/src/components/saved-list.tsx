"use client"

import { useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatEventDateTime } from "@/lib/format"
import { createClient } from "@/lib/supabase/client"
import { unsaveItem, type SavedItem } from "@/lib/saved-items"
import { removeGuestItem } from "@/lib/guest-saved-items"

/** Client component so items can be removed in place, without a full page
 * reload — /saved's server component just fetches the initial list and
 * hands it here. userId is passed down rather than re-derived client-side
 * since the server component already has it from the same session. */
type SavedListProps = { userId: string; initialItems: SavedItem[]; guest?: boolean }

export function SavedList(props: SavedListProps) {
  return <SavedListContent key={`${props.userId}:${JSON.stringify(props.initialItems)}`} {...props} />
}

function SavedListContent({ userId, initialItems, guest = false }: SavedListProps) {
  const [items, setItems] = useState(initialItems)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const session = useRef({ active: true, valid: true })
  const pending = useRef(new Set<string>())

  useEffect(() => {
    const tracked = session.current
    tracked.active = true
    if (guest) return () => { tracked.active = false }
    const supabase = createClient()
    function invalidate() {
      tracked.valid = false
      setItems([])
      setError("Your account changed. Refresh to load your saved items.")
    }
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (!tracked.active) return
      if (error) setError("Couldn't check your account. Refresh before removing items.")
      else if (user?.id !== userId) invalidate()
    }).catch(() => {
      if (tracked.active) setError("Couldn't check your account. Refresh before removing items.")
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      if (tracked.active && (event === "SIGNED_IN" || event === "SIGNED_OUT") && next?.user.id !== userId) invalidate()
    })
    return () => { tracked.active = false; subscription.unsubscribe() }
  }, [guest, userId])

  async function handleRemove(id: string) {
    if (!session.current.valid || pending.current.has(id)) return
    pending.current.add(id)
    setError(null)
    const removed = items.find((i) => i.id === id)
    setRemovingId(id)
    const current = () => session.current.active && session.current.valid
    try {
      if (guest) {
        removeGuestItem(id)
        setItems((prev) => prev.filter((i) => i.id !== id))
      } else {
        const supabase = createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (!current()) return
        if (error) throw error
        if (user?.id !== userId) {
          session.current.valid = false
          setItems([])
          setError("Your account changed. Refresh to load your saved items.")
          return
        }
        setItems((prev) => prev.filter((i) => i.id !== id))
        await unsaveItem(supabase, userId, id)
      }
    } catch {
      if (!current()) return
      if (removed) setItems((prev) => prev.some((item) => item.id === id) ? prev : [...prev, removed])
      setError("Couldn't remove this item. Try again.")
    } finally {
      pending.current.delete(id)
      if (current()) setRemovingId(null)
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
              {item.startTime && new Date(item.endTime ?? item.startTime) <= new Date() && <p className="text-muted-foreground text-xs">{item.endTime ? "Past event" : "Start time has passed — check the source"} · saved snapshot</p>}
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
