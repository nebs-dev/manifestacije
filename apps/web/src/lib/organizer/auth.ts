export const ORG_TOKEN_KEY = "orgToken"
export const ORG_USER_KEY = "orgUser"

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
}

export function clearOrganizerSession() {
  localStorage.removeItem(ORG_TOKEN_KEY)
  localStorage.removeItem(ORG_USER_KEY)
}
