"use client"
import { useMemo, useSyncExternalStore } from "react"
import type { Recommendation } from "@yums/shared"
import type { SavedItem } from "./saved-items"
import { savedKey } from "./save-identity"

const KEY = "yums.saved-items"
const CHANGE = "yums:saved-items"
function snapshot() {
  try { return localStorage.getItem(KEY) ?? "[]" } catch { return "[]" }
}
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener)
  window.addEventListener(CHANGE, listener)
  return () => { window.removeEventListener("storage", listener); window.removeEventListener(CHANGE, listener) }
}
export function loadGuestSavedItems(): SavedItem[] {
  return parse(snapshot())
}
function parse(raw: string): SavedItem[] {
  try {
    const items: unknown = JSON.parse(raw)
    if (!Array.isArray(items)) return []
    return items.filter((item): item is SavedItem => item && typeof item.id === "string" && typeof item.title === "string" && ["free_food", "nearby_eats"].includes(item.kind) && (!item.startTime || Number.isFinite(Date.parse(item.startTime))))
  } catch { return [] }
}
function write(items: SavedItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items))
  window.dispatchEvent(new Event(CHANGE))
}
export function saveGuestItem(item: Recommendation) {
  const items = loadGuestSavedItems()
  const key = savedKey(item)
  if (items.some((saved) => savedKey(saved) === key)) return
  write([{ ...item, id: `guest:${key}`, kind: item.kind as SavedItem["kind"] }, ...items])
}
export function removeGuestItem(id: string) { write(loadGuestSavedItems().filter((item) => item.id !== id)) }
export function useGuestSavedItems() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]")
  return useMemo(() => parse(raw), [raw])
}
