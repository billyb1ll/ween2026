import { toPng, toBlob } from "html-to-image";
import saveAs from "file-saver";
import { supabase } from "../lib/supabase";

export interface ExportPosterOptions {
  fileName?: string;
  pixelRatio?: number;
  quality?: number;
}

const exportFilter = (node: Node): boolean => {
  if (node instanceof HTMLElement && node.dataset.exportIgnore === "true") {
    return false;
  }
  return true;
};

/**
 * Capture an offscreen/onscreen HTML Element and trigger a local file download.
 * Temporarily resets scale transforms to ensure zero extra white margins or scaling artifacts.
 */
export async function downloadElementAsPng(
  element: HTMLElement,
  options: ExportPosterOptions = {}
): Promise<string> {
  const { fileName = `memory-board-poster-${Date.now()}.png`, pixelRatio = 3, quality = 1.0 } = options;

  // Save preview transform styles
  const originalTransform = element.style.transform;
  const originalTransformOrigin = element.style.transformOrigin;

  let dataUrl: string;

  try {
    // Reset transform so element is captured at native 100% scale without white borders
    element.style.transform = "none";
    element.style.transformOrigin = "initial";

    const width = element.offsetWidth || element.clientWidth;
    const height = element.offsetHeight || element.clientHeight;

    try {
      // Attempt 1: Maximum high-DPI resolution export (e.g. 3x or 4x pixelRatio)
      dataUrl = await toPng(element, {
        quality,
        pixelRatio,
        width,
        height,
        cacheBust: false,
        filter: exportFilter,
        skipFonts: true,
      });
    } catch (firstErr) {
      console.warn("[PosterExport] Maximum resolution export attempt failed, retrying fallback...", firstErr);
      // Attempt 2: Fallback export at 2.0x pixelRatio
      dataUrl = await toPng(element, {
        quality: 0.95,
        pixelRatio: 2.0,
        width,
        height,
        cacheBust: false,
        filter: exportFilter,
        skipFonts: true,
      });
    }

    saveAs(dataUrl, fileName);
    return dataUrl;
  } finally {
    // Restore studio preview transform
    element.style.transform = originalTransform;
    element.style.transformOrigin = originalTransformOrigin;
  }
}

/**
 * Capture an element as a Blob and upload it directly to Supabase Storage.
 * Temporarily resets scale transforms to ensure zero extra white margins or scaling artifacts.
 */
export async function uploadElementToSupabaseStorage(
  element: HTMLElement,
  bucketName: string = "memory-cards",
  options: ExportPosterOptions = {}
): Promise<{ publicUrl: string | null; path: string }> {
  const { fileName = `poster-${Date.now()}.png`, pixelRatio = 3, quality = 1.0 } = options;

  // Save preview transform styles
  const originalTransform = element.style.transform;
  const originalTransformOrigin = element.style.transformOrigin;

  let blob: Blob | null = null;

  try {
    // Reset transform so element is captured at native 100% scale without white borders
    element.style.transform = "none";
    element.style.transformOrigin = "initial";

    const width = element.offsetWidth || element.clientWidth;
    const height = element.offsetHeight || element.clientHeight;

    try {
      blob = await toBlob(element, {
        quality,
        pixelRatio,
        width,
        height,
        cacheBust: false,
        filter: exportFilter,
        skipFonts: true,
      });
    } catch (firstErr) {
      console.warn("[PosterExport] Blob generation failed, retrying fallback...", firstErr);
      blob = await toBlob(element, {
        quality: 0.95,
        pixelRatio: 2.0,
        width,
        height,
        cacheBust: false,
        filter: exportFilter,
        skipFonts: true,
      });
    }

    if (!blob) {
      throw new Error("Failed to generate image blob from element.");
    }

    const filePath = `posters/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, blob, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);

    return {
      publicUrl: publicUrlData?.publicUrl ?? null,
      path: filePath,
    };
  } finally {
    // Restore studio preview transform
    element.style.transform = originalTransform;
    element.style.transformOrigin = originalTransformOrigin;
  }
}
