import {
  LayoutDashboard,
  Bell,
  Mail,
  Link2,
  Radar,
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
  { label: "Dostava emailova", href: "/admin/email-deliveries", icon: Mail },
  { label: "Obavijesti", href: "/admin/notifications", icon: Bell },
  { label: "Sources", href: "/admin/sources", icon: Link2 },
  { label: "Monitored sources", href: "/admin/monitored-sources", icon: Radar },
  { label: "Pending events", href: "/admin/events/pending", icon: Clock },
  { label: "Izmjene događaja", href: "/admin/event-revisions", icon: Clock },
  { label: "Events", href: "/admin/events", icon: CalendarDays, exact: true },
  { label: "Organizers", href: "/admin/organizers", icon: Users },
  { label: "Claim requests", href: "/admin/organizer-claims", icon: UserCheck },
  { label: "Users", href: "/admin/users", icon: UserCog },
  { label: "Duplicates", href: "/admin/duplicates", icon: CopyCheck },
  { label: "Categories", href: "/admin/categories", icon: Tags },
  { label: "Partners", href: "/admin/partners", icon: Handshake },
  { label: "Regions", href: "/admin/regions", icon: MapPin },
]
