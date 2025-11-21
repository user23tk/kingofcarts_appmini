/**
 * Helper per ottenere il token di autenticazione debug dal sessionStorage
 */
export function getDebugAuthToken(): string | null {
  if (typeof window === "undefined") return null
  return sessionStorage.getItem("debug_auth_token")
}

/**
 * Crea gli headers per le richieste API debug con autenticazione
 */
export function getDebugAuthHeaders(): HeadersInit {
  const token = getDebugAuthToken()
  if (!token) {
    return {}
  }

  return {
    Authorization: `Bearer ${token}`,
  }
}

/**
 * Effettua una richiesta fetch con autenticazione debug
 */
export async function debugFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = {
    ...getDebugAuthHeaders(),
    ...options.headers,
  }

  return fetch(url, {
    ...options,
    headers,
  })
}
