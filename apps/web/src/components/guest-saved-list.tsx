"use client"
import { useGuestSavedItems } from "@/lib/guest-saved-items"
import { SavedList } from "./saved-list"

export function GuestSavedList() {
  const items = useGuestSavedItems()
  return <><p className="text-muted-foreground text-sm">Saved in this browser only. Sample listings remain labeled as examples.</p><SavedList key={items.map((item) => item.id).join("|")} userId="" guest initialItems={items} /></>
}
