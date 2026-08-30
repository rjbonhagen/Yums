"use client"

import { useEffect, useRef, useState } from "react"
import type { Recommendation } from "@yums/shared"
import { Button } from "@/components/ui/button"

const STORAGE_KEY = "yums.notifications-enabled"
const LEAD_TIME_MS = 20 * 60 * 1000 // notify ~20 min before an event's real startTime
const MAX_SCHEDULE_AHEAD_MS = 24 * 60 * 60 * 1000 // don't schedule further out than a day

/**
 * Client-side-only reminders — schedules a browser Notification ~20 min
 * before each upcoming free-food event's real startTime, via setTimeout
 * while this tab stays open. This is NOT push notifications: there's no
 * service worker or backend subscription (that would need VAPID keys and
 * a subscriptions table this app doesn't have), so closing the tab
 * cancels any pending reminders — the UI says so explicitly rather than
 * implying background delivery that doesn't exist.
 */
export function NotificationToggle({ freeFoodEvents }: { freeFoodEvents: Recommendation[] }) {
  const [enabled, setEnabled] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default")
  const timerIds = useRef<number[]>([])

  useEffect(() => {
    if (typeof Notification === "undefined") {
      setPermission("unsupported")
      return
    }
    setPermission(Notification.permission)
    setEnabled(Notification.permission === "granted" && localStorage.getItem(STORAGE_KEY) === "true")
  }, [])

  useEffect(() => {
    timerIds.current.forEach((id) => window.clearTimeout(id))
    timerIds.current = []
    if (!enabled) return

    const now = Date.now()
    for (const event of freeFoodEvents) {
      if (!event.startTime) continue
      const notifyAt = new Date(event.startTime).getTime() - LEAD_TIME_MS
      const delay = notifyAt - now
      // Already inside the lead window (or past) — don't fire immediately
      // for something that isn't actually "starting soon" from now, and
      // don't schedule unreasonably far ahead either.
      if (delay <= 0 || delay > MAX_SCHEDULE_AHEAD_MS) continue

      const id = window.setTimeout(() => {
        new Notification(`Starting soon: ${event.title}`, {
          body: event.subtitle ? `${event.subtitle} · ~20 min` : "~20 min",
        })
      }, delay)
      timerIds.current.push(id)
    }

    return () => {
      timerIds.current.forEach((id) => window.clearTimeout(id))
      timerIds.current = []
    }
  }, [enabled, freeFoodEvents])

  async function handleToggle() {
    if (permission === "unsupported") return

    if (enabled) {
      localStorage.setItem(STORAGE_KEY, "false")
      setEnabled(false)
      return
    }

    let perm = Notification.permission
    if (perm === "default") perm = await Notification.requestPermission()
    setPermission(perm)
    if (perm !== "granted") return

    localStorage.setItem(STORAGE_KEY, "true")
    setEnabled(true)
  }

  if (permission === "unsupported") return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant={enabled ? "default" : "outline"} onClick={handleToggle}>
        {enabled ? "🔔 Reminders on" : "🔕 Remind me before free food"}
      </Button>
      {permission === "denied" && (
        <p className="text-muted-foreground text-xs">
          Notifications are blocked — enable them in your browser&apos;s site settings to use this.
        </p>
      )}
      {enabled && (
        <p className="text-muted-foreground text-xs">Only while this tab stays open — no background push yet.</p>
      )}
    </div>
  )
}
