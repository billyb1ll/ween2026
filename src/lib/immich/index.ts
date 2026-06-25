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

// ── Default Singleton ─────────────────────────────────────────

/**
 * Default Immich service configured dynamically.
 * 
 * In development, uses the local proxy (`/api/immich`).
 * In production, it connects to your backend proxy if `VITE_API_BASE_URL` is provided.
 * 
 * NOTE: The frontend MUST talk to the backend proxy. It cannot talk directly 
 * to the Immich server because Immich does not support CORS preflight (OPTIONS) requests.
 */
const baseUrl = import.meta.env.VITE_API_BASE_URL || "/api/immich";

export const immich = createImmichService({ baseUrl });
