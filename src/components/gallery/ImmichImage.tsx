import { Image, Box } from '@chakra-ui/react';
import type { ImageProps } from '@chakra-ui/react';
import { useMemo, useState } from 'react';

interface ImmichImageProps extends Omit<ImageProps, 'src'> {
  endpoint: string;
  fallbackBg?: string;
}

export function ImmichImage({ endpoint, fallbackBg = "bg.muted", ...props }: ImmichImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [useProxyFallback, setUseProxyFallback] = useState(false);
  const [prevEndpoint, setPrevEndpoint] = useState(endpoint);

  if (prevEndpoint !== endpoint) {
    setPrevEndpoint(endpoint);
    setIsLoaded(false);
    setHasError(false);
    setUseProxyFallback(false);
  }

  const directUrl = useMemo(() => {
    if (!endpoint) return "";
    
    // Check if Immich server URL is configured for direct browser fetches (0 bytes Vercel bandwidth)
    const immichServerUrl = (
      import.meta.env.VITE_IMMICH_SERVER_URL || 
      import.meta.env.VITE_IMMICH_DIRECT_URL || 
      "https://immich.b1lly.tech"
    ).replace(/\/api\/?$/, "").replace(/\/+$/, "");

    const apiKey = 
      import.meta.env.VITE_IMMICH_VIEWER_API_KEY || 
      import.meta.env.VITE_IMMICH_API_KEY || 
      import.meta.env.VITE_IMMICH_KEY || 
      "3nDuRtCN93Hv936GYFONHrsEwxrjnsYwU4lStEfhWg";

    if (!useProxyFallback && immichServerUrl && endpoint.startsWith('/api/immich/')) {
      const pathSuffix = endpoint.substring('/api/immich'.length);
      const separator = pathSuffix.includes('?') ? '&' : '?';
      const keyParam = apiKey ? `${separator}apiKey=${apiKey}` : '';
      return `${immichServerUrl}/api${pathSuffix}${keyParam}`;
    }

    if (!endpoint.startsWith('/api/immich/')) {
      return endpoint;
    }
    const token = localStorage.getItem('baan7_session_token');
    const separator = endpoint.includes('?') ? '&' : '?';
    return `${endpoint}${separator}token=${token || ''}`;
  }, [endpoint, useProxyFallback]);

  const handleImageError = () => {
    if (!useProxyFallback && endpoint.startsWith('/api/immich/')) {
      console.warn(`[ImmichImage] Direct fetch failed for ${endpoint}, falling back to Vercel proxy.`);
      setUseProxyFallback(true);
    } else {
      setHasError(true);
    }
  };

  if (!directUrl || hasError) {
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
        src={directUrl} 
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
