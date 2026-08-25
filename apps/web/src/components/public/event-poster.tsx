"use client"

import { useState, type ReactEventHandler } from "react"
import Image from "next/image"
import { gradientFor, categoryName, categoryFallbackImage } from "@/lib/data"
import { eventImagePrimaryUrl, eventImageSrcSet, type EventImageVariant } from "@/lib/event-image-variants"
import { cn } from "@/lib/utils"
import { resolvePosterSource } from "@/components/public/event-poster-source"
export { resolvePosterSource } from "@/components/public/event-poster-source"

interface EventPosterProps {
  image?: string
  title: string
  alt?: string
  category: string
  className?: string
  sizes?: string
  priority?: boolean
  variant?: EventImageVariant
  onLoad?: ReactEventHandler<HTMLImageElement>
}

export function EventPoster({
  image,
  title,
  alt,
  category,
  className,
  sizes = "(max-width: 768px) 100vw, 33vw",
  priority,
  variant = "card",
  onLoad,
}: EventPosterProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const [fallbackFailed, setFallbackFailed] = useState(false)

  const fallbackUrl = categoryFallbackImage(category, title)
  const source = resolvePosterSource({ hasImage: !!image, imageFailed, fallbackFailed })

  if (source === "image" && image && variant === "detail") {
    return (
      // Detail pages preserve the source's natural aspect ratio. A height cap
      // only affects unusually tall images, which remain fully visible via contain.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={eventImagePrimaryUrl(image, variant)}
        srcSet={eventImageSrcSet(image, variant)}
        sizes={sizes}
        alt={alt ?? title}
        className={cn("block h-auto w-full max-h-[72vh] object-contain lg:max-h-[720px]", className)}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        onLoad={onLoad}
        onError={() => setImageFailed(true)}
      />
    )
  }

  if (source === "image" && image?.startsWith("/")) {
    return (
      <Image
        src={image}
        alt={alt ?? title}
        fill
        sizes={sizes}
        className={cn("h-full w-full object-cover", className)}
        priority={priority}
        onLoad={onLoad}
        onError={() => setImageFailed(true)}
      />
    )
  }

  if (source === "image" && image) {
    // Event images come from arbitrary external sources (organizer uploads, scraped
    // sources, social CDNs) that can't be enumerated in next.config.js remotePatterns
    // ahead of time, so next/image (which requires an explicit host allowlist) isn't
    // usable here — a raw <img> handles any origin without crashing the page.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={eventImagePrimaryUrl(image, variant)}
        srcSet={eventImageSrcSet(image, variant)}
        sizes={sizes}
        alt={alt ?? title}
        className={cn("h-full w-full object-cover", className)}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        onLoad={onLoad}
        onError={() => setImageFailed(true)}
      />
    )
  }

  if (source === "fallback" && variant === "detail") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fallbackUrl}
        alt={alt ?? categoryName(category)}
        className={cn("block h-auto w-full max-h-[72vh] object-contain lg:max-h-[720px]", className)}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        onLoad={onLoad}
        onError={() => setFallbackFailed(true)}
      />
    )
  }

  if (source === "fallback") {
    return (
      <Image
        src={fallbackUrl}
        alt={alt ?? categoryName(category)}
        fill
        sizes={sizes}
        className={cn("h-full w-full object-cover", className)}
        priority={priority}
        onLoad={onLoad}
        onError={() => setFallbackFailed(true)}
      />
    )
  }

  return (
    <div
      className={cn("flex h-full w-full flex-col justify-end p-5", className)}
      style={{ backgroundImage: gradientFor(category) }}
      role="img"
      aria-label={title}
    >
      <span className="text-xs font-medium uppercase tracking-widest text-white/70">
        {categoryName(category)}
      </span>
      <span className="font-heading text-xl font-semibold leading-tight text-white text-balance">
        {title}
      </span>
    </div>
  )
}
