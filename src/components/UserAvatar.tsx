import { Box, Image, Text } from "@chakra-ui/react";
import { useState } from "react";
import { getAvatarUrl } from "../utils/image";

interface UserAvatarProps {
  src?: string | null;
  name: string;
  avatarColor?: string;
  size?: string | number | Record<string, string | number>;
  fontSize?: string | number | Record<string, string | number>;
  borderRadius?: string;
  border?: string;
  borderColor?: string;
  boxShadow?: string;
  onClick?: () => void;
  cursor?: string;
  fallback?: React.ReactNode;
}

export function UserAvatar({
  src,
  name,
  avatarColor = "#496268",
  size = "32px",
  fontSize = "xs",
  borderRadius = "full",
  border,
  borderColor,
  boxShadow,
  onClick,
  cursor,
  fallback,
}: UserAvatarProps) {
  const [prevSrc, setPrevSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  if (src !== prevSrc) {
    setPrevSrc(src);
    setHasError(false);
  }

  const resolvedSrc = getAvatarUrl(src);


  const getInitials = (n: string) => {
    const parts = n.trim().split(/\s+/);
    if (parts.length === 0 || !parts[0]) return "?";
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const containerProps = {
    w: size,
    h: size,
    minW: size,
    minH: size,
    borderRadius,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    bg: resolvedSrc && !hasError ? "transparent" : avatarColor,
    color: "white",
    border,
    borderColor,
    boxShadow,
    onClick,
    cursor,
    as: onClick ? ("button" as const) : undefined,
  };

  if (resolvedSrc && !hasError) {
    return (
      <Box {...containerProps}>
        <Image
          src={resolvedSrc}
          alt={name}
          w="100%"
          h="100%"
          objectFit="cover"
          loading="lazy"
          onError={() => setHasError(true)}
        />
      </Box>
    );
  }

  return (
    <Box {...containerProps}>
      {fallback ? (
        fallback
      ) : (
        <Text fontSize={fontSize} fontWeight="700">
          {getInitials(name)}
        </Text>
      )}
    </Box>
  );
}
