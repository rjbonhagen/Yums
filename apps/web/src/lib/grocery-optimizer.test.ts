import { describe, expect, it } from "vitest"
import { optimizeGroceryList, cheapestSingleStorePlan } from "./grocery-optimizer"
import type { GroceryProduct } from "@yums/shared"

const catalog: GroceryProduct[] = [
  { id: "1", storeName: "Target", name: "Eggs (dozen)", price: 3.5 },
  { id: "2", storeName: "Safeway", name: "Eggs (dozen)", price: 4.2 },
  { id: "3", storeName: "Target", name: "Bananas", price: 0.6 },
  { id: "4", storeName: "Trader Joe's", name: "Bananas", price: 0.25 },
  { id: "5", storeName: "Safeway", name: "Chicken breast", price: 6.0 },
  // Only Target and Safeway carry every item in the default test basket;
  // Trader Joe's is missing chicken, so it should never win the
  // single-store comparison for a basket that needs it.
]

describe("optimizeGroceryList", () => {
  it("picks the cheapest match for each item across all stores", () => {
    const plan = optimizeGroceryList(["Eggs", "Bananas"], catalog)
    expect(plan.totalCost).toBeCloseTo(3.5 + 0.25, 10) // Target eggs + Trader Joe's bananas
    expect(plan.itemsByStore["Target"].map((i) => i.name)).toEqual(["Eggs (dozen)"])
    expect(plan.itemsByStore["Trader Joe's"].map((i) => i.name)).toEqual(["Bananas"])
    expect(plan.storeCount).toBe(2)
  })

  it("silently skips a requested item with no catalog match rather than erroring", () => {
    const plan = optimizeGroceryList(["Eggs", "Nonexistent Item"], catalog)
    expect(plan.totalCost).toBeCloseTo(3.5, 10)
    expect(Object.values(plan.itemsByStore).flat()).toHaveLength(1)
  })

  it("matches item names case-insensitively and by substring", () => {
    const plan = optimizeGroceryList(["eggs"], catalog)
    expect(plan.totalCost).toBeCloseTo(3.5, 10)
  })

  it("returns an empty plan for an empty shopping list", () => {
    const plan = optimizeGroceryList([], catalog)
    expect(plan.totalCost).toBe(0)
    expect(plan.storeCount).toBe(0)
  })
})

describe("cheapestSingleStorePlan", () => {
  it("picks the cheapest store that carries every requested item", () => {
    const plan = cheapestSingleStorePlan(["Eggs", "Bananas"], catalog)
    // Target: 3.5 + 0.6 = 4.1; Safeway: 4.2 (no bananas -> excluded);
    // Trader Joe's: no eggs -> excluded. Only Target qualifies.
    expect(plan).not.toBeNull()
    expect(plan!.storeName).toBe("Target")
    expect(plan!.totalCost).toBeCloseTo(4.1, 10)
  })

  it("excludes a store that's missing any requested item, even if partially cheaper", () => {
    const plan = cheapestSingleStorePlan(["Eggs", "Bananas", "Chicken breast"], catalog)
    // No single store carries all three (Target/TJ's lack chicken, Safeway
    // lacks bananas) - correctly returns null rather than a partial basket.
    expect(plan).toBeNull()
  })

  it("returns null when no store carries every item", () => {
    const plan = cheapestSingleStorePlan(["Truffle Oil"], catalog)
    expect(plan).toBeNull()
  })
})
