/**
 * Immich API — Core HTTP Client
 *
 * Isomorphic client that works in both browser (via proxy) and Node.js (direct).
 * Base URL is configurable to switch between local dev and production.
 */

import type { ImmichClientConfig, ImmichApiErrorData } from "./types";

export class ImmichApiError extends Error {
  readonly statusCode: number;
  readonly endpoint: string;
  readonly correlationId?: string;

  constructor(message: string, statusCode: number, endpoint: string, correlationId?: string) {
    super(message);
    this.name = "ImmichApiError";
    this.statusCode = statusCode;
    this.endpoint = endpoint;
    this.correlationId = correlationId;
  }
}

export class ImmichClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly config: ImmichClientConfig;

  constructor(config: ImmichClientConfig) {
    this.config = config;
    // Strip trailing slash for consistent URL building
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
  }

  /**
   * Build a full URL for the given API path.
   * Paths should start with "/" (e.g., "/api/server/ping").
   */
  buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    let cleanPath = path;
    
    // If proxying via our local /api/immich, map /api/xxx -> /api/immich/xxx
    if (this.baseUrl === "/api/immich" && cleanPath.startsWith("/api/")) {
      cleanPath = cleanPath.substring(4); // strip '/api'
    }

    const fullPath = this.baseUrl + cleanPath;
    const isAbsolute = /^https?:\/\//i.test(this.baseUrl);
    const dummyOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const url = new URL(fullPath, isAbsolute ? undefined : dummyOrigin);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return isAbsolute ? url.toString() : url.pathname + url.search;
  }

  /**
   * Make an authenticated JSON request to the Immich API.
   */
  async request<T>(
    path: string,
    options: {
      method?: string;
      params?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
    } = {}
  ): Promise<T> {
    const { method = "GET", params, body } = options;
    const url = this.buildUrl(path, params);

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (this.apiKey) {
      headers["x-api-key"] = this.apiKey;
    }

    // Automatically use provided accessToken or fallback to localStorage token
    const token = this.config.accessToken || (typeof window !== 'undefined' ? localStorage.getItem('baan7_session_token') : null);
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    if (body !== undefined && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
    });

    if (!response.ok) {
      let errorData: ImmichApiErrorData | undefined;
      try {
        errorData = await response.json() as ImmichApiErrorData;
      } catch {
        // Response body may not be JSON
      }

      const message = errorData?.message || response.statusText || `HTTP ${response.status}`;
      throw new ImmichApiError(message, response.status, path, errorData?.correlationId);
    }

    // Handle no-content responses
    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json() as Promise<T>;
    }

    return response.text() as unknown as T;
  }

  /** Get the configured base URL (useful for building asset/thumbnail URLs). */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /** Check if an API key is configured. */
  hasApiKey(): boolean {
    return Boolean(this.apiKey);
  }
}

/**
 * Create a new Immich client instance.
 */
export function createImmichClient(config: ImmichClientConfig): ImmichClient {
  if (config.baseUrl === undefined || config.baseUrl === null) {
    throw new Error("ImmichClient requires a baseUrl. Set VITE_IMMICH_SERVER_URL in your environment.");
  }
  return new ImmichClient(config);
}
