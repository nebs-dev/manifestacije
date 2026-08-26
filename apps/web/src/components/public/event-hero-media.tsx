"use client"

import Image from "next/image"
import { useCallback, useState, type SyntheticEvent } from "react"

import { categoryName, gradientFor } from "@/lib/data"
import { eventImagePrimaryUrl, eventImageSrcSet } from "@/lib/event-image-variants"
import { cn } from "@/lib/utils"
import { eventHeroMediaMode, eventHeroMediaVisibility, type EventHeroMediaMode } from "./event-hero-media-state"

const DETAIL_SIZES = "(max-width: 1023px) calc(100vw - 2rem), 700px"

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
  const [detailFailed, setDetailFailed] = useState(false)
  const [mode, setMode] = useState<EventHeroMediaMode>(() => eventHeroMediaMode({ hasImage: Boolean(detailImage ?? previewImage) }))
  const { fullImage, previewVisible, detailVisible } = eventHeroMediaVisibility(previewImage, detailImage, detailReady)

  const revealDetail = useCallback((event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget
    setMode(eventHeroMediaMode({
      hasImage: true,
      width: image.naturalWidth,
      height: image.naturalHeight,
      sourceDimensions: !image.srcset,
    }))
    const decoded = typeof image.decode === "function" ? image.decode() : Promise.resolve()
    void decoded.catch(() => undefined).then(() => setDetailReady(true))
  }, [])

  if (!fullImage || detailFailed) {
    return (
      <div
        className={cn(
          "relative flex min-h-64 w-full items-center justify-center overflow-hidden rounded-3xl sm:min-h-80 lg:h-full lg:min-h-[500px] lg:max-h-[600px]",
          className,
        )}
        style={{ backgroundImage: gradientFor(category) }}
        role="img"
        aria-label={`Vizual događanja ${title}`}
      >
        {detailFailed && previewImage ? (
          // The already-loaded card image is the last-resort visual if the
          // larger detail resource fails. It stays bounded and never leaves
          // an empty hero panel.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewImage} alt="" className="absolute inset-0 size-full object-contain p-2 opacity-70" aria-hidden />
        ) : (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.14),transparent_32%),radial-gradient(circle_at_80%_75%,rgba(245,166,66,0.18),transparent_35%)]" aria-hidden />
            <div className="relative z-10 flex max-w-xs flex-col items-center px-8 text-center text-ink-foreground">
              <Image src="/logo/logo.svg" alt="" width={72} height={72} className="mb-5 size-16 rounded-2xl shadow-poster" aria-hidden />
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-foreground/60">Manifestacije</span>
              <span className="mt-2 font-heading text-2xl font-semibold">{categoryName(category)}</span>
            </div>
          </>
        )}
        <div className="absolute inset-0 bg-ink/15" aria-hidden />
      </div>
    )
  }

  const primaryUrl = eventImagePrimaryUrl(fullImage, "detail")
  const srcSet = eventImageSrcSet(fullImage, "detail")
  return (
    <div
      className={cn(
        "relative flex min-w-0 items-center justify-center overflow-hidden rounded-3xl bg-ink",
        mode === "landscape"
          ? "aspect-video max-h-[420px] lg:aspect-auto lg:h-full lg:min-h-[500px] lg:max-h-[600px]"
          : "h-[min(60vh,560px)] min-h-80 lg:h-full lg:min-h-[500px] lg:max-h-[600px]",
        className,
      )}
      data-media-mode={mode}
    >
      {previewImage && previewImage !== fullImage && previewVisible && (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none",
            !previewVisible && "opacity-0",
          )}
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewImage} alt="" className="size-full object-contain p-2 opacity-70" />
        </div>
      )}

      <div
        className={cn(
          "relative z-10 flex size-full items-center justify-center opacity-0 transition-opacity duration-300 motion-reduce:transition-none",
          detailVisible && "opacity-100",
        )}
      >
        {/* Arbitrary organizer/import origins cannot be safely allowlisted for
            next/image. Cloudinary URLs still receive the existing responsive
            srcset, while other origins remain untouched. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={primaryUrl}
          srcSet={srcSet}
          sizes={DETAIL_SIZES}
          alt={title}
          className={cn(
            "block size-full",
            mode === "landscape" ? "object-cover" : "object-contain p-2 sm:p-3",
          )}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          onLoad={revealDetail}
          onError={() => setDetailFailed(true)}
        />
      </div>
    </div>
  )
}
