import { Image, Box } from '@chakra-ui/react';
import type { ImageProps } from '@chakra-ui/react';
import { useState } from 'react';

interface ImmichImageProps extends Omit<ImageProps, 'src'> {
  endpoint: string;
  fallbackBg?: string;
}

/**
 * Renders an Immich image directly from the Immich origin server.
 * The `endpoint` must be a full absolute URL (e.g. https://immich.b1lly.tech/api/assets/{id}/thumbnail?apiKey=...).
 * No proxy fallback — 0 Vercel bandwidth guaranteed.
 */
export function ImmichImage({ endpoint, fallbackBg = "bg.muted", ...props }: ImmichImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [prevEndpoint, setPrevEndpoint] = useState(endpoint);

  if (prevEndpoint !== endpoint) {
    setPrevEndpoint(endpoint);
    setIsLoaded(false);
    setHasError(false);
  }

  const handleImageError = () => {
    setHasError(true);
  };

  if (!endpoint || hasError) {
    return (
      <Box
        bg={fallbackBg}
        display="flex"
        alignItems="center"
        justifyContent="center"
        aria-label="Image unavailable"
        {...props}
      >
        <Box as="span" className="material-symbols-outlined" fontSize="20px" color="fg.subtle" opacity={0.3}>
          account_circle
        </Box>
      </Box>
    );
  }

  const { objectFit, objectPosition, decoding, loading, alt, ...boxProps } = props;

  return (
    <Box
      {...boxProps}
      bg={fallbackBg}
      position="relative"
      overflow="hidden"
      _after={{
        content: '""',
        position: "absolute",
        inset: 0,
        bg: "inherit",
        opacity: isLoaded ? 0 : 1,
        transition: "opacity 0.4s var(--ease-out-quart, cubic-bezier(0.165, 0.84, 0.44, 1))",
        pointerEvents: "none",
        willChange: "opacity",
        zIndex: 1,
      }}
    >
      <Image 
        src={endpoint} 
        decoding={decoding || "async"}
        loading={loading}
        alt={alt}
        onLoad={() => setIsLoaded(true)}
        onError={handleImageError}
        w="100%"
        h="100%"
        objectFit={objectFit}
        objectPosition={objectPosition}
      />
    </Box>
  );
}
