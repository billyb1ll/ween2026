import React, { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Box, Flex, Text, Badge } from "@chakra-ui/react";

gsap.registerPlugin(useGSAP);

export interface MarqueeTickerProps {
  text: string;
  speed?: number; // pixels per second, default 65
  pauseOnHover?: boolean;
  badgeLabel?: string;
  previewMode?: boolean;
  className?: string;
}

export const MarqueeTicker: React.FC<MarqueeTickerProps> = ({
  text,
  speed = 65,
  pauseOnHover = true,
  badgeLabel = "ANNOUNCEMENT",
  previewMode = false,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  const displayBadge = previewMode ? "LIVE PREVIEW" : badgeLabel;

  useGSAP(
    () => {
      if (!trackRef.current || !containerRef.current) return;

      const track = trackRef.current;
      // Calculate width of one set of items (track contains 2 identical sets)
      const totalWidth = track.scrollWidth;
      const singleSetWidth = totalWidth / 2;

      if (singleSetWidth <= 0) return;

      // Calculate exact duration based on target speed (pixels / second)
      const duration = singleSetWidth / Math.max(10, speed);

      // Kill any previous tween on this track before creating new one
      if (tweenRef.current) {
        tweenRef.current.kill();
      }

      // Initial positioning reset
      gsap.set(track, { x: 0 });

      // Create seamless infinite horizontal animation tween
      tweenRef.current = gsap.to(track, {
        x: -singleSetWidth,
        duration: duration,
        ease: "none",
        repeat: -1,
        overwrite: "auto",
      });

      // Accessibility: handle prefers-reduced-motion
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: reduce)", () => {
        if (tweenRef.current) {
          tweenRef.current.pause();
          gsap.set(track, { x: 0 });
        }
      });

      return () => {
        mm.revert();
        if (tweenRef.current) {
          tweenRef.current.kill();
        }
      };
    },
    { scope: containerRef, dependencies: [text, speed] }
  );

  // Smooth Inertia Hover Mechanics using timeScale tweening
  const handleMouseEnter = () => {
    if (!pauseOnHover || !tweenRef.current) return;
    gsap.to(tweenRef.current, {
      timeScale: 0,
      duration: 0.6,
      ease: "power2.out",
      overwrite: true,
    });
  };

  const handleMouseLeave = () => {
    if (!pauseOnHover || !tweenRef.current) return;
    gsap.to(tweenRef.current, {
      timeScale: 1,
      duration: 0.6,
      ease: "power2.inOut",
      overwrite: true,
    });
  };

  // Construct items list per set
  const items = [text, text, text];

  return (
    <Box
      ref={containerRef}
      className={`modern-ticker-container ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      position="relative"
      width="100%"
      overflow="hidden"
      py={2}
      px={3}
      bg="rgba(254, 243, 199, 0.88)"
      backdropFilter="blur(12px)"
      borderBottom="1px solid"
      borderColor="amber.300/40"
      color="amber.950"
      display="flex"
      alignItems="center"
      userSelect="none"
      boxShadow="0 1px 3px rgba(120, 53, 15, 0.06)"
      style={{
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 4%, black 96%, transparent)",
        maskImage:
          "linear-gradient(to right, transparent, black 4%, black 96%, transparent)",
      }}
    >
      {/* Badge Indicator */}
      <Flex align="center" gap={1.5} mr={3} flexShrink={0} zIndex={2}>
        <Badge
          px={2.5}
          py={0.5}
          borderRadius="full"
          bg="amber.200"
          color="amber.900"
          fontSize="10px"
          fontWeight="800"
          letterSpacing="0.08em"
          textTransform="uppercase"
          display="inline-flex"
          alignItems="center"
          gap={1.5}
          boxShadow="inset 0 0 0 1px rgba(180, 83, 9, 0.2)"
        >
          <Box
            as="span"
            w="6px"
            h="6px"
            borderRadius="full"
            bg="amber.600"
            className="ticker-live-dot"
          />
          {displayBadge}
        </Badge>
      </Flex>

      {/* Ticker Track Container */}
      <Box flex={1} overflow="hidden" position="relative" display="flex" alignItems="center">
        <div
          ref={trackRef}
          className="modern-ticker-track"
          style={{
            display: "inline-flex",
            alignItems: "center",
            whiteSpace: "nowrap",
            willChange: "transform",
          }}
        >
          {/* Set 1 */}
          <Flex align="center" flexShrink={0}>
            {items.map((item, idx) => (
              <Flex key={`set1-${idx}`} align="center" flexShrink={0}>
                <Text
                  as="span"
                  fontSize="13px"
                  fontWeight="600"
                  letterSpacing="0.03em"
                  color="#78350f"
                  px={4}
                >
                  {item}
                </Text>
                <Text
                  as="span"
                  fontSize="10px"
                  color="amber.600"
                  opacity={0.6}
                  px={3}
                  aria-hidden="true"
                >
                  ✦
                </Text>
              </Flex>
            ))}
          </Flex>

          {/* Set 2 (Identical duplicate for seamless wrap) */}
          <Flex align="center" flexShrink={0}>
            {items.map((item, idx) => (
              <Flex key={`set2-${idx}`} align="center" flexShrink={0}>
                <Text
                  as="span"
                  fontSize="13px"
                  fontWeight="600"
                  letterSpacing="0.03em"
                  color="#78350f"
                  px={4}
                >
                  {item}
                </Text>
                <Text
                  as="span"
                  fontSize="10px"
                  color="amber.600"
                  opacity={0.6}
                  px={3}
                  aria-hidden="true"
                >
                  ✦
                </Text>
              </Flex>
            ))}
          </Flex>
        </div>
      </Box>
    </Box>
  );
};

export default MarqueeTicker;
