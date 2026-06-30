export const TOKEN_KEY = "adminToken"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

let _redirecting = false

function redirectToLogin() {
  if (_redirecting || typeof window === "undefined") return
  _redirecting = true
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem("token")
  window.location.href = "/admin/login"
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem("token")
}

export function clearToken() {
  if (typeof window === "undefined") return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem("token")
}

export async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getToken()
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers as Record<string, string> | undefined),
    },
  })
  if (res.status === 401 || res.status === 403) {
    redirectToLogin()
  }
  return res
}
