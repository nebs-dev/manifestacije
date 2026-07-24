"use client"

import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import type { PublicPartner } from "@/lib/public-api"
import {
  createInitialSwapState,
  getRandomSwapInterval,
  isSwapAllowed,
  shouldRenderStatic,
  swapOnce,
  type SwapState,
} from "./partner-swap-logic"

const MAX_VISIBLE_SLOTS = 6

const SWAP_TRANSITION = {
  duration: 0.5,
  ease: [0.22, 1, 0.36, 1] as const,
}

// index 0-2: visible on mobile+; index 3: visible from tablet (sm)+; index 4-5: desktop (lg)+ only.
function slotVisibilityClass(slotIndex: number): string {
  if (slotIndex < 3) return "flex"
  if (slotIndex < 4) return "hidden sm:flex"
  return "hidden lg:flex"
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduced(query.matches)
    const listener = (e: MediaQueryListEvent) => setReduced(e.matches)
    query.addEventListener("change", listener)
    return () => query.removeEventListener("change", listener)
  }, [])

  return reduced
}

function PartnerLogo({ partner }: { partner: PublicPartner }) {
  return (
    <a
      href={partner.websiteUrl ?? undefined}
      target={partner.websiteUrl ? "_blank" : undefined}
      rel={partner.websiteUrl ? "noopener noreferrer" : undefined}
      className="flex h-full w-full items-center justify-center"
    >
      <Image
        src={partner.logoUrl}
        alt={partner.name}
        width={200}
        height={80}
        className="h-16 w-auto object-contain md:h-20"
      />
    </a>
  )
}

export function RandomSwapPartnerStrip({ partners }: { partners: PublicPartner[] }) {
  const isStatic = shouldRenderStatic(partners.length, MAX_VISIBLE_SLOTS)
  const reducedMotion = usePrefersReducedMotion()

  const [state, setState] = useState<SwapState>(() => createInitialSwapState(partners, MAX_VISIBLE_SLOTS))
  const [paused, setPaused] = useState(false)

  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const reducedMotionRef = useRef(reducedMotion)
  reducedMotionRef.current = reducedMotion
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleNext = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      if (
        isSwapAllowed({
          reducedMotion: reducedMotionRef.current,
          paused: pausedRef.current,
          hasEnoughPartners: !isStatic,
        })
      ) {
        setState((prev) => swapOnce(prev))
      }
      scheduleNext()
    }, getRandomSwapInterval())
  }, [isStatic])

  useEffect(() => {
    if (isStatic || reducedMotion) return
    scheduleNext()
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [isStatic, reducedMotion, scheduleNext])

  if (isStatic || reducedMotion) {
    return (
      <div className="grid grid-cols-3 items-center gap-8 sm:grid-cols-4 lg:grid-cols-6">
        {partners.slice(0, MAX_VISIBLE_SLOTS).map((p, slotIndex) => (
          <div key={p.id} className={`relative h-16 items-center justify-center md:h-20 ${slotVisibilityClass(slotIndex)}`}>
            <PartnerLogo partner={p} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      className="grid grid-cols-3 items-center gap-8 sm:grid-cols-4 lg:grid-cols-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {state.visible.map((partner, slotIndex) => (
        <div
          key={slotIndex}
          className={`relative h-16 items-center justify-center overflow-hidden md:h-20 ${slotVisibilityClass(slotIndex)}`}
        >
          <AnimatePresence initial={false}>
            <motion.div
              key={partner.id}
              initial={{ y: "100%", opacity: 1 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "-100%", opacity: 1 }}
              transition={SWAP_TRANSITION}
              className="absolute inset-0 flex items-center justify-center"
            >
              <PartnerLogo partner={partner} />
            </motion.div>
          </AnimatePresence>
        </div>
      ))}
    </div>
  )
}
