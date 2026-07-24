import { describe, expect, it } from "vitest"
import type { PublicPartner } from "@/lib/public-api"
import {
  MAX_SWAP_INTERVAL_MS,
  MIN_SWAP_INTERVAL_MS,
  createInitialSwapState,
  getRandomSwapInterval,
  isSwapAllowed,
  shouldRenderStatic,
  shuffledSlotOrder,
  swapOnce,
  type SwapState,
} from "./partner-swap-logic"

function partner(id: number): PublicPartner {
  return { id, name: `Partner ${id}`, logoUrl: `/logo-${id}.png`, websiteUrl: null, sortOrder: id }
}

describe("getRandomSwapInterval", () => {
  it("stays within the 1800-3200ms range", () => {
    for (let i = 0; i < 200; i++) {
      const ms = getRandomSwapInterval(Math.random)
      expect(ms).toBeGreaterThanOrEqual(MIN_SWAP_INTERVAL_MS)
      expect(ms).toBeLessThanOrEqual(MAX_SWAP_INTERVAL_MS)
    }
  })
})

describe("shouldRenderStatic", () => {
  it("is true when partner count is at or below the visible slot count", () => {
    expect(shouldRenderStatic(4, 6)).toBe(true)
    expect(shouldRenderStatic(6, 6)).toBe(true)
  })

  it("is false when there are more partners than slots", () => {
    expect(shouldRenderStatic(7, 6)).toBe(false)
  })
})

describe("isSwapAllowed", () => {
  it("disallows swapping when reduced motion is preferred", () => {
    expect(isSwapAllowed({ reducedMotion: true, paused: false, hasEnoughPartners: true })).toBe(false)
  })

  it("disallows swapping while paused (hover/focus)", () => {
    expect(isSwapAllowed({ reducedMotion: false, paused: true, hasEnoughPartners: true })).toBe(false)
  })

  it("disallows swapping when there aren't enough partners", () => {
    expect(isSwapAllowed({ reducedMotion: false, paused: false, hasEnoughPartners: false })).toBe(false)
  })

  it("allows swapping only when every condition is satisfied", () => {
    expect(isSwapAllowed({ reducedMotion: false, paused: false, hasEnoughPartners: true })).toBe(true)
  })
})

describe("createInitialSwapState", () => {
  const all = [1, 2, 3, 4, 5, 6, 7, 8].map(partner)

  it("puts the first N by order in visible slots, the rest in the waiting queue", () => {
    const state = createInitialSwapState(all, 6)
    expect(state.visible.map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 6])
    expect(state.waiting.map((p) => p.id)).toEqual([7, 8])
  })

  it("never puts the same partner in both visible and waiting", () => {
    const state = createInitialSwapState(all, 6)
    const visibleIds = new Set(state.visible.map((p) => p.id))
    expect(state.waiting.some((p) => visibleIds.has(p.id))).toBe(false)
  })
})

describe("shuffledSlotOrder", () => {
  it("returns a permutation of every slot index exactly once", () => {
    for (let i = 0; i < 50; i++) {
      const order = shuffledSlotOrder(6, null, Math.random)
      expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5])
    }
  })

  it("avoids placing the previous slot first when alternatives exist", () => {
    for (let i = 0; i < 50; i++) {
      const order = shuffledSlotOrder(6, 2, Math.random)
      expect(order[0]).not.toBe(2)
    }
  })

  it("falls back to the only slot when there is a single slot, even if it was just used", () => {
    expect(shuffledSlotOrder(1, 0, Math.random)).toEqual([0])
  })
})

describe("swapOnce", () => {
  const all = [1, 2, 3, 4, 5, 6, 7, 8].map(partner)

  it("changes exactly one slot per cycle", () => {
    const state = createInitialSwapState(all, 6)
    const next = swapOnce(state, Math.random)
    const changed = next.visible.filter((p, i) => p.id !== state.visible[i].id)
    expect(changed.length).toBe(1)
  })

  it("never produces duplicate visible partners across many cycles", () => {
    let state = createInitialSwapState(all, 6)
    for (let i = 0; i < 200; i++) {
      state = swapOnce(state, Math.random)
      const ids = state.visible.map((p) => p.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it("sends the outgoing partner to the back of the waiting queue (never immediately reappears)", () => {
    let state = createInitialSwapState(all, 6)
    for (let i = 0; i < 50; i++) {
      const before = state
      state = swapOnce(state, Math.random)
      const leftId = before.visible.find((p) => !state.visible.some((v) => v.id === p.id))?.id
      if (leftId !== undefined) {
        // the partner that just left must not be the very next one shown
        const enteredId = state.visible.find((p) => !before.visible.some((v) => v.id === p.id))?.id
        expect(enteredId).not.toBe(leftId)
      }
    }
  })

  it("every slot swaps exactly once per round (no slot idle for a full round, none repeats within it)", () => {
    let state: SwapState = createInitialSwapState(all, 6)
    const slotHits: number[] = []
    for (let i = 0; i < 6; i++) {
      const before = state
      state = swapOnce(state, Math.random)
      const changedIndex = state.visible.findIndex((p, idx) => p.id !== before.visible[idx].id)
      slotHits.push(changedIndex)
    }
    expect([...slotHits].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it("never repeats the same slot twice in a row across round boundaries", () => {
    let state: SwapState = createInitialSwapState(all, 6)
    let lastSlot: number | null = null
    for (let i = 0; i < 300; i++) {
      const before = state
      state = swapOnce(state, Math.random)
      const changedIndex = state.visible.findIndex((p, idx) => p.id !== before.visible[idx].id)
      expect(changedIndex).not.toBe(lastSlot)
      lastSlot = changedIndex
    }
  })

  it("always shows the longest-waiting partner next (strict FIFO — bounds worst-case wait)", () => {
    let state: SwapState = createInitialSwapState(all, 6)
    for (let i = 0; i < 100; i++) {
      const before = state
      const expectedNextId = before.waiting[0]?.id
      state = swapOnce(state, Math.random)
      if (expectedNextId !== undefined) {
        const entered = state.visible.find((p) => !before.visible.some((v) => v.id === p.id))
        expect(entered?.id).toBe(expectedNextId)
      }
    }
  })

  it("is a no-op once the waiting queue is empty (partner count == slot count)", () => {
    const state = createInitialSwapState(all.slice(0, 6), 6)
    expect(state.waiting.length).toBe(0)
    const next = swapOnce(state, Math.random)
    expect(next.visible.map((p) => p.id)).toEqual(state.visible.map((p) => p.id))
  })
})
