"use client"

import Link from "next/link"
import type { ComponentProps } from "react"

import { prefetchEventImage } from "@/lib/event-image-prefetch"

type PrefetchEventLinkProps = ComponentProps<typeof Link> & {
  heroImage?: string
}

export function PrefetchEventLink({
  heroImage,
  onPointerEnter,
  onFocus,
  onTouchStart,
  ...props
}: PrefetchEventLinkProps) {
  const warmImage = () => prefetchEventImage(heroImage)

  return (
    <Link
      {...props}
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
