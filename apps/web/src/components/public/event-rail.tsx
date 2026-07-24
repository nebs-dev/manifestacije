"use client"

import { useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { EventCard } from "@/components/public/event-card"
import { buttonVariants } from "@/components/ui/button"
import type { CroEvent } from "@/lib/data"
import { cn } from "@/lib/utils"

export function EventRail({
  events,
  carousel = false,
}: {
  events: CroEvent[]
  carousel?: boolean
}) {
  const railRef = useRef<HTMLDivElement>(null)
  const showControls = carousel && events.length > 3

  function scroll(direction: -1 | 1) {
    const rail = railRef.current
    if (!rail) return
    rail.scrollBy({ left: direction * Math.max(rail.clientWidth * 0.9, 320), behavior: "smooth" })
  }

  return (
    <>
      {showControls && (
        <div className="-mt-3 mb-4 hidden justify-end gap-2 md:flex">
          <button
            type="button"
            aria-label="Prikaži prethodna izdvojena događanja"
            className={buttonVariants({ variant: "outline", size: "icon" })}
            onClick={() => scroll(-1)}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Prikaži sljedeća izdvojena događanja"
            className={buttonVariants({ variant: "outline", size: "icon" })}
            onClick={() => scroll(1)}
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      )}
      <div
        ref={railRef}
        className={cn(
          "-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-6 no-scrollbar",
          carousel
            ? "md:mx-0 md:gap-6 md:px-0"
            : "md:mx-0 md:grid md:grid-cols-3 md:items-stretch md:gap-6 md:overflow-visible md:px-0",
        )}
      >
        {events.map((event, index) => (
          <div
            key={event.slug}
            className={cn(
              "w-[78%] shrink-0 snap-start sm:w-[44%]",
              carousel ? "md:w-[calc((100%_-_3rem)/3)]" : "md:h-full md:w-auto",
            )}
          >
            <EventCard
              event={event}
              priorityImage={index === 0}
              imageSizes="(max-width: 640px) 78vw, (max-width: 768px) 44vw, 33vw"
            />
          </div>
        ))}
      </div>
    </>
  )
}
