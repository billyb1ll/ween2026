import { useEffect, useRef, useState } from "react";
import { Box, Flex, Heading, Text, HStack, Badge } from "@chakra-ui/react";
import { supabase } from "../lib/supabase";
import { useGalleryLightbox } from "../context/GalleryLightboxContext";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { ImmichAsset } from "../lib/immich/types";

gsap.registerPlugin(ScrollTrigger);

interface CarouselImage {
  url: string;
  alt?: string;
}

function parsePhotoUrls(raw: string | null): CarouselImage[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is string | { url: string; alt?: string } =>
          typeof item === "string" ||
          (typeof item === "object" && item !== null && "url" in item),
      )
      .map((item) =>
        typeof item === "string" ? { url: item, alt: "Featured photo" } : item,
      );
  } catch {
    return [];
  }
}

export function FeaturedCarousel() {
  const [images, setImages] = useState<CarouselImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMobileIndex, setActiveMobileIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const marqueeTrackRef = useRef<HTMLDivElement>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const { openLightbox } = useGalleryLightbox();

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    let active = true;
    const fetchPhotos = async () => {
      try {
        const { data, error } = await supabase
          .from("system_config")
          .select("text_value")
          .eq("key", "featured_photo_urls")
          .maybeSingle();
        if (!error && data && active) {
          const parsed = parsePhotoUrls(data.text_value);
          setImages(parsed);
        }
      } catch (err) {
        console.error("FeaturedCarousel: failed to fetch photos", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchPhotos();

    const syncChannel = supabase.channel("live_chat:system_config_sync");
    syncChannel
      .on("broadcast", { event: "config_change" }, (payload) => {
        if (active && payload.payload?.key === "featured_photo_urls") {
          const parsed = parsePhotoUrls(payload.payload.text_value ?? null);
          setImages(parsed);
        }
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(syncChannel);
    };
  }, []);

  // GSAP Animations (ScrollTrigger + Continuous Marquee)
  useEffect(() => {
    if (loading || images.length === 0 || prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      // 1. Entrance animation on scroll
      gsap.from(".featured-photo-card", {
        opacity: 0,
        y: 40,
        scale: 0.92,
        duration: 0.8,
        stagger: 0.08,
        ease: "power3.out",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 85%",
          once: true,
        },
      });

      // 2. Continuous smooth Marquee for desktop
      if (marqueeTrackRef.current) {
        tweenRef.current = gsap.to(marqueeTrackRef.current, {
          xPercent: -50,
          repeat: -1,
          duration: Math.max(20, images.length * 5),
          ease: "none",
        });
      }
    }, containerRef);

    return () => {
      ctx.revert();
    };
  }, [loading, images, prefersReducedMotion]);

  if (loading || images.length === 0) return null;

  // Convert images to ImmichAsset format for Lightbox preview
  const immichAssets: ImmichAsset[] = images.map((img, idx) => ({
    id: `featured-${idx}`,
    deviceAssetId: `featured-${idx}`,
    ownerId: "system",
    deviceId: "system",
    type: "IMAGE",
    originalPath: img.url,
    originalFileName: img.alt || `featured-${idx}.jpg`,
    resized: false,
    checksum: `featured-${idx}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fileCreatedAt: new Date().toISOString(),
    fileModifiedAt: new Date().toISOString(),
    localDateTime: new Date().toISOString(),
    isFavorite: false,
    isArchived: false,
    isTrashed: false,
    isOffline: false,
    duration: "0",
    exifInfo: {},
  }));

  const handleCardClick = (idx: number) => {
    openLightbox(idx % images.length, immichAssets);
  };

  const handleMouseEnter = () => {
    tweenRef.current?.pause();
  };

  const handleMouseLeave = () => {
    tweenRef.current?.play();
  };

  // Duplicate list for seamless infinite marquee loop
  const displayImages = [...images, ...images];

  return (
    <Box
      ref={containerRef}
      id="featured-photos-section"
      as="section"
      mb={{ base: 8, md: 14 }}
      aria-label="Featured photos"
      position="relative"
    >
      {/* Background Ambient Glow */}
      <Box
        position="absolute"
        top="-20%"
        left="50%"
        transform="translateX(-50%)"
        w="70%"
        h="140%"
        bg="radial-gradient(ellipse at center, color-mix(in srgb, var(--chakra-colors-accent-solid) 10%, transparent) 0%, transparent 70%)"
        pointerEvents="none"
        zIndex={0}
      />

      {/* Header */}
      <Flex align="center" justify="space-between" mb={{ base: 4, md: 6 }} position="relative" zIndex={1}>
        <HStack gap={3}>
          <Box w={8} h="2px" bg="brand.solid" borderRadius="full" />
          <Heading
            as="h2"
            fontFamily="'Playfair Display', serif"
            fontSize={{ base: "1.4rem", md: "1.85rem" }}
            fontWeight={700}
            color="brand.900"
            letterSpacing="-0.02em"
          >
            Featured Moments
          </Heading>
        </HStack>
        <Badge
          bg="bg.surface"
          border="1px solid"
          borderColor="border.subtle"
          color="fg.subtle"
          px={3}
          py={1}
          borderRadius="full"
          fontSize="xs"
          fontWeight="600"
          display={{ base: "none", sm: "flex" }}
        >
          {images.length} Highlights
        </Badge>
      </Flex>

      {prefersReducedMotion ? (
        /* Reduced Motion Fallback Grid */
        <Box
          display="grid"
          gridTemplateColumns={{ base: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }}
          gap={3}
          position="relative"
          zIndex={1}
        >
          {images.slice(0, 4).map((img, i) => (
            <Box
              key={i}
              className="featured-photo-card"
              borderRadius="2xl"
              overflow="hidden"
              aspectRatio="1"
              bg="bg.surface"
              border="1px solid"
              borderColor="border.subtle"
              cursor="pointer"
              onClick={() => handleCardClick(i)}
            >
              <img
                src={img.url}
                alt={img.alt ?? `Featured photo ${i + 1}`}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                loading="lazy"
              />
            </Box>
          ))}
        </Box>
      ) : (
        <>
          {/* MOBILE VIEW (<768px): Touch horizontal scroll deck */}
          <Box display={{ base: "block", md: "none" }} position="relative" zIndex={1}>
            <Flex
              gap={3.5}
              overflowX="auto"
              pb={4}
              pt={1}
              px={1}
              style={{
                scrollSnapType: "x mandatory",
                WebkitOverflowScrolling: "touch",
                scrollbarWidth: "none",
              }}
              onScroll={(e) => {
                const target = e.currentTarget;
                const index = Math.round(target.scrollLeft / 220);
                setActiveMobileIndex(Math.min(index, images.length - 1));
              }}
            >
              {images.map((img, i) => (
                <Box
                  key={i}
                  className="featured-photo-card"
                  flexShrink={0}
                  w="220px"
                  h="160px"
                  borderRadius="2xl"
                  overflow="hidden"
                  bg="bg.surface"
                  border="1.5px solid"
                  borderColor="border.subtle"
                  boxShadow="0 8px 24px color-mix(in srgb, var(--chakra-colors-brand-900) 8%, transparent)"
                  position="relative"
                  cursor="pointer"
                  onClick={() => handleCardClick(i)}
                  style={{ scrollSnapAlign: "start" }}
                  _active={{ transform: "scale(0.97)" }}
                >
                  <img
                    src={img.url}
                    alt={img.alt ?? `Featured moment ${i + 1}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    loading="lazy"
                  />
                  {/* Subtle Gradient Overlay */}
                  <Box
                    position="absolute"
                    inset={0}
                    bg="linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)"
                  />
                  <Flex
                    position="absolute"
                    bottom={2.5}
                    left={3}
                    right={3}
                    justify="space-between"
                    align="center"
                    color="white"
                  >
                    <Text fontSize="xs" fontWeight="600" truncate maxW="140px">
                      {img.alt || `Moment #${i + 1}`}
                    </Text>
                    <Box as="span" className="material-symbols-outlined" fontSize="16px">
                      zoom_in
                    </Box>
                  </Flex>
                </Box>
              ))}
            </Flex>

            {/* Mobile Touch Indicator Pill */}
            <Flex justify="center" align="center" gap={1.5} mt={1}>
              {images.map((_, i) => (
                <Box
                  key={i}
                  w={activeMobileIndex === i ? "16px" : "6px"}
                  h="6px"
                  bg={activeMobileIndex === i ? "brand.solid" : "border.default"}
                  borderRadius="full"
                  transition="all 0.3s var(--ease-out-quart)"
                />
              ))}
            </Flex>
          </Box>

          {/* DESKTOP VIEW (>=768px): GSAP Infinite Marquee Track with Hover Pause */}
          <Box
            display={{ base: "none", md: "block" }}
            position="relative"
            zIndex={1}
            overflow="hidden"
            borderRadius="3xl"
            p={2}
            bg="whiteAlpha.600"
            backdropFilter="blur(12px)"
            border="1px solid"
            borderColor="border.subtle"
            boxShadow="0 16px 40px color-mix(in srgb, var(--chakra-colors-brand-900) 6%, transparent)"
            style={{
              WebkitMaskImage:
                "linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)",
              maskImage:
                "linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)",
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div
              ref={marqueeTrackRef}
              style={{
                display: "flex",
                gap: "16px",
                width: "max-content",
                willChange: "transform",
              }}
            >
              {displayImages.map((img, i) => (
                <Box
                  key={i}
                  className="featured-photo-card"
                  flexShrink={0}
                  w="260px"
                  h="180px"
                  borderRadius="2xl"
                  overflow="hidden"
                  bg="bg.surface"
                  border="1px solid"
                  borderColor="border.subtle"
                  position="relative"
                  cursor="pointer"
                  onClick={() => handleCardClick(i)}
                  transition="all 0.35s var(--ease-out-quart)"
                  _hover={{
                    transform: "translateY(-4px) scale(1.03)",
                    boxShadow: "0 14px 32px color-mix(in srgb, var(--chakra-colors-brand-solid) 20%, transparent)",
                    borderColor: "brand.solid",
                    "& .zoom-icon": { opacity: 1, transform: "scale(1)" },
                  }}
                >
                  <img
                    src={img.url}
                    alt={img.alt ?? `Featured moment ${i + 1}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    loading="lazy"
                  />

                  {/* Dark Glass Overlay on Hover */}
                  <Flex
                    position="absolute"
                    inset={0}
                    bg="rgba(0,0,0,0.3)"
                    opacity={0}
                    transition="all 0.3s"
                    align="center"
                    justify="center"
                    _hover={{ opacity: 1 }}
                  >
                    <Flex
                      className="zoom-icon"
                      w="40px"
                      h="40px"
                      bg="brand.solid"
                      color="white"
                      borderRadius="full"
                      align="center"
                      justify="center"
                      boxShadow="0 4px 16px rgba(0,0,0,0.3)"
                      opacity={0}
                      transform="scale(0.8)"
                      transition="all 0.3s var(--ease-out-quart)"
                    >
                      <Box as="span" className="material-symbols-outlined" fontSize="20px">
                        fullscreen
                      </Box>
                    </Flex>
                  </Flex>

                  {/* Badge */}
                  <Box
                    position="absolute"
                    bottom={2.5}
                    left={3}
                    bg="rgba(0,0,0,0.6)"
                    backdropFilter="blur(4px)"
                    color="white"
                    px={2.5}
                    py={0.5}
                    borderRadius="md"
                    fontSize="10px"
                    fontWeight="700"
                    letterSpacing="0.04em"
                  >
                    BAAN 7
                  </Box>
                </Box>
              ))}
            </div>
          </Box>
        </>
      )}
    </Box>
  );
}
