import {
  Badge,
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
import { Link, useNavigate } from "react-router-dom";
import { useGalleryLightbox } from "../context/GalleryLightboxContext";
import { useAlbumMappings } from "../config/album-mapping";
import { ImmichImage } from "../components/gallery/ImmichImage";
import { useUser } from "../context/UserContext";
import { supabase } from "../lib/supabase";

export function GalleryPage() {
  const navigate = useNavigate();
  const { user, loading: loadingUser } = useUser();
  const { mappings, loading: loadingMappings } = useAlbumMappings();
  const [activeDay, setActiveDay] = useState<string>("");
  const [photos, setPhotos] = useState<ImmichAsset[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [isAtTop, setIsAtTop] = useState(true);

  // System Config & User Memory Post Count
  const [isMemoryBoardActive, setIsMemoryBoardActive] = useState(true);
  const [userMemoryPostCount, setUserMemoryPostCount] = useState<number | null>(null);
  const [checkingMemoryPosts, setCheckingMemoryPosts] = useState(false);

  // Track window scroll for jump to top button
  useEffect(() => {
    const handleScroll = () => {
      const scrolledToTop = window.scrollY <= 400;
      setIsAtTop(scrolledToTop);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fetch Memory Board config & user memory post count
  useEffect(() => {
    let active = true;
    const checkMemoryStatus = async () => {
      try {
        const { data: configData } = await supabase
          .from("system_config")
          .select("value")
          .eq("key", "enable_memory_board")
          .maybeSingle();

        if (configData !== null && configData !== undefined && active) {
          setIsMemoryBoardActive(Boolean(configData.value));
        }

        if (user && user.role === "student" && active) {
          setCheckingMemoryPosts(true);
          const { count, error } = await supabase
            .from("board_posts")
            .select("*", { count: "exact", head: true })
            .or(`student_id.eq.${user.student_id},author_id.eq.${user.student_id}`);

          if (active) {
            if (!error) setUserMemoryPostCount(count || 0);
            setCheckingMemoryPosts(false);
          }
        }
      } catch (err) {
        console.error("Error checking memory board status:", err);
      }
    };

    checkMemoryStatus();
    return () => {
      active = false;
    };
  }, [user]);

  // Lightbox from global context
  const { openLightbox, virtuosoRef } = useGalleryLightbox();

  // Set default active tab when mappings load
  useEffect(() => {
    if (!activeDay && mappings.length > 0) {
      Promise.resolve().then(() => {
        setActiveDay(mappings[0].key);
      });
    }
  }, [mappings, activeDay]);

  useEffect(() => {
    if (!activeDay || mappings.length === 0) return;

    const fetchPhotos = async () => {
      setLoadingPhotos(true);
      setPhotos([]);
      try {
        const mapping = mappings.find((m) => m.key === activeDay);

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

  const isStaffOrMod =
    user?.role === "staff" ||
    user?.role === "moderator" ||
    user?.role === "admin" ||
    user?.role === "superadmin";
  const isUnlocked =
    !isMemoryBoardActive ||
    isStaffOrMod ||
    (userMemoryPostCount !== null && userMemoryPostCount >= 1);

  if (
    loadingMappings ||
    loadingUser ||
    (user && user.role === "student" && checkingMemoryPosts)
  ) {
    return (
      <Flex minH="100vh" align="center" justify="center">
        <Spinner size="xl" color="brand.900" />
      </Flex>
    );
  }

  return (
    <Flex
      direction="column"
      position="relative"
      zIndex={10}
      maxW="var(--container-max)"
      mx="auto"
      px={{ base: 4, md: 16 }}
      pt={{ base: 2, md: 28 }}
      pb={{ base: 4, md: 20 }}
      minH="100vh"
    >
      <VStack
        gap={2}
        mb={{ base: 6, md: 8 }}
        animation="fade-in-up 0.6s var(--ease-out-expo) both"
      >
        <Heading
          as="h1"
          fontFamily="'Playfair Display', serif"
          fontSize={{ base: "2rem", md: "3.5rem" }}
          fontWeight={700}
          lineHeight={1.1}
          letterSpacing="-0.02em"
          color="brand.900"
          textAlign="center"
        >
          Baan 7 Gallery
        </Heading>
        <Text
          color="fg.muted"
          fontSize={{ base: "sm", md: "lg" }}
          textAlign="center"
          maxW="lg"
        >
          Relive the moments. View photos from our orientation activities.
        </Text>
      </VStack>

      {/* 1. Unauthenticated Guest Gate */}
      {!user ? (
        <Flex
          justify="center"
          align="center"
          minH="380px"
          bg="bg.surface"
          borderRadius="3xl"
          p={{ base: 6, md: 10 }}
          border="1.5px dashed"
          borderColor="border.subtle"
          textAlign="center"
          direction="column"
          gap={5}
          maxW="2xl"
          mx="auto"
          boxShadow="sm"
          animation="fade-in-up 0.5s var(--ease-out-expo) both"
        >
          <Flex
            w="64px"
            h="64px"
            bg="color-mix(in srgb, var(--chakra-colors-accent-solid) 15%, transparent)"
            borderRadius="full"
            align="center"
            justify="center"
            color="brand.solid"
          >
            <Box className="material-symbols-outlined" fontSize="32px">
              lock
            </Box>
          </Flex>
          <VStack gap={2} maxW="md">
            <Heading
              as="h2"
              fontSize={{ base: "xl", md: "2xl" }}
              fontWeight="700"
              color="brand.900"
            >
              Student Login Required
            </Heading>
            <Text fontSize="sm" color="fg.muted" lineHeight={1.6}>
              Please log in with your Student ID & PIN to browse orientation activity photos.
            </Text>
          </VStack>
          <Button
            bg="brand.solid"
            color="white"
            borderRadius="full"
            px={8}
            h="48px"
            fontWeight="600"
            fontSize="sm"
            onClick={() => navigate("/login?redirect=/gallery")}
            _hover={{ bg: "brand.600" }}
          >
            Log In to Access Gallery
          </Button>
        </Flex>
      ) : !isUnlocked ? (
        /* 2. Locked Engagement Gate (Option A Teaser Grid & Overlay) */
        <Box
          position="relative"
          w="100%"
          borderRadius="3xl"
          overflow="hidden"
          p={{ base: 4, md: 8 }}
          bg="bg.surface"
          border="1px solid"
          borderColor="border.subtle"
          boxShadow="xl"
        >
          {/* Blurred Teaser Grid */}
          <Box
            display="grid"
            gridTemplateColumns={{
              base: "repeat(2, 1fr)",
              sm: "repeat(3, 1fr)",
            }}
            gap={4}
            filter="blur(18px)"
            opacity={0.35}
            pointerEvents="none"
            userSelect="none"
          >
            {(activeAssets.length > 0
              ? activeAssets.slice(0, 6)
              : [1, 2, 3, 4, 5, 6]
            ).map((item) => (
              <Box
                key={typeof item === "number" ? item : item.id}
                h={{ base: "160px", sm: "200px" }}
                bg="bg.hero"
                borderRadius="xl"
                overflow="hidden"
              >
                {typeof item !== "number" && (
                  <ImmichImage
                    endpoint={immich.assets.thumbnailUrl(item.id, "thumbnail")}
                    alt="Teaser photo"
                    w="100%"
                    h="100%"
                    objectFit="cover"
                  />
                )}
              </Box>
            ))}
          </Box>

          {/* Centered Unlock Card */}
          <Flex
            position="absolute"
            inset={0}
            zIndex={10}
            align="center"
            justify="center"
            p={{ base: 4, md: 6 }}
            bg="rgba(28, 45, 55, 0.5)"
            backdropFilter="blur(10px)"
          >
            <VStack
              bg="bg.surface"
              borderRadius="3xl"
              p={{ base: 6, md: 8 }}
              maxW="md"
              textAlign="center"
              gap={4}
              border="1px solid"
              borderColor="border.subtle"
              boxShadow="0 20px 40px rgba(0,0,0,0.3)"
              animation="fade-in-up 0.5s var(--ease-out-expo) both"
            >
              <Flex
                bg="color-mix(in srgb, var(--chakra-colors-accent-solid) 15%, transparent)"
                w="60px"
                h="60px"
                borderRadius="full"
                align="center"
                justify="center"
                color="brand.solid"
              >
                <Box className="material-symbols-outlined" fontSize="32px">
                  lock_open
                </Box>
              </Flex>

              <VStack gap={1.5}>
                <Badge
                  colorPalette="amber"
                  variant="subtle"
                  px={3}
                  py={1}
                  borderRadius="full"
                  fontSize="xs"
                  fontWeight="700"
                  display="inline-flex"
                  alignItems="center"
                  gap={1}
                >
                  <Box
                    as="span"
                    className="material-symbols-outlined"
                    fontSize="13px"
                  >
                    push_pin
                  </Box>
                  SHARE 1 MEMORY TO UNLOCK
                </Badge>
                <Heading
                  as="h3"
                  fontSize={{ base: "lg", md: "xl" }}
                  fontWeight="700"
                  color="brand.900"
                >
                  Unlock the Full Gallery!
                </Heading>
                <Text fontSize="sm" color="fg.muted" lineHeight={1.6}>
                  Pin at least 1 memory photo or sticky note on the Baan 7
                  Memory Board to reveal all high-res orientation photos.
                </Text>
              </VStack>

              <Button
                bg="accent.solid"
                color="brand.900"
                borderRadius="full"
                px={8}
                h="48px"
                fontWeight="700"
                fontSize="md"
                onClick={() =>
                  navigate(
                    "/board?tab=memory&autoCompose=true&from=gallery"
                  )
                }
                _hover={{ transform: "translateY(-2px)", boxShadow: "lg" }}
                _active={{ transform: "scale(0.97)" }}
              >
                <Box
                  as="span"
                  className="material-symbols-outlined"
                  mr={1.5}
                  fontSize="20px"
                >
                  edit_square
                </Box>
                Post to Unlock Gallery
              </Button>
            </VStack>
          </Flex>
        </Box>
      ) : (
        /* 3. Full Unlocked Gallery Flow */
        <>
          {/* Face Finder Banner */}
          <Box
            mb={8}
            borderRadius="2xl"
            overflow="hidden"
            position="relative"
            animation="fade-in-up 0.7s var(--ease-out-expo) both"
            className="face-finder-banner"
          >
            <Box
              position="absolute"
              inset={0}
              bg="linear-gradient(135deg, oklch(43.83% 0.046 211.59 / 0.12) 0%, oklch(44.33% 0.091 46.54 / 0.06) 100%)"
              zIndex={0}
            />
            <Box
              position="absolute"
              inset={0}
              border="1.5px solid"
              borderColor="color-mix(in srgb, var(--chakra-colors-accent-solid) 25%, transparent)"
              borderRadius="2xl"
              zIndex={0}
            />
            <Link to="/face-claim">
              <Flex
                position="relative"
                zIndex={1}
                p={{ base: 5, md: 7 }}
                align="center"
                gap={{ base: 4, md: 6 }}
                direction={{ base: "column", sm: "row" }}
                transition="all 0.3s var(--ease-out-quart)"
                _hover={{
                  "& .banner-icon": {
                    transform: "scale(1.08) rotate(-4deg)",
                  },
                  "& .banner-cta": { bg: "brand.900", color: "white" },
                }}
              >
                <Box
                  className="banner-icon"
                  w={{ base: "52px", md: "64px" }}
                  h={{ base: "52px", md: "64px" }}
                  bg="accent.solid"
                  borderRadius="2xl"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  flexShrink={0}
                  transition="transform 0.3s var(--ease-out-quart)"
                >
                  <Box
                    as="span"
                    className="material-symbols-outlined"
                    fontSize={{ base: "28px", md: "32px" }}
                    color="white"
                  >
                    person_search
                  </Box>
                </Box>

                <VStack
                  align={{ base: "center", sm: "start" }}
                  gap={0.5}
                  flex={1}
                >
                  <Heading
                    as="h3"
                    fontFamily="'Playfair Display', serif"
                    fontSize={{ base: "md", md: "lg" }}
                    fontWeight={600}
                    color="brand.900"
                    lineHeight={1.2}
                  >
                    Can't find your photo?
                  </Heading>
                  <Text
                    fontSize={{ base: "xs", md: "sm" }}
                    color="fg.muted"
                    maxW="55ch"
                    lineHeight={1.5}
                  >
                    Use our AI face search to find photos where you appear —
                    even if you don't know when they were taken.
                  </Text>
                </VStack>

                <Flex
                  className="banner-cta"
                  as="span"
                  align="center"
                  gap={2}
                  bg="brand.900"
                  color="white"
                  px={{ base: 5, md: 6 }}
                  py={{ base: 2.5, md: 3 }}
                  borderRadius="full"
                  fontWeight="700"
                  fontSize="sm"
                  letterSpacing="0.02em"
                  flexShrink={0}
                  whiteSpace="nowrap"
                  transition="all 0.25s var(--ease-out-quart)"
                >
                  Find My Face
                  <Box
                    as="span"
                    className="material-symbols-outlined"
                    fontSize="16px"
                  >
                    arrow_forward
                  </Box>
                </Flex>
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
                h="44px"
                px={6}
                py={2}
                borderRadius="full"
                fontWeight="600"
                fontSize="sm"
                variant={activeDay === m.key ? "solid" : "outline"}
                bg={activeDay === m.key ? "accent.solid" : "transparent"}
                color="brand.900"
                borderColor="accent.solid"
                _hover={{
                  bg:
                    activeDay === m.key
                      ? "accent.solid"
                      : "color-mix(in srgb, var(--chakra-colors-accent-solid) 5%, transparent)",
                }}
              >
                {m.label}
              </Button>
            ))}
          </Flex>

          {/* Main Photo Layout Grid with Virtuoso */}
          <Text
            fontSize="xs"
            fontWeight="700"
            color="fg.muted"
            mb={4}
            textTransform="uppercase"
            letterSpacing="0.05em"
          >
            {mappings.find((m) => m.key === activeDay)?.label || "Gallery"}
          </Text>

          {loadingActiveAssets ? (
            <Flex justify="center" py={12}>
              <Text color="fg.subtle">Loading photos...</Text>
            </Flex>
          ) : activeAssets.length === 0 ? (
            <Flex
              justify="center"
              py={12}
              bg="bg.surface"
              border="1px dashed"
              borderColor="border.subtle"
              borderRadius="2xl"
            >
              <Text color="fg.subtle">No photos found in this view.</Text>
            </Flex>
          ) : (
            <Box flex="1" w="100%">
              <VirtuosoGrid
                ref={virtuosoRef}
                data={activeAssets}
                useWindowScroll
                components={{
                  List: React.forwardRef<
                    HTMLDivElement,
                    React.HTMLAttributes<HTMLDivElement>
                  >(({ style, children, ...props }, ref) => (
                    <Box
                      ref={ref}
                      style={style}
                      {...props}
                      display="grid"
                      gridTemplateColumns={{
                        base: "repeat(2, 1fr)",
                        sm: "repeat(3, 1fr)",
                        md: "repeat(4, 1fr)",
                      }}
                      gap={4}
                    >
                      {children}
                    </Box>
                  )),
                  Item: ({
                    children,
                    ...props
                  }: React.HTMLAttributes<HTMLDivElement>) => (
                    <Box
                      {...props}
                      h={{ base: "160px", sm: "200px", md: "240px" }}
                      borderRadius="xl"
                      overflow="hidden"
                      cursor="pointer"
                      transition="transform 0.3s"
                      _hover={{ transform: "translateY(-2px)" }}
                    >
                      {children}
                    </Box>
                  ),
                }}
                itemContent={(index, asset) => (
                  <ImmichImage
                    endpoint={immich.assets.thumbnailUrl(asset.id, "thumbnail")}
                    alt="Gallery photo"
                    w="100%"
                    h="100%"
                    objectFit="cover"
                    loading="lazy"
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
                  <Box
                    className="material-symbols-outlined"
                    fontSize="sm"
                    mr={1}
                  >
                    arrow_upward
                  </Box>
                  Jump to latest
                </Button>
              )}
            </Box>
          )}
        </>
      )}
    </Flex>
  );
}
