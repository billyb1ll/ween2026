import { useEffect, useRef, useState } from "react";
import { Box, Flex, Heading, Text } from "@chakra-ui/react";
import { supabase } from "../lib/supabase";
import { useReducedMotion } from "framer-motion";

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
      .filter((item): item is string | { url: string; alt?: string } =>
        typeof item === "string" || (typeof item === "object" && item !== null && "url" in item)
      )
      .map((item) =>
        typeof item === "string" ? { url: item, alt: "Featured photo" } : item
      );
  } catch {
    return [];
  }
}

export function FeaturedCarousel() {
  const [images, setImages] = useState<CarouselImage[]>([]);
  const [loading, setLoading] = useState(true);
  const shouldReduceMotion = useReducedMotion() ?? false;
  const trackRef = useRef<HTMLDivElement>(null);

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
        if (
          active &&
          payload.payload?.key === "featured_photo_urls"
        ) {
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

  // Nothing to render if loading or no images configured
  if (loading || images.length === 0) return null;

  // Duplicate the array to create a seamless loop
  const displayImages = [...images, ...images, ...images];

  return (
    <Box
      as="section"
      mb={10}
      aria-label="Featured photos"
      overflow="hidden"
      position="relative"
    >
      {/* Header */}
      <Flex align="center" gap={4} mb={5}>
        <Box as="span" w={8} h="1px" bg="border.default" flexShrink={0} />
        <Heading
          as="h2"
          fontFamily="'Playfair Display', serif"
          fontSize={{ base: "1.25rem", md: "1.5rem" }}
          fontWeight={600}
          lineHeight={1.3}
          color="fg.default"
        >
          From the Event
        </Heading>
      </Flex>

      {shouldReduceMotion ? (
        /* Reduced motion: static 2-column grid */
        <Box
          display="grid"
          gridTemplateColumns={{ base: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }}
          gap={3}
        >
          {images.slice(0, 4).map((img, i) => (
            <Box
              key={i}
              borderRadius="xl"
              overflow="hidden"
              aspectRatio="1"
              bg="bg.surface"
            >
              <img
                src={img.url}
                alt={img.alt ?? `Featured photo ${i + 1}`}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                loading="lazy"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </Box>
          ))}
        </Box>
      ) : (
        /* Animated auto-scroll strip */
        <Box
          position="relative"
          style={{
            WebkitMaskImage:
              "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
            maskImage:
              "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
          }}
        >
          <div ref={trackRef} className="carousel-track">
            {displayImages.map((img, i) => (
              <Box
                key={i}
                as="figure"
                m={0}
                flexShrink={0}
                w={{ base: "160px", md: "220px" }}
                h={{ base: "120px", md: "160px" }}
                borderRadius="xl"
                overflow="hidden"
                bg="bg.surface"
                border="1px solid"
                borderColor="border.subtle"
              >
                <img
                  src={img.url}
                  alt={img.alt ?? `Featured photo`}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              </Box>
            ))}
          </div>
          <Text
            fontSize="2xs"
            color="fg.subtle"
            fontWeight={600}
            textAlign="right"
            mt={2}
            pr={1}
            letterSpacing="0.05em"
          >
            Baan 7 · 2026
          </Text>
        </Box>
      )}
    </Box>
  );
}
