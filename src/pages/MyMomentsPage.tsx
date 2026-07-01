import {
  Box,
  Flex,
  Heading,
  Text,
  VStack,
  Image,
  Spinner,
} from "@chakra-ui/react";
import React, { useState, useEffect } from "react";
import { useUser } from "../context/UserContext";
import { immich } from "../lib/immich";
import type { ImmichAsset } from "../lib/immich";
import { VirtuosoGrid } from "react-virtuoso";
import { useGalleryLightbox } from "../context/GalleryLightboxContext";
import { useAlbumMappings } from "../config/album-mapping";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";



export function MyMomentsPage() {
  const navigate = useNavigate();
  const { user, hasClaimedFace, loading: loadingUser } = useUser();
  const { mappings, loading: loadingMappings } = useAlbumMappings();
  
  const [photos, setPhotos] = useState<ImmichAsset[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [selectedAlbumKey, setSelectedAlbumKey] = useState<string>("all");
  
  // Lightbox state
  const { openLightbox, virtuosoRef } = useGalleryLightbox();

  // Redirect out if unauthenticated or has not claimed a face (and loading completed)
  useEffect(() => {
    if (!loadingUser && (!user || !hasClaimedFace)) {
      navigate("/");
    }
  }, [user, hasClaimedFace, loadingUser, navigate]);

  // 1. Fetch user's claimed faces & corresponding photos
  useEffect(() => {
    if (!user) return;

    const fetchMyMoments = async () => {
      setLoadingPhotos(true);
      try {
        // Fetch claimed faces
        const { data, error } = await supabase
          .from('user_faces')
          .select('immich_person_id')
          .eq('student_id', user.student_id);
          
        if (error) {
          console.error("Error fetching user faces:", error);
          setLoadingPhotos(false);
          return;
        }

        const personIds = data.map(d => d.immich_person_id);
        
        if (personIds.length === 0) {
          setPhotos([]);
          setLoadingPhotos(false);
          return;
        }

        // Fetch assets for those faces
        const res = await immich.assets.searchMetadata({ personIds });
        setPhotos(res.assets?.items || []);
        
      } catch (err) {
        console.error("Error fetching my moments:", err);
      } finally {
        setLoadingPhotos(false);
      }
    };
    
    fetchMyMoments();
  }, [user]);

  // Filter photos by album mapping
  const [filteredPhotos, setFilteredPhotos] = useState<ImmichAsset[]>([]);
  const [albumAssetsCache, setAlbumAssetsCache] = useState<Record<string, Set<string>>>({});
  
  useEffect(() => {
    if (selectedAlbumKey === "all") {
      // eslint-disable-next-line
      setFilteredPhotos(photos);
      return;
    }
    
    const filterByAlbum = async () => {
      const mapping = mappings.find(m => m.key === selectedAlbumKey);
      if (!mapping) {
        setFilteredPhotos(photos);
        return;
      }
      
      // Check cache
      if (albumAssetsCache[selectedAlbumKey]) {
        setFilteredPhotos(photos.filter(p => albumAssetsCache[selectedAlbumKey].has(p.id)));
        return;
      }
      
      // Fetch album to get its assets
      try {
        let album = null;
        if (mapping.immichAlbumId) {
          album = await immich.albums.getById(mapping.immichAlbumId);
        } else if (mapping.immichAlbumName) {
          album = await immich.albums.findByName(mapping.immichAlbumName);
        }
        
        let assetSet = new Set<string>();
        if (album) {
          // fetch full album to guarantee assets are present
          const fullAlbum = await immich.albums.getById(album.id);
          assetSet = new Set((fullAlbum.assets || []).map(a => a.id));
        }
        
        setAlbumAssetsCache(prev => ({ ...prev, [selectedAlbumKey]: assetSet }));
        setFilteredPhotos(photos.filter(p => assetSet.has(p.id)));
      } catch (err) {
        console.error("Error fetching album for filter:", err);
        setFilteredPhotos(photos);
      }
    };
    
    filterByAlbum();
  }, [selectedAlbumKey, photos, mappings, albumAssetsCache]);


  if (loadingMappings) {
    return (
      <Flex minH="100vh" align="center" justify="center">
        <Spinner size="xl" color="accent.solid" />
      </Flex>
    );
  }

  return (
    <Flex direction="column" position="relative" zIndex={10} maxW="var(--container-max)" mx="auto" px={{ base: 4, md: 16 }} pt={{ base: 2, md: 28 }} pb={{ base: 4, md: 20 }} minH="100vh">
      
      <VStack gap={2} mb={{ base: 6, md: 8 }} animation="fade-in-up 0.6s var(--ease-out-expo) both">
        <Heading as="h1" fontFamily="'Playfair Display', serif" fontSize={{ base: "2rem", md: "3.5rem" }} fontWeight={700} lineHeight={1.1} letterSpacing="-0.02em" color="accent.solid" textAlign="center">
          My Moments
        </Heading>
        <Text color="fg.muted" fontSize={{ base: "sm", md: "lg" }} textAlign="center" maxW="lg">
          Your personal gallery featuring photos you've been tagged in.
        </Text>
      </VStack>

      <Flex justify="center" mb={8} animation="fade-in-up 0.7s var(--ease-out-expo) both">
        <Box maxW="300px" w="100%">
          <select
            aria-label="Filter photos by album"
            value={selectedAlbumKey}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedAlbumKey(e.target.value)}
            style={{
              width: "100%",
              paddingTop: "10px",
              paddingBottom: "10px",
              paddingLeft: "16px",
              paddingRight: "16px",
              borderRadius: "8px",
              border: "1px solid var(--chakra-colors-border-subtle)",
              backgroundColor: "white",
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--chakra-colors-fg-muted)",
              cursor: "pointer",
              outline: "none"
            }}
          >
            <option value="all">All Moments</option>
            {mappings.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </Box>
      </Flex>

      <Text fontSize="xs" fontWeight="700" color="fg.muted" mb={4} textTransform="uppercase" letterSpacing="0.05em">
        {selectedAlbumKey === "all" ? "All Photos" : `${mappings.find(m => m.key === selectedAlbumKey)?.label}`}
      </Text>

      {loadingPhotos ? (
        <Flex justify="center" py={12}><Spinner color="brand.solid" size="lg" /></Flex>
      ) : photos.length === 0 ? (
        <Flex justify="center" align="center" direction="column" py={12} bg="bg.surface" border="1px dashed" borderColor="border.subtle" borderRadius="2xl" gap={4}>
          <Text color="fg.subtle">You haven't claimed any faces yet.</Text>
        </Flex>
      ) : filteredPhotos.length === 0 ? (
        <Flex justify="center" py={12} bg="bg.surface" border="1px dashed" borderColor="border.subtle" borderRadius="2xl">
          <Text color="fg.subtle">No photos found in this album.</Text>
        </Flex>
      ) : (
        <Box flex="1" w="100%">
          <VirtuosoGrid
            ref={virtuosoRef}
            data={filteredPhotos}
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
              <Image 
                src={immich.assets.thumbnailUrl(asset.id, "thumbnail")} 
                alt="My moment" 
                w="100%" h="100%" objectFit="cover" loading="lazy" 
                onClick={() => openLightbox(index, filteredPhotos)}
              />
            )}
          />
        </Box>
      )}

    </Flex>
  );
}
