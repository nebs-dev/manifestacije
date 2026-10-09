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
  const isFormData = init?.body instanceof FormData
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(!isFormData ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers as Record<string, string> | undefined),
    },
  })
  // Only 401 means the token itself is invalid/expired. A 403 is a business
  // rule refusing one action and 429/5xx are transient — none of those may
  // end the admin session (AUTH-01).
  if (res.status === 401 && token) {
    redirectToLogin()
  }
  return res
}
