import { gradientFor, categoryName } from "@/lib/data"
import { cn } from "@/lib/utils"

interface EventPosterProps {
  image?: string
  title: string
  category: string
  className?: string
  sizes?: string
  priority?: boolean
}

/**
 * Renders an event image, or a tasteful category gradient placeholder
 * (with the event title) when no image is available.
 */
export function EventPoster({
  image,
  title,
  category,
  className,
  sizes = "(max-width: 768px) 100vw, 33vw",
}: EventPosterProps) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image || "/placeholder.svg"}
        alt={title}
        sizes={sizes}
        className={cn("h-full w-full object-cover", className)}
        crossOrigin="anonymous"
        loading="lazy"
      />
    )
  }

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col justify-end p-5",
        className,
      )}
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
