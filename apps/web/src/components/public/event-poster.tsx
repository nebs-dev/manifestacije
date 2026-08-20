"use client"

import { useState } from "react"
import Image from "next/image"
import { gradientFor, categoryName, categoryFallbackImage } from "@/lib/data"
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
  /**
   * "cover" (default) crops to the container's aspect ratio anchored at
   * center — right for fixed-ratio card thumbnails. "cover-top" anchors the
   * crop to the top instead: for banners much wider than the source poster
   * (event hero), most posters put the title/date near the top, so a
   * center crop is the one most likely to cut it off.
   */
  fit?: "cover" | "cover-top"
}

function cloudinaryVariant(url: string, width: number, height: number) {
  if (!url.includes("res.cloudinary.com")) return url
  const replacement = `c_fill,g_auto,f_auto,q_auto,w_${width},h_${height}`
  if (/\/upload\/[^/]*w_\d+[^/]*h_\d+[^/]*\//.test(url)) {
    return url.replace(/\/upload\/[^/]*\//, `/upload/${replacement}/`)
  }
  return url.replace(/\/upload\//, `/upload/${replacement}/`)
}

function cloudinarySrcSet(url: string) {
  if (!url.includes("res.cloudinary.com")) return undefined
  return [
    `${cloudinaryVariant(url, 360, 270)} 360w`,
    `${cloudinaryVariant(url, 520, 390)} 520w`,
    `${cloudinaryVariant(url, 640, 480)} 640w`,
    `${cloudinaryVariant(url, 800, 600)} 800w`,
  ].join(", ")
}

// c_fill,g_auto above always crops to an exact w:h ratio server-side, which
// is right for a fixed-ratio card grid but wrong for a full-bleed hero: the
// crop region is picked before the browser knows the container's actual
// (viewport-dependent) aspect ratio, so it can just as easily cut off a
// poster's title as keep it. c_limit only downscales — the full image
// reaches the browser untouched, and object-cover/object-position there
// does the real, responsive crop.
function cloudinaryUncropped(url: string, width: number) {
  if (!url.includes("res.cloudinary.com")) return url
  const replacement = `c_limit,f_auto,q_auto,w_${width}`
  if (/\/upload\/[^/]*w_\d+[^/]*h_\d+[^/]*\//.test(url)) {
    return url.replace(/\/upload\/[^/]*\//, `/upload/${replacement}/`)
  }
  return url.replace(/\/upload\//, `/upload/${replacement}/`)
}

function cloudinaryUncroppedSrcSet(url: string) {
  if (!url.includes("res.cloudinary.com")) return undefined
  return [
    `${cloudinaryUncropped(url, 800)} 800w`,
    `${cloudinaryUncropped(url, 1200)} 1200w`,
    `${cloudinaryUncropped(url, 1600)} 1600w`,
    `${cloudinaryUncropped(url, 2000)} 2000w`,
  ].join(", ")
}

export function EventPoster({
  image,
  title,
  alt,
  category,
  className,
  sizes = "(max-width: 768px) 100vw, 33vw",
  priority,
  fit = "cover",
}: EventPosterProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const [fallbackFailed, setFallbackFailed] = useState(false)

  const fallbackUrl = categoryFallbackImage(category, title)
  const source = resolvePosterSource({ hasImage: !!image, imageFailed, fallbackFailed })

  if (source === "image" && image?.startsWith("/")) {
    return (
      <Image
        src={image}
        alt={alt || title}
        fill
        sizes={sizes}
        className={cn("h-full w-full object-cover", fit === "cover-top" && "object-top", className)}
        priority={priority}
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
        src={fit === "cover-top" ? cloudinaryUncropped(image, 1600) : image}
        srcSet={fit === "cover-top" ? cloudinaryUncroppedSrcSet(image) : cloudinarySrcSet(image)}
        sizes={sizes}
        alt={alt || title}
        className={cn("h-full w-full object-cover", fit === "cover-top" && "object-top", className)}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
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
        className={cn("h-full w-full object-cover", fit === "cover-top" && "object-top", className)}
        priority={priority}
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
