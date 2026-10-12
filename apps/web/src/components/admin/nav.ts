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
  { label: "Nadzorna ploča", href: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Dostava emailova", href: "/admin/email-deliveries", icon: Mail },
  { label: "Obavijesti", href: "/admin/notifications", icon: Bell },
  { label: "Izvori", href: "/admin/sources", icon: Link2 },
  { label: "Nadzirani izvori", href: "/admin/monitored-sources", icon: Radar },
  { label: "Događaji na čekanju", href: "/admin/events/pending", icon: Clock },
  { label: "Izmjene događaja", href: "/admin/event-revisions", icon: Clock },
  { label: "Događaji", href: "/admin/events", icon: CalendarDays, exact: true },
  { label: "Organizatori", href: "/admin/organizers", icon: Users },
  { label: "Zahtjevi za preuzimanje", href: "/admin/organizer-claims", icon: UserCheck },
  { label: "Korisnici", href: "/admin/users", icon: UserCog },
  { label: "Duplikati", href: "/admin/duplicates", icon: CopyCheck },
  { label: "Kategorije", href: "/admin/categories", icon: Tags },
  { label: "Partneri", href: "/admin/partners", icon: Handshake },
  { label: "Regije i gradovi", href: "/admin/regions", icon: MapPin },
]
