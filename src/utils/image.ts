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
