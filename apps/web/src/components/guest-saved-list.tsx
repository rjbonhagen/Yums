"use client"
import { useGuestSavedItems } from "@/lib/guest-saved-items"
import { SavedList } from "./saved-list"

export function GuestSavedList() {
  const items = useGuestSavedItems().filter((item) => item.kind === "free_food")
  return <><p className="text-muted-foreground text-sm">Saved on this browser. Sign in to sync new saves across devices.</p><SavedList key={items.map((item) => item.id).join("|")} userId="" guest initialItems={items} /></>
}
