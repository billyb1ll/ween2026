/**
 * Immich API — TypeScript Type Definitions
 *
 * Derived from the Immich OpenAPI spec.
 * These cover the gallery-relevant subset of the API.
 */

// ── Server ──────────────────────────────────────────────────

export interface ServerPingResponse {
  res: string; // "pong"
}

export interface ServerVersionResponse {
  major: number;
  minor: number;
  patch: number;
}

export interface ServerAboutResponse {
  version: string;
  versionUrl: string;
  licensed: boolean;
  build?: string;
  buildUrl?: string;
  buildImage?: string;
  buildImageUrl?: string;
  repository?: string;
  repositoryUrl?: string;
  sourceRef?: string;
  sourceCommit?: string;
  sourceUrl?: string;
  nodejs?: string;
  ffmpeg?: string;
  imagemagick?: string;
  libvips?: string;
  exiftool?: string;
}

export interface ServerConfigResponse {
  loginPageMessage: string;
  trashDays: number;
  userDeleteDelay: number;
  oauthButtonText: string;
  isInitialized: boolean;
  isOnboarded: boolean;
  externalDomain: string;
}

// ── Assets ──────────────────────────────────────────────────

export type AssetType = "IMAGE" | "VIDEO" | "AUDIO" | "OTHER";
export type ThumbnailSize = "preview" | "thumbnail";

export interface ImmichAsset {
  id: string;
  deviceAssetId: string;
  ownerId: string;
  deviceId: string;
  libraryId?: string | null;
  type: AssetType;
  originalPath: string;
  originalFileName: string;
  originalMimeType?: string;
  thumbhash?: string | null;
  fileCreatedAt: string;
  fileModifiedAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  localDateTime: string;
  isFavorite: boolean;
  isArchived: boolean;
  isTrashed: boolean;
  isOffline: boolean;
  duration: string;
  exifInfo?: ExifInfo;
  livePhotoVideoId?: string | null;
  checksum: string;
  people?: ImmichAssetPerson[];
}

export interface ImmichAssetPerson {
  id: string;
  name: string;
  birthDate?: string | null;
  thumbnailPath: string;
  isHidden: boolean;
  isFavorite: boolean;
  faces: ImmichFace[];
}

export interface ImmichFace {
  id: string;
  boundingBoxX1: number;
  boundingBoxY1: number;
  boundingBoxX2: number;
  boundingBoxY2: number;
  imageWidth: number;
  imageHeight: number;
  sourceType: string;
}

export interface ExifInfo {
  make?: string | null;
  model?: string | null;
  exifImageWidth?: number | null;
  exifImageHeight?: number | null;
  fileSizeInByte?: number | null;
  orientation?: string | null;
  dateTimeOriginal?: string | null;
  modifyDate?: string | null;
  timeZone?: string | null;
  lensModel?: string | null;
  fNumber?: number | null;
  focalLength?: number | null;
  iso?: number | null;
  exposureTime?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  description?: string | null;
  projectionType?: string | null;
}

// ── Albums ───────────────────────────────────────────────────

export interface ImmichAlbum {
  id: string;
  albumName: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  albumThumbnailAssetId?: string | null;
  shared: boolean;
  hasSharedLink: boolean;
  startDate?: string | null;
  endDate?: string | null;
  assetCount: number;
  assets?: ImmichAsset[];
  owner: AlbumOwner;
  albumUsers?: AlbumUser[];
  isActivityEnabled: boolean;
  order?: string;
  lastModifiedAssetTimestamp?: string;
}

export interface AlbumOwner {
  id: string;
  email: string;
  name: string;
  profileImagePath: string;
  avatarColor: string;
}

export interface AlbumUser {
  user: AlbumOwner;
  role: "editor" | "viewer";
}

export interface AlbumListFilters {
  assetId?: string;
  id?: string;
  isOwned?: boolean;
  isShared?: boolean;
  name?: string;
}

export interface BulkAlbumAssets {
  albumIds: string[];
  assetIds: string[];
}

// ── People ──────────────────────────────────────────────────

export interface ImmichPerson {
  id: string;
  name: string;
  birthDate?: string | null;
  thumbnailPath: string;
  isHidden: boolean;
}

export interface PeopleListResponse {
  people: ImmichPerson[];
  total: number;
  visible: number;
  hidden: number;
}

export interface PersonUpdateDto {
  name?: string;
  birthDate?: string | null;
  isHidden?: boolean;
  featureFaceAssetId?: string;
}

// ── Search ──────────────────────────────────────────────────

export interface MetadataSearchDto {
  albumIds?: string[];
  type?: AssetType;
  isArchived?: boolean;
  isFavorite?: boolean;
  isVisible?: boolean;
  city?: string;
  state?: string;
  country?: string;
  make?: string;
  model?: string;
  takenAfter?: string;
  takenBefore?: string;
  createdAfter?: string;
  createdBefore?: string;
  deviceId?: string;
  personIds?: string[];
  page?: number;
  size?: number;
  order?: "asc" | "desc";
}

export interface SearchResponse {
  assets: {
    total: number;
    count: number;
    items: ImmichAsset[];
    facets: unknown[];
    nextPage?: string | null;
  };
}

// ── Client Config ───────────────────────────────────────────

export interface ImmichClientConfig {
  baseUrl: string;
  apiKey?: string;
}

// ── Error ───────────────────────────────────────────────────

export interface ImmichApiErrorData {
  message: string;
  statusCode: number;
  error?: string;
  correlationId?: string;
}
