/**
 * Compresses an image file on the client side using HTML5 Canvas.
 * Resizes the image to fit within maxW x maxH maintaining aspect ratio,
 * and recursively lowers quality until the size is under maxSizeBytes.
 */
export async function compressImage(
  file: File,
  maxW = 1024,
  maxH = 1024,
  maxSizeBytes = 500 * 1024,
): Promise<Blob> {
  return new Promise((resolve) => {
    // Only compress image files
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Resize if it exceeds dimensions
        if (width > maxW || height > maxH) {
          if (width > height) {
            height = Math.round((height * maxW) / width);
            width = maxW;
          } else {
            width = Math.round((width * maxH) / height);
            height = maxH;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const quality = 0.8;
        const getBlob = (q: number): Promise<Blob> => {
          return new Promise((res) => {
            canvas.toBlob(
              (blob) => {
                if (blob) res(blob);
                else res(file);
              },
              "image/jpeg",
              q,
            );
          });
        };

        const tryCompress = async (q: number) => {
          const blob = await getBlob(q);
          if (blob.size <= maxSizeBytes || q <= 0.1) {
            resolve(blob);
          } else {
            await tryCompress(q - 0.1);
          }
        };

        tryCompress(quality).catch(() => resolve(file));
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
}

/**
 * Resolves a profile picture URL to a fully-qualified URL if it's relative
 * or formatted for older storage systems.
 */
export function getAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  // If it's already an absolute URL, return it
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  // If it's a relative Immich proxy path, map it to direct Immich origin
  if (url.startsWith("/api/immich/")) {
    const directImmichUrl = (
      import.meta.env.VITE_IMMICH_SERVER_URL ||
      import.meta.env.VITE_IMMICH_DIRECT_URL ||
      "https://immich.b1lly.tech"
    ).replace(/\/api\/?$/, "").replace(/\/+$/, "");
    return `${directImmichUrl}/api/${url.substring(12)}`;
  }

  // For Supabase paths (relative bucket path or filename)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://gyabqyvdxdtoaqayfjho.supabase.co";

  let cleanPath = url.trim();
  if (cleanPath.startsWith("/")) {
    cleanPath = cleanPath.substring(1);
  }

  // If it is already a storage path, prepend supabase URL
  if (cleanPath.startsWith("storage/v1/object/public/")) {
    return `${supabaseUrl}/${cleanPath}`;
  }

  // If it starts with profiles/
  if (cleanPath.startsWith("profiles/")) {
    return `${supabaseUrl}/storage/v1/object/public/${cleanPath}`;
  }

  // Default fallback: assume it is a filename in the "profiles" bucket
  return `${supabaseUrl}/storage/v1/object/public/profiles/${cleanPath}`;
}

/**
 * Extracts a numeric timestamp (ms since epoch) representing the shoot/capture time
 * of an Immich asset using EXIF dateTimeOriginal, fileCreatedAt, localDateTime, or createdAt.
 */
export function getAssetShootTime(asset: {
  exifInfo?: { dateTimeOriginal?: string | null };
  fileCreatedAt?: string | null;
  localDateTime?: string | null;
  createdAt?: string | null;
  fileModifiedAt?: string | null;
} | null | undefined): number {
  if (!asset) return 0;
  if (asset.exifInfo?.dateTimeOriginal) {
    const t = new Date(asset.exifInfo.dateTimeOriginal).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  if (asset.fileCreatedAt) {
    const t = new Date(asset.fileCreatedAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  if (asset.localDateTime) {
    const t = new Date(asset.localDateTime).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  if (asset.createdAt) {
    const t = new Date(asset.createdAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  if (asset.fileModifiedAt) {
    const t = new Date(asset.fileModifiedAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  return 0;
}

