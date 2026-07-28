import React, { useCallback } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Slideshow from "yet-another-react-lightbox/plugins/slideshow";
import Download from "yet-another-react-lightbox/plugins/download";
import type { Slide } from "yet-another-react-lightbox";
import type { ImmichAsset } from "../../lib/immich/types";
import type { ImmichService } from "../../lib/immich/index";

interface FaceOverlayLightboxProps {
  open: boolean;
  close: () => void;
  index: number;
  assets: ImmichAsset[];
  immichService: ImmichService;
  onView?: (index: number) => void;
}

/**
 * Custom download handler — fetches as Blob so the browser uses our filename
 * instead of deriving it from the URL (which causes "Unknown.jpg" on cross-origin requests).
 */
async function downloadAsBlob(
  saveAs: (source: string | Blob, name?: string) => void,
  url: string,
  filename: string
): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    saveAs(blob, filename);
  } catch {
    // Fallback: let the browser try to open/download directly
    window.open(url, "_blank");
  }
}

export const FaceOverlayLightbox: React.FC<FaceOverlayLightboxProps> = ({
  open,
  close,
  index,
  assets,
  immichService,
  onView,
}) => {
  // Build slides with correct download metadata
  const slides: Slide[] = assets.map((asset) => {
    const filename = asset.originalFileName || `immich-asset-${asset.id}.jpg`;
    const isDirectUrl =
      asset.originalPath?.startsWith("http://") ||
      asset.originalPath?.startsWith("https://") ||
      asset.id.startsWith("http://") ||
      asset.id.startsWith("https://") ||
      asset.id.startsWith("featured-");

    let src = isDirectUrl
      ? (asset.originalPath || asset.id)
      : immichService.assets.previewUrl(asset.id);

    if (src.includes("/api/assets/") && src.includes("/preview")) {
      src = src.replace(/\/api\/assets\/([^/]+)\/preview(\?|$)/, (_match, id, query) => {
        const existingParams = query.startsWith("?") ? query.substring(1) : "";
        const params = new URLSearchParams(existingParams);
        if (!params.has("size")) {
          params.set("size", "preview");
        }
        return `/api/assets/${id}/thumbnail?${params.toString()}`;
      });
    }

    let downloadUrl = isDirectUrl
      ? (asset.originalPath || asset.id)
      : immichService.assets.downloadUrl(asset.id);

    if (downloadUrl.includes("/api/assets/") && downloadUrl.includes("/preview")) {
      downloadUrl = downloadUrl.replace(/\/api\/assets\/([^/]+)\/preview(\?|$)/, (_match, id, query) => {
        const existingParams = query.startsWith("?") ? query.substring(1) : "";
        const params = new URLSearchParams(existingParams);
        if (!params.has("size")) {
          params.set("size", "preview");
        }
        return `/api/assets/${id}/thumbnail?${params.toString()}`;
      });
    }

    return {
      src,
      download: {
        url: downloadUrl,
        filename,
      },
    };
  });

  // Custom download handler: fetches the original as a Blob so browsers always
  // respect our filename, even for cross-origin URLs (Safari/Chrome "Unknown.jpg" fix).
  const handleDownload = useCallback(
    async ({
      slide,
      saveAs,
    }: {
      slide: Slide;
      saveAs: (source: string | Blob, name?: string) => void;
    }) => {
      const dl = (slide as Slide & { download?: { url: string; filename: string } }).download;
      const url = typeof dl === "object" && dl?.url ? dl.url : slide.src;
      const filename =
        typeof dl === "object" && dl?.filename ? dl.filename : "photo.jpg";
      await downloadAsBlob(saveAs, url, filename);
    },
    []
  );

  return (
    <Lightbox
      open={open}
      close={close}
      index={index}
      slides={slides}
      plugins={[Zoom, Fullscreen, Slideshow, Download]}
      download={{ download: handleDownload }}
      on={{
        view: ({ index: i }) => onView?.(i),
      }}
    />
  );
};
