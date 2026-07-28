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

const getDirectImmichServerUrl = () => {
  const url = (
    import.meta.env.VITE_IMMICH_SERVER_URL ||
    import.meta.env.VITE_IMMICH_DIRECT_URL ||
    "https://immich.b1lly.tech"
  ).replace(/\/api\/?$/, "").replace(/\/+$/, "");
  return url || "https://immich.b1lly.tech";
};

const getDirectApiKey = () => {
  return (
    import.meta.env.VITE_IMMICH_VIEWER_API_KEY ||
    import.meta.env.VITE_IMMICH_API_KEY ||
    import.meta.env.VITE_IMMICH_KEY ||
    "QuY9PZhRPWiPU2Z8Ii9iL4wYB530bDMr42FSlKGuX74"
  );
};

export class AssetsService {
  private readonly client: ImmichClient;

  constructor(client: ImmichClient) {
    this.client = client;
  }

  /**
   * Build the direct URL for an asset thumbnail.
   * Direct fetch from Immich origin with apiKey (0 Vercel bandwidth).
   *
   * @param id    - Asset UUID
   * @param size  - "thumbnail" (small) or "preview" (large)
   */
  thumbnailUrl(id: string, size: ThumbnailSize = "thumbnail"): string {
    const serverUrl = getDirectImmichServerUrl();
    const apiKey = getDirectApiKey();
    return `${serverUrl}/api/assets/${encodeURIComponent(id)}/thumbnail?size=${size}&apiKey=${apiKey}`;
  }

  /**
   * Build the direct URL for an asset preview (720p).
   * Direct fetch from Immich origin for Lightbox and Preview modals (0 Vercel bandwidth).
   */
  previewUrl(id: string): string {
    const serverUrl = getDirectImmichServerUrl();
    const apiKey = getDirectApiKey();
    return `${serverUrl}/api/assets/${encodeURIComponent(id)}/thumbnail?size=preview&apiKey=${apiKey}`;
  }

  /**
   * Build the direct URL for the original (full-resolution) asset file.
   * Direct fetch from Immich origin (0 Vercel bandwidth).
   */
  originalUrl(id: string): string {
    const serverUrl = getDirectImmichServerUrl();
    const apiKey = getDirectApiKey();
    return `${serverUrl}/api/assets/${encodeURIComponent(id)}/original?apiKey=${apiKey}`;
  }

  /**
   * Build the direct URL specifically for downloading the asset.
   * Direct browser download from Immich origin (0 Vercel bandwidth).
   */
  downloadUrl(id: string): string {
    const serverUrl = getDirectImmichServerUrl();
    const apiKey = getDirectApiKey();
    return `${serverUrl}/api/assets/${encodeURIComponent(id)}/original?apiKey=${apiKey}`;
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
