"use client"

import { useState } from "react"
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

export function EventPoster({
  image,
  title,
  alt,
  category,
  className,
  sizes = "(max-width: 768px) 100vw, 33vw",
}: EventPosterProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const [fallbackFailed, setFallbackFailed] = useState(false)

  const fallbackUrl = categoryFallbackImage(category, title)

  if (image && !imageFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={alt || title}
        sizes={sizes}
        className={cn("h-full w-full object-cover", className)}
        crossOrigin="anonymous"
        loading="lazy"
        onError={() => setImageFailed(true)}
      />
    )
  }

  if (!fallbackFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fallbackUrl}
        alt={categoryName(category)}
        sizes={sizes}
        className={cn("h-full w-full object-cover", className)}
        loading="lazy"
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
