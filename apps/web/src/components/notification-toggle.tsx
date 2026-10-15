"use client"

import { useEffect, useRef, useSyncExternalStore } from "react"
import type { Recommendation } from "@yums/shared"
import { Button } from "@/components/ui/button"

const STORAGE_KEY = "yums.notifications-enabled"
const LEAD_TIME_MS = 20 * 60 * 1000 // notify ~20 min before an event's real startTime
const MAX_SCHEDULE_AHEAD_MS = 24 * 60 * 60 * 1000 // don't schedule further out than a day
const CHANGE_EVENT = "yums:notification-settings"

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange)
  window.addEventListener("focus", onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener("focus", onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

function getSnapshot() {
  if (typeof Notification === "undefined") return "unsupported:false"
  let enabled = false
  try {
    enabled = Notification.permission === "granted" && localStorage.getItem(STORAGE_KEY) === "true"
  } catch { /* Reminders remain off when browser storage is unavailable. */ }
  return `${Notification.permission}:${enabled}`
}

function getServerSnapshot() { return "unsupported:false" }

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
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [permission, enabledValue] = settings.split(":")
  const enabled = enabledValue === "true"
  const timerIds = useRef<number[]>([])

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
      window.dispatchEvent(new Event(CHANGE_EVENT))
      return
    }

    let perm = Notification.permission
    if (perm === "default") perm = await Notification.requestPermission()
    if (perm !== "granted") {
      window.dispatchEvent(new Event(CHANGE_EVENT))
      return
    }

    localStorage.setItem(STORAGE_KEY, "true")
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }

  if (permission === "unsupported") return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant={enabled ? "default" : "outline"} onClick={handleToggle}>
        {enabled ? "Reminders on" : "Remind me before free food"}
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
