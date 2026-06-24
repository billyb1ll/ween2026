/**
 * Immich API — Albums Service
 *
 * List, retrieve, and manage albums.
 */

import type { ImmichClient } from "./client";
import type {
  ImmichAlbum,
  AlbumListFilters,
  BulkAlbumAssets,
} from "./types";

export class AlbumsService {
  private readonly client: ImmichClient;

  constructor(client: ImmichClient) {
    this.client = client;
  }

  /**
   * List all albums accessible to the authenticated user.
   * Supports filtering by name, ownership, shared status, or containing asset.
   */
  async list(filters?: AlbumListFilters): Promise<ImmichAlbum[]> {
    return this.client.request<ImmichAlbum[]>("/api/albums", {
      params: filters as Record<string, string | boolean | undefined>,
    });
  }

  /**
   * Get a single album by ID, including its nested assets.
   */
  async getById(id: string): Promise<ImmichAlbum> {
    return this.client.request<ImmichAlbum>(`/api/albums/${encodeURIComponent(id)}`);
  }

  /**
   * Find an album by exact name match.
   * Returns the first match, or null if not found.
   */
  async findByName(name: string): Promise<ImmichAlbum | null> {
    const albums = await this.list({ name });
    return albums.length > 0 ? albums[0] : null;
  }

  /**
   * Add assets to one or more albums in bulk.
   */
  async addAssets(payload: BulkAlbumAssets): Promise<unknown> {
    return this.client.request("/api/albums/assets", {
      method: "POST",
      body: payload,
    });
  }
}
