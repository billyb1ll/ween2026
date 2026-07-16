import {
  Box,
  Flex,
  Heading,
  Text,
  VStack,
  Button,
  Spinner,
} from "@chakra-ui/react";
import React, { useState, useEffect } from "react";
import { immich } from "../lib/immich";
import type { ImmichAsset } from "../lib/immich";
import { VirtuosoGrid } from "react-virtuoso";
import { Link } from "react-router-dom";
import { useGalleryLightbox } from "../context/GalleryLightboxContext";
import { useAlbumMappings } from "../config/album-mapping";
import { ImmichImage } from "../components/gallery/ImmichImage";



export function GalleryPage() {
  const { mappings, loading: loadingMappings } = useAlbumMappings();
  const [activeDay, setActiveDay] = useState<string>("");
  const [photos, setPhotos] = useState<ImmichAsset[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [isAtTop, setIsAtTop] = useState(true);
  
  // Track window scroll for jump to top button
  useEffect(() => {
    const handleScroll = () => {
      // If we're within 400px of the top, consider it at the top
      const scrolledToTop = window.scrollY <= 400;
      setIsAtTop(scrolledToTop);
    };
    
    window.addEventListener("scroll", handleScroll);
    // Call once to initialize correctly
    handleScroll();
    
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  
  // Lightbox from global context
  const { openLightbox, virtuosoRef } = useGalleryLightbox();

  // Set default active tab when mappings load
  useEffect(() => {
    if (!activeDay && mappings.length > 0) {
      // eslint-disable-next-line
      setActiveDay(mappings[0].key);
    }
  }, [mappings, activeDay]);


  useEffect(() => {
    if (!activeDay || mappings.length === 0) return;

    const fetchPhotos = async () => {
      setLoadingPhotos(true);
      setPhotos([]);
      try {
        const mapping = mappings.find(m => m.key === activeDay);
        
        let album = null;
        if (mapping?.immichAlbumId) {
          album = await immich.albums.getById(mapping.immichAlbumId);
        } else if (mapping?.immichAlbumName) {
          album = await immich.albums.findByName(mapping.immichAlbumName);
        } else {
          console.warn(`No valid mapping found for ${activeDay}`);
          return;
        }

        if (album) {
          try {
            const assets = await immich.albums.getAssets(album.id);
            setPhotos(assets);
          } catch (err) {
            console.error("Error fetching album assets:", err);
            // fallback if getAssets fails
            if (album.assets && album.assets.length > 0) {
              setPhotos(album.assets);
            } else {
              const fullAlbum = await immich.albums.getById(album.id);
              setPhotos(fullAlbum.assets || []);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching gallery photos:", err);
      } finally {
        setLoadingPhotos(false);
      }
    };
    
    fetchPhotos();
  }, [activeDay, mappings]);

  const activeAssets = photos;
  const loadingActiveAssets = loadingPhotos;

  if (loadingMappings) {
    return (
      <Flex minH="100vh" align="center" justify="center">
        <Spinner size="xl" color="brand.900" />
      </Flex>
    );
  }

  return (
    <Flex direction="column" position="relative" zIndex={10} maxW="var(--container-max)" mx="auto" px={{ base: 4, md: 16 }} pt={{ base: 2, md: 28 }} pb={{ base: 4, md: 20 }} minH="100vh">
      


      <VStack gap={2} mb={{ base: 6, md: 8 }} animation="fade-in-up 0.6s var(--ease-out-expo) both">
        <Heading as="h1" fontFamily="'Playfair Display', serif" fontSize={{ base: "2rem", md: "3.5rem" }} fontWeight={700} lineHeight={1.1} letterSpacing="-0.02em" color="brand.900" textAlign="center">
          Baan 7 Gallery
        </Heading>
        <Text color="fg.muted" fontSize={{ base: "sm", md: "lg" }} textAlign="center" maxW="lg">
          Relive the moments. View photos from our orientation activities.
        </Text>
      </VStack>

      <Box mb={8} animation="fade-in-up 0.7s var(--ease-out-expo) both">
        <Link to="/face-claim">
          <Flex w="100%" bg="bg.canvas" border="2px dashed" borderColor="accent.solid" borderRadius="xl" p={{ base: 4, md: 5 }} align="center" justify="center" transition="all 0.3s var(--ease-out-quart)" _hover={{ bg: "color-mix(in srgb, var(--chakra-colors-accent-solid) 4%, var(--chakra-colors-bg-canvas) 96%)", transform: "translateY(-2px)", boxShadow: "var(--shadow-card-hover)" }}>
            <Box as="span" className="material-symbols-outlined" fontSize="24px" color="brand.900" mr={3}>person_search</Box>
            <Text color="brand.900" fontWeight="700" fontSize={{ base: "sm", md: "md" }} letterSpacing="0.02em" textAlign="center" maxW="70ch">
              Cannot find your photos? Try searching for your face using our AI face finder. (Face claiming is currently in testing/Beta).
            </Text>
          </Flex>
        </Link>
      </Box>

      {/* Daily Control Bar Tabs */}
      <Flex justify="center" mb={6} gap={2} wrap="wrap">
        {mappings.map((m) => (
          <Button
            key={m.key}
            onClick={() => {
              setActiveDay(m.key);
            }}
            h="44px" px={6} py={2} borderRadius="full" fontWeight="600" fontSize="sm"
            variant={activeDay === m.key ? 'solid' : 'outline'}
            bg={activeDay === m.key ? 'accent.solid' : 'transparent'}
            color="brand.900"
            borderColor="accent.solid"
            _hover={{ bg: activeDay === m.key ? 'accent.solid' : 'color-mix(in srgb, var(--chakra-colors-accent-solid) 5%, transparent)' }}
          >
            {m.label}
          </Button>
        ))}
      </Flex>



      {/* Main Photo Layout Grid with Virtuoso */}
      <Text fontSize="xs" fontWeight="700" color="fg.muted" mb={4} textTransform="uppercase" letterSpacing="0.05em">
        {mappings.find(m => m.key === activeDay)?.label || "Gallery"}
      </Text>

      {loadingActiveAssets ? (
        <Flex justify="center" py={12}><Text color="fg.subtle">Loading photos...</Text></Flex>
      ) : activeAssets.length === 0 ? (
        <Flex justify="center" py={12} bg="bg.surface" border="1px dashed" borderColor="border.subtle" borderRadius="2xl">
          <Text color="fg.subtle">No photos found in this view.</Text>
        </Flex>
      ) : (
        <Box flex="1" w="100%">
          <VirtuosoGrid
            ref={virtuosoRef}
            data={activeAssets}
            useWindowScroll
            components={{
              List: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ style, children, ...props }, ref) => (
                <Box ref={ref} style={style} {...props} display="grid" gridTemplateColumns={{ base: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", md: "repeat(4, 1fr)" }} gap={4}>
                  {children}
                </Box>
              )),
              Item: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
                <Box {...props} h={{ base: "160px", sm: "200px", md: "240px" }} borderRadius="xl" overflow="hidden" cursor="pointer" transition="transform 0.3s" _hover={{ transform: "translateY(-2px)" }}>
                  {children}
                </Box>
              )
            }}
            itemContent={(index, asset) => (
              <ImmichImage 
                endpoint={immich.assets.thumbnailUrl(asset.id, "thumbnail")} 
                alt="Gallery photo" 
                w="100%" h="100%" objectFit="cover" loading="lazy" 
                onClick={() => openLightbox(index, activeAssets)}
              />
            )}
          />
          {/* Jump to top button */}
          {!isAtTop && (
            <Button
              position="fixed"
              bottom="8"
              left="50%"
              transform="translateX(-50%)"
              borderRadius="full"
              size="sm"
              shadow="xl"
              bg="bg.surface"
              color="brand.900"
              borderColor="accent.solid"
              borderWidth="1px"
              onClick={() => {
                if (virtuosoRef.current) {
                  virtuosoRef.current.scrollToIndex({
                    index: 0,
                    behavior: "smooth",
                    align: "start",
                  });
                } else {
                  window.scrollTo({
                    top: 0,
                    behavior: "smooth",
                  });
                }
              }}
              px={5}
              py={2}
              _hover={{ bg: "accent.solid", color: "brand.900" }}
              zIndex="100"
              animation="fade-in-up 0.2s var(--ease-out-quart) both"
            >
              <Box className="material-symbols-outlined" fontSize="sm" mr={1}>
                arrow_upward
              </Box>
              Jump to latest
            </Button>
          )}
        </Box>
      )}

    </Flex>
  );
}
