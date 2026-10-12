"use client"

import Link from "next/link"
import type { ComponentProps } from "react"
import { armCalendarReturn } from "@/lib/calendar-return"

export function EventBackLink({ href, onClick, ...props }: ComponentProps<typeof Link> & { href: string }) {
  return (
    <Link
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event)
        if (href.startsWith("/kalendar")) armCalendarReturn(href)
      }}
    />
  )
}
