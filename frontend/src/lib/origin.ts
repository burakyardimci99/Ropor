/**
 * URL helpers that default to same-origin when no explicit override is given.
 *
 * Dev (no Caddy): set NEXT_PUBLIC_BACKEND_URL / _WS_URL / _FRAMES_WS_URL to
 *   the explicit backend host so the :3000 frontend can reach the :8000 API.
 *
 * Production (behind Caddy): leave the env vars empty / unset. The kiosk
 *   browser hits the Caddy origin (https://server-ip/), and everything is
 *   resolved from window.location — no CORS, no mixed content.
 */

export function wsUrlFor(path: string, envOverride?: string): string {
  if (envOverride) return envOverride;
  if (typeof window === "undefined") return `ws://localhost:8000${path}`;
  // Behind Caddy the URL has no explicit port (80/443 implicit). If we see an
  // explicit port (3000 dev server, 49200 preview, etc.) the backend is the
  // separate :8000 service.
  if (window.location.port) {
    return `ws://${window.location.hostname}:8000${path}`;
  }
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}${path}`;
}

/** REST base. Empty string yields relative paths (same-origin behind Caddy). */
export function restBase(envOverride?: string): string {
  if (envOverride) return envOverride;
  if (typeof window === "undefined") return "";
  if (window.location.port) {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return "";
}
