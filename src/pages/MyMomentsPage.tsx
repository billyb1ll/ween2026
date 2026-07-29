import {
  Box,
  Flex,
  Heading,
  Text,
  VStack,
  HStack,
  Badge,
  Spinner,
} from "@chakra-ui/react";
import React, { useState, useEffect } from "react";
import { useUser } from "../context/UserContext";
import { immich } from "../lib/immich";
import type { ImmichAsset } from "../lib/immich";
import { VirtuosoGrid } from "react-virtuoso";
import { useGalleryLightbox } from "../context/GalleryLightboxContext";
import { useAlbumMappings, resolveAlbumIdsForMapping } from "../config/album-mapping";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { AiGalleryNotice } from "../components/AiGalleryNotice";
import { SearchableSelect } from "../components/SearchableSelect";
import { ImmichImage } from "../components/gallery/ImmichImage";

export function MyMomentsPage() {
  const navigate = useNavigate();
  const { user, hasClaimedFace, loading: loadingUser } = useUser();
  const { mappings, loading: loadingMappings } = useAlbumMappings();
  
  const [photos, setPhotos] = useState<ImmichAsset[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [selectedAlbumKey, setSelectedAlbumKey] = useState<string>("all");
  
  const isModerator = user?.role === "moderator" || user?.role === "staff" || user?.role === "superadmin";
  const [allUsers, setAllUsers] = useState<Array<{ student_id: string; nickname: string | null; faculty: string | null; role: string }>>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");

  const activeStudentId = selectedStudentId || user?.student_id || "";

  // Fetch list of all users for Moderator selection
  useEffect(() => {
    if (!isModerator) return;
    supabase
      .from("users")
      .select("student_id, nickname, faculty, role")
      .order("student_id", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) {
          setAllUsers(data);
        }
      });
  }, [isModerator]);

  // Lightbox state
  const { openLightbox, virtuosoRef } = useGalleryLightbox();

  // Redirect out if unauthenticated or (for non-moderators) has not claimed a face
  useEffect(() => {
    if (!loadingUser && (!user || (!hasClaimedFace && !isModerator))) {
      navigate("/");
    }
  }, [user, hasClaimedFace, isModerator, loadingUser, navigate]);

  // 1. Fetch target student's claimed faces & corresponding photos directly for selected album/all mapped albums
  useEffect(() => {
    if (!activeStudentId || loadingMappings) return;

    const fetchMyMoments = async () => {
      setLoadingPhotos(true);
      try {
        // Fetch claimed faces for target student
        const { data, error } = await supabase
          .from("user_faces")
          .select("immich_person_id")
          .eq("student_id", activeStudentId);

        if (error) {
          console.error("Error fetching user faces:", error);
          setLoadingPhotos(false);
          return;
        }

        const personIds = data.map((d) => d.immich_person_id).filter(Boolean);

        if (personIds.length === 0) {
          setPhotos([]);
          setLoadingPhotos(false);
          return;
        }

        let fetchedItems: ImmichAsset[] = [];

        if (selectedAlbumKey === "unseen") {
          // Unseen Photos: All photos of claimed face EXCEPT those present in any mapped activity album
          const allRes = await immich.assets.searchMetadata({ personIds, size: 1000 });
          const allLibraryPhotos = allRes.assets?.items || [];

          // Collect asset IDs of photos present in any mapped activity album
          const serverAlbums = await immich.albums.list().catch(() => []);
          const allMappedAlbumIdsSet = new Set<string>();
          for (const m of mappings) {
            const ids = resolveAlbumIdsForMapping(m, serverAlbums);
            ids.forEach((id) => allMappedAlbumIdsSet.add(id));
          }
          const allMappedAlbumIds = Array.from(allMappedAlbumIdsSet);

          const mappedAssetIds = new Set<string>();
          if (allMappedAlbumIds.length > 0) {
            const mappedPromises = allMappedAlbumIds.map((albumId) =>
              immich.assets.searchMetadata({ personIds, albumIds: [albumId], size: 1000 })
            );
            const mappedResults = await Promise.all(mappedPromises);
            for (const res of mappedResults) {
              for (const item of res.assets?.items || []) {
                mappedAssetIds.add(item.id);
              }
            }
          }

          // Filter to photos NOT present in any mapped album
          fetchedItems = allLibraryPhotos.filter((p) => !mappedAssetIds.has(p.id));
        } else {
          // Mapped albums query: resolve all matching albums configured in admin settings
          const serverAlbums = await immich.albums.list().catch(() => []);
          const albumIdsToQuerySet = new Set<string>();

          if (selectedAlbumKey === "all") {
            // All Event Moments: query photos across ALL mapped activity albums
            for (const m of mappings) {
              const ids = resolveAlbumIdsForMapping(m, serverAlbums);
              ids.forEach((id) => albumIdsToQuerySet.add(id));
            }
          } else {
            // Specific Day selected: query photos for mapped album for that day
            const targetMapping = mappings.find((m) => m.key === selectedAlbumKey);
            if (targetMapping) {
              const ids = resolveAlbumIdsForMapping(targetMapping, serverAlbums);
              ids.forEach((id) => albumIdsToQuerySet.add(id));
            }
          }

          const albumIdsToQuery = Array.from(albumIdsToQuerySet);

          if (albumIdsToQuery.length > 0) {
            const searchPromises = albumIdsToQuery.map((albumId) =>
              immich.assets.searchMetadata({ personIds, albumIds: [albumId], size: 1000 })
            );
            const searchResults = await Promise.all(searchPromises);
            const assetMap = new Map<string, ImmichAsset>();

            for (const res of searchResults) {
              for (const item of res.assets?.items || []) {
                assetMap.set(item.id, item);
              }
            }
            fetchedItems = Array.from(assetMap.values());
          } else {
            // Fallback if no activity albums mapped: search across all Immich assets
            const res = await immich.assets.searchMetadata({ personIds, size: 1000 });
            fetchedItems = res.assets?.items || [];
          }
        }

        // Sort items ASC by shoot time / capture date
        fetchedItems.sort((a, b) => {
          const timeA = new Date(a.exifInfo?.dateTimeOriginal || a.fileCreatedAt || a.createdAt || 0).getTime();
          const timeB = new Date(b.exifInfo?.dateTimeOriginal || b.fileCreatedAt || b.createdAt || 0).getTime();
          return timeA - timeB;
        });

        setPhotos(fetchedItems);
      } catch (err) {
        console.error("Error fetching moments:", err);
        setPhotos([]);
      } finally {
        setLoadingPhotos(false);
      }
    };

    fetchMyMoments();
  }, [activeStudentId, selectedAlbumKey, mappings, loadingMappings]);

  const filteredPhotos = photos;


  if (loadingMappings) {
    return (
      <Flex minH="100vh" align="center" justify="center">
        <Spinner size="xl" color="brand.900" />
      </Flex>
    );
  }

  return (
    <Flex direction="column" position="relative" zIndex={10} maxW="var(--container-max)" mx="auto" px={{ base: 4, md: 16 }} pt={{ base: 2, md: 28 }} pb={{ base: 4, md: 20 }} minH="100vh">
      
      {/* Moderator Inspection Selector */}
      {isModerator && (
        <Box
          mb={6}
          p={4}
          bg="white"
          borderRadius="2xl"
          border="1.5px solid var(--c-lagoon)"
          boxShadow="0 8px 24px -4px rgba(73,98,104,0.15)"
          animation="fade-in-up 0.5s var(--ease-out-expo) both"
        >
          <Flex justify="space-between" align="center" flexWrap="wrap" gap={3} mb={3}>
            <HStack gap={2}>
              <Box
                as="span"
                className="material-symbols-outlined"
                fontSize="20px"
                color="var(--c-lagoon)"
              >
                admin_panel_settings
              </Box>
              <Text fontSize="sm" fontWeight="700" color="brand.900">
                Moderator View: Inspect Student Moments
              </Text>
            </HStack>
            {activeStudentId && (
              <Badge colorPalette="teal" variant="subtle" px={2.5} py={1} borderRadius="full">
                Inspecting: {activeStudentId}
              </Badge>
            )}
          </Flex>

          <SearchableSelect
            value={selectedStudentId || user?.student_id || ""}
            onChange={(val) => setSelectedStudentId(val)}
            options={allUsers.map((u) => ({
              value: u.student_id,
              primaryText: `${u.student_id} - ${u.nickname || "Pending Onboarding"}`,
              secondaryText: u.faculty ? `Faculty: ${u.faculty}` : undefined,
              badge: u.role.toUpperCase(),
            }))}
            placeholder="Select a student to inspect their moments..."
            searchPlaceholder="Search student ID, nickname, or faculty..."
          />
        </Box>
      )}

      <VStack gap={2} mb={{ base: 6, md: 8 }} animation="fade-in-up 0.6s var(--ease-out-expo) both">
        <Heading as="h1" fontFamily="'Playfair Display', serif" fontSize={{ base: "2rem", md: "3.5rem" }} fontWeight={700} lineHeight={1.1} letterSpacing="-0.02em" color="brand.900" textAlign="center">
          {isModerator && activeStudentId !== user?.student_id ? `Moments of Student ${activeStudentId}` : "My Moments"}
        </Heading>
        <Text color="fg.muted" fontSize={{ base: "sm", md: "lg" }} textAlign="center" maxW="lg">
          {isModerator && activeStudentId !== user?.student_id
            ? `Inspecting identified gallery photos for student ID ${activeStudentId}.`
            : "Your personal gallery featuring photos you've been tagged in."}
        </Text>
      </VStack>

      <Flex justify="center" mb={6} animation="fade-in-up 0.7s var(--ease-out-expo) both">
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
            <option value="all">All Event Moments (Mapped Albums)</option>
            {mappings.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
            <option value="unseen">✨ Unseen Photos (Outside Mapped Albums)</option>
          </select>
        </Box>
      </Flex>

      <AiGalleryNotice />

      <Text fontSize="xs" fontWeight="700" color="fg.muted" mb={4} textTransform="uppercase" letterSpacing="0.05em">
        {selectedAlbumKey === "all"
          ? "All Event Photos (Mapped Albums)"
          : selectedAlbumKey === "unseen"
          ? "Unseen Photos (Outside Mapped Event Albums)"
          : `${mappings.find((m) => m.key === selectedAlbumKey)?.label}`}
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
              <ImmichImage
                endpoint={immich.assets.thumbnailUrl(asset.id, "thumbnail")}
                alt="My moment"
                w="100%"
                h="100%"
                objectFit="cover"
                onClick={() => openLightbox(index, filteredPhotos)}
              />
            )}
          />
        </Box>
      )}

    </Flex>
  );
}
