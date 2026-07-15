"use client"

import { useState } from "react"
import Image from "next/image"
import { gradientFor, categoryName, categoryFallbackImage } from "@/lib/data"
import { cn } from "@/lib/utils"

interface EventPosterProps {
  image?: string
  title: string
  alt?: string
  category: string
  className?: string
  sizes?: string
  priority?: boolean
}

export type PosterSource = "image" | "fallback" | "placeholder"

/**
 * Decides which of the three image tiers to render: the event's own image,
 * the category fallback image, or the gradient placeholder — falling through
 * in order as each tier's onError fires. Pulled out of the component so the
 * fallback chain is unit-testable without a DOM/jsdom environment.
 */
export function resolvePosterSource(params: {
  hasImage: boolean
  imageFailed: boolean
  fallbackFailed: boolean
}): PosterSource {
  if (params.hasImage && !params.imageFailed) return "image"
  if (!params.fallbackFailed) return "fallback"
  return "placeholder"
}

export function EventPoster({
  image,
  title,
  alt,
  category,
  className,
  sizes = "(max-width: 768px) 100vw, 33vw",
  priority,
}: EventPosterProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const [fallbackFailed, setFallbackFailed] = useState(false)

  const fallbackUrl = categoryFallbackImage(category, title)
  const source = resolvePosterSource({ hasImage: !!image, imageFailed, fallbackFailed })

  if (source === "image") {
    // Event images come from arbitrary external sources (organizer uploads, scraped
    // sources, social CDNs) that can't be enumerated in next.config.js remotePatterns
    // ahead of time, so next/image (which requires an explicit host allowlist) isn't
    // usable here — a raw <img> handles any origin without crashing the page.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={alt || title}
        className={cn("h-full w-full object-cover", className)}
        loading={priority ? "eager" : "lazy"}
        onError={() => setImageFailed(true)}
      />
    )
  }

  if (source === "fallback") {
    return (
      <Image
        src={fallbackUrl}
        alt={categoryName(category)}
        fill
        sizes={sizes}
        className={cn("h-full w-full object-cover", className)}
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
