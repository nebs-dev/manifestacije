import { resetSessionCheckCache } from "@/lib/session-check"

export const ORG_TOKEN_KEY = "orgToken"
export const ORG_USER_KEY = "orgUser"
const SESSION_CHANGED = "organizer-session-changed"

export function getOrganizerToken() {
  return localStorage.getItem(ORG_TOKEN_KEY)
}

/** Web Storage notifies other tabs; this event also notifies this tab. */
export function subscribeOrganizerSession(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.storageArea === localStorage && (event.key === ORG_TOKEN_KEY || event.key === null)) {
      resetSessionCheckCache()
      onChange()
    }
  }
  window.addEventListener("storage", onStorage)
  window.addEventListener(SESSION_CHANGED, onChange)
  return () => {
    window.removeEventListener("storage", onStorage)
    window.removeEventListener(SESSION_CHANGED, onChange)
  }
}

export type OrganizerSessionUser = {
  id: number
  email: string
  role: string
  organizerId: number | null
}

export function storeOrganizerSession(token: string, user?: OrganizerSessionUser) {
  localStorage.removeItem("adminToken")
  localStorage.removeItem("token")
  localStorage.setItem(ORG_TOKEN_KEY, token)
  if (user) localStorage.setItem(ORG_USER_KEY, JSON.stringify(user))
  else localStorage.removeItem(ORG_USER_KEY)
  resetSessionCheckCache()
  window.dispatchEvent(new Event(SESSION_CHANGED))
}

export function clearOrganizerSession() {
  localStorage.removeItem(ORG_TOKEN_KEY)
  localStorage.removeItem(ORG_USER_KEY)
  resetSessionCheckCache()
  window.dispatchEvent(new Event(SESSION_CHANGED))
}
