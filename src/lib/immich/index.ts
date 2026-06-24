/**
 * Immich API — Barrel Export
 *
 * Creates a configured client instance from environment variables
 * and exposes all service modules.
 *
 * Usage (frontend — goes through proxy):
 *   import { immichClient } from "@/lib/immich";
 *   const pong = await immichClient.server.ping();
 *
 * Usage (custom config):
 *   import { createImmichService } from "@/lib/immich";
 *   const service = createImmichService({ baseUrl: "http://192.168.137.1:2284", apiKey: "..." });
 */

import { createImmichClient } from "./client";
import type { ImmichClient } from "./client";
import { ServerService } from "./server.service";
import { AlbumsService } from "./albums.service";
import { AssetsService } from "./assets.service";
import { PeopleService } from "./people.service";
import type { ImmichClientConfig } from "./types";

// ── Re-exports ──────────────────────────────────────────────

export { ImmichClient, ImmichApiError } from "./client";
export { ServerService } from "./server.service";
export { AlbumsService } from "./albums.service";
export { AssetsService } from "./assets.service";
export { PeopleService } from "./people.service";
export type * from "./types";

// ── Composite Service ───────────────────────────────────────

export interface ImmichService {
  client: ImmichClient;
  server: ServerService;
  albums: AlbumsService;
  assets: AssetsService;
  people: PeopleService;
}

/**
 * Create a fully-assembled Immich service with all sub-services.
 */
export function createImmichService(config: ImmichClientConfig): ImmichService {
  const client = createImmichClient(config);
  return {
    client,
    server: new ServerService(client),
    albums: new AlbumsService(client),
    assets: new AssetsService(client),
    people: new PeopleService(client),
  };
}

// ── Default Singleton (from Vite env vars) ──────────────────

/**
 * Default Immich service configured from Vite environment variables.
 *
 * Returns `null` if VITE_IMMICH_SERVER_URL is not set or is a placeholder.
 * This prevents crashes when Immich is not yet configured.
 */
function createDefaultService(): ImmichService | null {
  try {
    const url = import.meta.env?.VITE_IMMICH_SERVER_URL;
    const apiKey = import.meta.env?.VITE_IMMICH_API_KEY;

    if (!url || typeof url !== "string") return null;

    const trimmed = url.trim().toLowerCase();
    const placeholders = ["placeholder", "todo", "change-me"];
    if (placeholders.some((p) => trimmed.includes(p))) return null;

    // Validate URL
    new URL(url.trim());

    return createImmichService({
      baseUrl: url.trim(),
      apiKey: apiKey || undefined,
    });
  } catch {
    return null;
  }
}

/**
 * Pre-configured Immich service singleton.
 * `null` when Immich is not configured (placeholder/missing env vars).
 *
 * Check before use:
 *   if (immichService) { await immichService.server.ping(); }
 */
export const immichService = createDefaultService();
