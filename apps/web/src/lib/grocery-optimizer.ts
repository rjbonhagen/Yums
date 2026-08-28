import type { GroceryProduct } from "@yums/shared"
import { groceryProducts } from "./mock-data"

export interface OptimizedGroceryPlan {
  itemsByStore: Record<string, GroceryProduct[]>
  totalCost: number
  storeCount: number
}

/**
 * Cheapest-per-item plan across all known stores (may span multiple stores).
 * Deterministic — no LLM. Matches a requested shopping list by product name.
 */
export function optimizeGroceryList(
  wantedItemNames: string[],
  catalog: GroceryProduct[] = groceryProducts,
): OptimizedGroceryPlan {
  const itemsByStore: Record<string, GroceryProduct[]> = {}
  let totalCost = 0

  for (const wanted of wantedItemNames) {
    const matches = catalog.filter((p) => p.name.toLowerCase().includes(wanted.toLowerCase()))
    if (matches.length === 0) continue
    const cheapest = matches.reduce((a, b) => (a.price < b.price ? a : b))
    itemsByStore[cheapest.storeName] ??= []
    itemsByStore[cheapest.storeName].push(cheapest)
    totalCost += cheapest.price
  }

  return { itemsByStore, totalCost, storeCount: Object.keys(itemsByStore).length }
}

/** Single-store alternative, useful for the "one trip vs. cheapest" tradeoff. */
export function cheapestSingleStorePlan(
  wantedItemNames: string[],
  catalog: GroceryProduct[] = groceryProducts,
): { storeName: string; items: GroceryProduct[]; totalCost: number } | null {
  const storeNames = [...new Set(catalog.map((p) => p.storeName))]
  let best: { storeName: string; items: GroceryProduct[]; totalCost: number } | null = null

  for (const storeName of storeNames) {
    const storeCatalog = catalog.filter((p) => p.storeName === storeName)
    const items: GroceryProduct[] = []
    let total = 0
    let missing = false

    for (const wanted of wantedItemNames) {
      const match = storeCatalog.find((p) => p.name.toLowerCase().includes(wanted.toLowerCase()))
      if (!match) {
        missing = true
        break
      }
      items.push(match)
      total += match.price
    }

    if (!missing && (best === null || total < best.totalCost)) {
      best = { storeName, items, totalCost: total }
    }
  }

  return best
}
