"use client"

import { useCallback, useState, type SyntheticEvent } from "react"

import { EventPoster } from "@/components/public/event-poster"
import { gradientFor } from "@/lib/data"
import { cn } from "@/lib/utils"
import { eventHeroMediaVisibility } from "./event-hero-media-state"

const DETAIL_SIZES = "(max-width: 1023px) 100vw, 768px"

export function EventHeroMedia({
  previewImage,
  detailImage,
  title,
  category,
  className,
}: {
  previewImage?: string
  detailImage?: string
  title: string
  category: string
  className?: string
}) {
  const [detailReady, setDetailReady] = useState(false)
  const { fullImage, previewVisible, detailVisible } = eventHeroMediaVisibility(previewImage, detailImage, detailReady)

  const revealDetail = useCallback((event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget
    const decoded = typeof image.decode === "function" ? image.decode() : Promise.resolve()
    void decoded.catch(() => undefined).then(() => setDetailReady(true))
  }, [])

  return (
    <div
      className={cn(
        "relative flex min-h-56 min-w-0 items-center justify-center overflow-hidden sm:min-h-72 lg:min-h-[360px]",
        className,
      )}
      style={{ backgroundImage: gradientFor(category) }}
    >
      {previewImage && previewImage !== fullImage && (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none",
            !previewVisible && "opacity-0",
          )}
          aria-hidden
        >
          <EventPoster
            image={previewImage}
            title={title}
            alt=""
            category={category}
            sizes={DETAIL_SIZES}
          />
          <div className="absolute inset-0 bg-ink/15" />
        </div>
      )}

      <div
        className={cn(
          "relative z-10 flex w-full items-center justify-center opacity-0 transition-opacity duration-300 motion-reduce:transition-none",
          detailVisible && "opacity-100",
        )}
      >
        <EventPoster
          image={fullImage}
          title={title}
          alt={title}
          category={category}
          sizes={DETAIL_SIZES}
          variant="detail"
          priority
          onLoad={revealDetail}
        />
      </div>
    </div>
  )
}
