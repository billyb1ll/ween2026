/**
 * Immich API — People Service
 *
 * Facial recognition clusters — list, thumbnails, and name updates.
 */

import type { ImmichClient } from "./client";
import type {
  PeopleListResponse,
  ImmichPerson,
  PersonUpdateDto,
} from "./types";

export class PeopleService {
  private readonly client: ImmichClient;

  constructor(client: ImmichClient) {
    this.client = client;
  }

  /**
   * List all recognized people (face clusters).
   * @param withHidden - Include hidden people (default: false)
   */
  async list(withHidden = false): Promise<PeopleListResponse> {
    return this.client.request<PeopleListResponse>("/api/people", {
      params: { withHidden },
    });
  }

  /**
   * Get a single person by ID.
   */
  async getById(id: string): Promise<ImmichPerson> {
    return this.client.request<ImmichPerson>(`/api/people/${encodeURIComponent(id)}`);
  }

  /**
   * Build the URL for a person's face thumbnail.
   */
  thumbnailUrl(id: string): string {
    return this.client.buildUrl(`/api/people/${encodeURIComponent(id)}/thumbnail`);
  }

  /**
   * Update a person's metadata (name, birth date, visibility, etc.).
   */
  async update(id: string, data: PersonUpdateDto): Promise<ImmichPerson> {
    return this.client.request<ImmichPerson>(`/api/people/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: data,
    });
  }
}
