"use client"

import type { ComponentProps, MouseEvent } from "react"
import Link from "next/link"
import {
  trackDiscoveryNavigation,
  type DiscoveryDestination,
  type DiscoverySourceComponent,
} from "@/lib/analytics"

type Props = Omit<ComponentProps<typeof Link>, "href" | "onClick"> & {
  href: DiscoveryDestination
  sourcePage: string
  sourceComponent: DiscoverySourceComponent
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
}

export function TrackedDiscoveryLink({
  href,
  sourcePage,
  sourceComponent,
  onClick,
  ...props
}: Props) {
  return (
    <Link
      {...props}
      href={href}
      onClick={(event) => {
        trackDiscoveryNavigation({
          source_page: sourcePage,
          source_component: sourceComponent,
          destination: href,
        })
        onClick?.(event)
      }}
    />
  )
}
