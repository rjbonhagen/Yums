"use client"

import { useState, type ReactNode } from "react"
import Image from "next/image"
import { Utensils } from "lucide-react"

function foodPhoto(text: string): string {
  if (/pizza/i.test(text)) return "photo-1513104890138-7c749659a591"
  if (/boba|bubble tea/i.test(text)) return "photo-1558857563-b371033873b8"
  if (/coffee|cafe|café/i.test(text)) return "photo-1495474472287-4d71bcdd2085"
  if (/bagel|bread|pastr/i.test(text)) return "photo-1509440159596-0249088772ff"
  return "photo-1504674900247-0877df9cc836"
}

export function FoodPhoto({ text, time, children }: { text: string; time?: string; children?: ReactNode }) {
  const [unavailable, setUnavailable] = useState(false)
  return (
    <div className="relative h-48 overflow-hidden bg-secondary sm:h-44">
      <div className="absolute inset-0 grid place-items-center text-primary/40" aria-hidden="true"><Utensils size={44} strokeWidth={1.3} /></div>
      {!unavailable && <Image src={`https://images.unsplash.com/${foodPhoto(text)}?auto=format&fit=crop&w=800&q=85`}
        alt="" fill sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 360px"
        className="object-cover" onError={() => setUnavailable(true)} />}
      {!unavailable && <span className="absolute bottom-2 left-3 rounded bg-black/65 px-1.5 py-0.5 text-[10px] text-white">Illustrative photo</span>}
      {time && <p className="absolute left-3 top-3 max-w-[calc(100%_-_72px)] rounded-md bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-foreground">{time}</p>}
      {children}
    </div>
  )
}
