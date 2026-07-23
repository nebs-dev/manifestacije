import {
  LayoutDashboard,
  Link2,
  Clock,
  CalendarDays,
  Users,
  UserCheck,
  UserCog,
  CopyCheck,
  Tags,
  MapPin,
  Handshake,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  exact?: boolean
}

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Sources", href: "/admin/sources", icon: Link2 },
  { label: "Pending events", href: "/admin/events/pending", icon: Clock },
  { label: "Events", href: "/admin/events", icon: CalendarDays, exact: true },
  { label: "Organizers", href: "/admin/organizers", icon: Users },
  { label: "Claim requests", href: "/admin/organizer-claims", icon: UserCheck },
  { label: "Users", href: "/admin/users", icon: UserCog },
  { label: "Duplicates", href: "/admin/duplicates", icon: CopyCheck },
  { label: "Categories", href: "/admin/categories", icon: Tags },
  { label: "Partners", href: "/admin/partners", icon: Handshake },
  { label: "Regions", href: "/admin/regions", icon: MapPin },
]
