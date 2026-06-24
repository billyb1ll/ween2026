/**
 * Immich API — Assets Service
 *
 * Thumbnails, originals, and metadata search.
 */

import type { ImmichClient } from "./client";
import type {
  ThumbnailSize,
  MetadataSearchDto,
  SearchResponse,
  ImmichAsset,
} from "./types";

export class AssetsService {
  private readonly client: ImmichClient;

  constructor(client: ImmichClient) {
    this.client = client;
  }

  /**
   * Build the URL for an asset thumbnail.
   * Use this to construct <img src="..."> URLs — does NOT fetch data.
   *
   * @param id    - Asset UUID
   * @param size  - "thumbnail" (small) or "preview" (large)
   */
  thumbnailUrl(id: string, size: ThumbnailSize = "thumbnail"): string {
    return this.client.buildUrl(`/api/assets/${encodeURIComponent(id)}/thumbnail`, { size });
  }

  /**
   * Build the URL for the original (full-resolution) asset file.
   */
  originalUrl(id: string): string {
    return this.client.buildUrl(`/api/assets/${encodeURIComponent(id)}/original`);
  }

  /**
   * Get asset metadata by ID.
   */
  async getById(id: string): Promise<ImmichAsset> {
    return this.client.request<ImmichAsset>(`/api/assets/${encodeURIComponent(id)}`);
  }

  /**
   * Search assets by metadata criteria (date range, location, device, etc.).
   * Uses POST because the search payload can be complex.
   */
  async searchMetadata(query: MetadataSearchDto): Promise<SearchResponse> {
    if (query.personIds && query.personIds.length > 1) {
      console.log(`[AssetsService] Performing OR search for ${query.personIds.length} personIds:`, query.personIds);
      
      const promises = query.personIds.map(id => {
        const singleQuery = { ...query, personIds: [id] };
        return this.client.request<SearchResponse>("/api/search/metadata", {
          method: "POST",
          body: singleQuery,
        }).catch(err => {
          console.error(`[AssetsService] Failed to fetch assets for personId ${id}:`, err);
          return { assets: { items: [], count: 0, total: 0, facets: [] } } as unknown as SearchResponse;
        });
      });

      const results = await Promise.all(promises);
      
      const allAssets: ImmichAsset[] = [];
      const seenIds = new Set<string>();

      for (const res of results) {
        if (res.assets?.items) {
          for (const asset of res.assets.items) {
            if (!seenIds.has(asset.id)) {
              seenIds.add(asset.id);
              allAssets.push(asset);
            }
          }
        }
      }

      // Sort newest first
      allAssets.sort((a, b) => {
        const dateA = new Date(a.fileCreatedAt).getTime();
        const dateB = new Date(b.fileCreatedAt).getTime();
        return dateB - dateA; // Descending
      });

      return {
        assets: {
          items: allAssets,
          count: allAssets.length,
          total: allAssets.length,
          facets: []
        }
      } as unknown as SearchResponse;
    }

    console.log(`[AssetsService] Performing standard search payload:`, query);
    return this.client.request<SearchResponse>("/api/search/metadata", {
      method: "POST",
      body: query,
    });
  }

  /**
   * Upload a new asset.
   */
  async upload(file: File): Promise<{ id: string }> {
    const formData = new FormData();
    formData.append("assetData", file);
    formData.append("deviceAssetId", `${file.name}-${file.size}-${file.lastModified}`);
    formData.append("deviceId", "browser-admin");
    formData.append("fileCreatedAt", new Date(file.lastModified).toISOString());
    formData.append("fileModifiedAt", new Date(file.lastModified).toISOString());
    formData.append("isFavorite", "false");

    return this.client.request<{ id: string }>("/api/assets", {
      method: "POST",
      body: formData,
    });
  }
}
