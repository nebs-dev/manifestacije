import type { PublicPartner } from "@/lib/public-api"

export const MIN_SWAP_INTERVAL_MS = 1800
export const MAX_SWAP_INTERVAL_MS = 3200

export type SwapState = {
  visible: PublicPartner[]
  // FIFO queue of hidden partners — front is next to enter, leaving partners go to the back.
  // This guarantees fairness: nobody waits forever, nobody reappears before everyone
  // else waiting has had a turn.
  waiting: PublicPartner[]
  // Shuffled slot indices remaining in the current round. Emptied and reshuffled once
  // every slot has swapped exactly once, so no slot can go a full round without changing
  // and no slot can change twice before the others have had their turn.
  slotOrder: number[]
  lastSlotIndex: number | null
}

export function getRandomSwapInterval(random: () => number = Math.random): number {
  return Math.floor(random() * (MAX_SWAP_INTERVAL_MS - MIN_SWAP_INTERVAL_MS + 1)) + MIN_SWAP_INTERVAL_MS
}

export function shouldRenderStatic(partnerCount: number, maxVisibleSlots: number): boolean {
  return partnerCount <= maxVisibleSlots
}

export function isSwapAllowed(opts: { reducedMotion: boolean; paused: boolean; hasEnoughPartners: boolean }): boolean {
  return !opts.reducedMotion && !opts.paused && opts.hasEnoughPartners
}

export function createInitialSwapState(partners: PublicPartner[], maxVisibleSlots: number): SwapState {
  const visible = partners.slice(0, maxVisibleSlots)
  const visibleIds = new Set(visible.map((p) => p.id))
  const waiting = partners.filter((p) => !visibleIds.has(p.id))
  return { visible, waiting, slotOrder: [], lastSlotIndex: null }
}

// Fisher-Yates shuffle of [0..slotCount-1]. When avoidFirst is set (the slot that just
// swapped, at a round boundary), swaps it out of first position so the same slot can't
// animate twice back-to-back across rounds.
export function shuffledSlotOrder(slotCount: number, avoidFirst: number | null, random: () => number = Math.random): number[] {
  const order = Array.from({ length: slotCount }, (_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  if (avoidFirst !== null && order.length > 1 && order[0] === avoidFirst) {
    const j = 1 + Math.floor(random() * (order.length - 1))
    ;[order[0], order[j]] = [order[j], order[0]]
  }
  return order
}

// Runs one swap cycle: pulls the next slot from the current round's shuffled order
// (starting a new round if the previous one is exhausted), swaps in the
// longest-waiting hidden partner, and sends the outgoing partner to the back of the
// waiting queue.
export function swapOnce(state: SwapState, random: () => number = Math.random): SwapState {
  const slotCount = state.visible.length
  if (slotCount === 0 || state.waiting.length === 0) return state

  const slotOrder = state.slotOrder.length > 0 ? state.slotOrder : shuffledSlotOrder(slotCount, state.lastSlotIndex, random)
  const [slotIndex, ...restSlotOrder] = slotOrder

  const leaving = state.visible[slotIndex]
  const [incoming, ...restWaiting] = state.waiting

  const nextVisible = state.visible.slice()
  nextVisible[slotIndex] = incoming

  return {
    visible: nextVisible,
    waiting: [...restWaiting, leaving],
    slotOrder: restSlotOrder,
    lastSlotIndex: slotIndex,
  }
}
