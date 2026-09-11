"use client"

import { trackEvent } from "@/lib/analytics"
import Link from "next/link"
import type { ComponentProps } from "react"

import { prefetchEventImage } from "@/lib/event-image-prefetch"

type PrefetchEventLinkProps = ComponentProps<typeof Link> & {
  heroImage?: string
  relatedEventSlug?: string
}

export function PrefetchEventLink({
  heroImage,
  relatedEventSlug,
  onClick,
  onPointerEnter,
  onFocus,
  onTouchStart,
  ...props
}: PrefetchEventLinkProps) {
  const warmImage = () => prefetchEventImage(heroImage)

  return (
    <Link
      {...props}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented && relatedEventSlug) trackEvent({ name: "related_event_click", params: { event_slug: relatedEventSlug } })
      }}
      onPointerEnter={(event) => {
        onPointerEnter?.(event)
        warmImage()
      }}
      onFocus={(event) => {
        onFocus?.(event)
        warmImage()
      }}
      onTouchStart={(event) => {
        onTouchStart?.(event)
        warmImage()
      }}
    />
  )
}
