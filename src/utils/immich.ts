/**
 * Helper utility to securely validate and read the Immich Server URL.
 * 
 * --- DEVOPS & INFRASTRUCTURE REMINDER ---
 * Once the DigitalOcean Droplet hosting the Immich Server is provisioned:
 * 1. Update the `VITE_IMMICH_SERVER_URL` in the Vercel project settings dashboard.
 *    (No frontend rebuild or code changes are required).
 * 2. Ensure CORS is enabled on the Immich Server's reverse proxy (e.g., Nginx, Caddy, or Traefik)
 *    to authorize requests originating from our Vercel web portal domain.
 * ----------------------------------------
 */

const PLACEHOLDERS = [
  "placeholder",
  "todo",
  "change-me",
  "url",
  "http://placeholder",
  "https://placeholder"
]

export interface ImmichConfig {
  isConfigured: boolean
  url: string | null
}

export function getImmichConfig(): ImmichConfig {
  // Read Vite env variable
  const rawUrl = import.meta.env.VITE_IMMICH_SERVER_URL

  if (!rawUrl || typeof rawUrl !== "string") {
    return { isConfigured: false, url: null }
  }

  const trimmedUrl = rawUrl.trim()

  // Check against common placeholder values
  const lowercaseUrl = trimmedUrl.toLowerCase()
  const isPlaceholder = PLACEHOLDERS.some((p) => lowercaseUrl.includes(p))
  if (isPlaceholder) {
    return { isConfigured: false, url: null }
  }

  // Validate URL format and protocol (must start with http:// or https://)
  try {
    const parsed = new URL(trimmedUrl)
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return { isConfigured: true, url: trimmedUrl }
    }
  } catch {
    // Graceful fallback to prevent crashes if URL is malformed
  }

  return { isConfigured: false, url: null }
}
