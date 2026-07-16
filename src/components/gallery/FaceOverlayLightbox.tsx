import React from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Slideshow from "yet-another-react-lightbox/plugins/slideshow";
import Download from "yet-another-react-lightbox/plugins/download";
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

export const FaceOverlayLightbox: React.FC<FaceOverlayLightboxProps> = ({ open, close, index, assets, immichService, onView }) => {
  const slides = assets.map((asset) => {
    const token = localStorage.getItem('baan7_session_token') || '';
    return {
      src: `${immichService.assets.previewUrl(asset.id)}?token=${token}`,
      downloadUrl: `${immichService.assets.downloadUrl(asset.id)}?token=${token}`,
    };
  });

  return (
    <Lightbox
      open={open}
      close={close}
      index={index}
      slides={slides}
      plugins={[Zoom, Fullscreen, Slideshow, Download]}
      on={{
        view: ({ index }) => onView?.(index)
      }}
    />
  );
};
