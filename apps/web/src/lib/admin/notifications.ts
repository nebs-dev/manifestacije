export const notificationLabels = {
  organizer: "Nova registracija organizatora",
  submission: "Novi događaj organizatora",
  revision: "Izmjene događaja čekaju pregled",
  source: "Novi izvor organizatora",
  discovery: "Otkriveni događaji za pregled",
  autoPublished: "Automatski objavljen događaj pouzdanog organizatora",
} as const
export type NotificationKind = keyof typeof notificationLabels
export type AdminNotification = { key: string; kind: NotificationKind; entityId: number; createdAt: string; title: string; href: string; requiresAction: boolean; readAt: string | null }
export const notificationsChanged = () => window.dispatchEvent(new Event("admin-notifications-changed"))
