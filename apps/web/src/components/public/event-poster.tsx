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
   * "cover" (default) fills the container, cropping to the container's aspect
   * ratio — right for fixed-ratio card thumbnails. "contain-blur" is for
   * banners whose aspect ratio doesn't match the source image (e.g. a wide
   * hero showing a 4:3 poster): it shows the full image uncropped over a
   * blurred, scaled-up copy of itself as backdrop, so text baked into a
   * poster (title, date) is never cropped away.
   */
  fit?: "cover" | "contain-blur"
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

  if (fit === "contain-blur" && source === "image" && image) {
    const isLocal = image.startsWith("/")
    return (
      <div className={cn("relative h-full w-full overflow-hidden", className)}>
        {isLocal ? (
          <Image src={image} alt="" fill sizes={sizes} className="scale-110 object-cover object-center blur-2xl opacity-60" aria-hidden priority={priority} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover object-center blur-2xl opacity-60" aria-hidden loading={priority ? "eager" : "lazy"} decoding="async" />
        )}
        {isLocal ? (
          <Image src={image} alt={alt || title} fill sizes={sizes} className="object-contain" priority={priority} onError={() => setImageFailed(true)} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            srcSet={cloudinarySrcSet(image)}
            sizes={sizes}
            alt={alt || title}
            className="absolute inset-0 h-full w-full object-contain"
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        )}
      </div>
    )
  }

  if (source === "image" && image?.startsWith("/")) {
    return (
      <Image
        src={image}
        alt={alt || title}
        fill
        sizes={sizes}
        className={cn("h-full w-full object-cover", className)}
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
        src={image}
        srcSet={cloudinarySrcSet(image)}
        sizes={sizes}
        alt={alt || title}
        className={cn("h-full w-full object-cover", className)}
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
        className={cn("h-full w-full object-cover", className)}
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
