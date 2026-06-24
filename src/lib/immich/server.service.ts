/**
 * Immich API — Server Service
 *
 * Health checks, version info, and server configuration.
 */

import type { ImmichClient } from "./client";
import type {
  ServerPingResponse,
  ServerVersionResponse,
  ServerAboutResponse,
  ServerConfigResponse,
} from "./types";

export class ServerService {
  private readonly client: ImmichClient;

  constructor(client: ImmichClient) {
    this.client = client;
  }

  /**
   * Basic connectivity check. No auth required.
   * Returns { res: "pong" } if server is reachable.
   */
  async ping(): Promise<ServerPingResponse> {
    return this.client.request<ServerPingResponse>("/api/server/ping");
  }

  /**
   * Get server version in semver format. No auth required.
   */
  async getVersion(): Promise<ServerVersionResponse> {
    return this.client.request<ServerVersionResponse>("/api/server/version");
  }

  /**
   * Get the version as a formatted string (e.g., "1.106.4").
   */
  async getVersionString(): Promise<string> {
    const v = await this.getVersion();
    return `${v.major}.${v.minor}.${v.patch}`;
  }

  /**
   * Get detailed server info. Requires auth.
   */
  async getAbout(): Promise<ServerAboutResponse> {
    return this.client.request<ServerAboutResponse>("/api/server/about");
  }

  /**
   * Get public server configuration. No auth required.
   */
  async getConfig(): Promise<ServerConfigResponse> {
    return this.client.request<ServerConfigResponse>("/api/server/config");
  }
}
