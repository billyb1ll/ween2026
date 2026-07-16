import { Image, Box } from '@chakra-ui/react';
import type { ImageProps } from '@chakra-ui/react';
import { useMemo, useState } from 'react';

interface ImmichImageProps extends Omit<ImageProps, 'src'> {
  endpoint: string;
  fallbackBg?: string;
}

export function ImmichImage({ endpoint, fallbackBg = "bg.muted", ...props }: ImmichImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  const directUrl = useMemo(() => {
    if (!endpoint) return "";
    if (!endpoint.startsWith('/api/immich/')) {
      return endpoint;
    }
    const token = localStorage.getItem('baan7_session_token');
    const separator = endpoint.includes('?') ? '&' : '?';
    return `${endpoint}${separator}token=${token || ''}`;
  }, [endpoint]);

  if (!directUrl) {
    return <Box bg={fallbackBg} aria-label="Error loading image" {...props} />;
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
        w="100%"
        h="100%"
        objectFit={objectFit}
        objectPosition={objectPosition}
      />
    </Box>
  );
}
