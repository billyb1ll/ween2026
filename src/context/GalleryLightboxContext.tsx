import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import type { ImmichAsset } from '../lib/immich/types';
import type { VirtuosoGridHandle } from 'react-virtuoso';
import { FaceOverlayLightbox } from '../components/gallery/FaceOverlayLightbox';
import { createImmichService } from '../lib/immich';

interface GalleryLightboxContextType {
  openLightbox: (index: number, assets: ImmichAsset[]) => void;
  virtuosoRef: React.RefObject<VirtuosoGridHandle | null>;
}

export const GalleryLightboxContext = createContext<GalleryLightboxContextType | null>(null);

const immich = createImmichService({ baseUrl: "/api/immich" });

export const GalleryLightboxProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [lightboxAssets, setLightboxAssets] = useState<ImmichAsset[]>([]);
  const virtuosoRef = useRef<VirtuosoGridHandle>(null);

  const openLightbox = useCallback((index: number, assets: ImmichAsset[]) => {
    setLightboxIndex(index);
    setLightboxAssets(assets);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    const scrollY = window.scrollY; // Capture scroll before closing
    setLightboxOpen(false);

    // Use requestAnimationFrame to ensure the overlay is unmounted from DOM
    requestAnimationFrame(() => {
      if (virtuosoRef.current && lightboxIndex >= 0) {
        virtuosoRef.current.scrollToIndex({ index: lightboxIndex, align: 'center', behavior: 'auto' });
      } else {
        // Fallback: restore exact scroll position
        window.scrollTo(0, scrollY);
      }
    });
  }, [lightboxIndex]);

  return (
    <GalleryLightboxContext.Provider value={{ openLightbox, virtuosoRef }}>
      {children}
      <FaceOverlayLightbox
        open={lightboxOpen}
        close={closeLightbox}
        index={lightboxIndex}
        assets={lightboxAssets}
        immichService={immich}
        onView={(idx) => setLightboxIndex(idx)}
      />
    </GalleryLightboxContext.Provider>
  );
};

export const useGalleryLightbox = () => {
  const context = useContext(GalleryLightboxContext);
  if (!context) throw new Error("useGalleryLightbox must be used within GalleryLightboxProvider");
  return context;
};
