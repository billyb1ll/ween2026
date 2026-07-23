import {
  Box,
  Flex,
  Heading,
  Text,
  VStack,
  HStack,
  Button,
  Spinner,
  Input,
  Badge,
} from "@chakra-ui/react";
import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { toaster } from "../components/ui/toaster";
import { immich } from "../lib/immich";
import type { ImmichAsset, ImmichPerson } from "../lib/immich";
import { useGalleryLightbox } from "../context/GalleryLightboxContext";
import { VirtuosoGrid } from "react-virtuoso";
import { supabase } from "../lib/supabase";
import React from "react";
import { ImmichImage } from "../components/gallery/ImmichImage";

const FaceGrid = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ style, children: _children, ...props }, ref) => (
    <Box
      ref={ref}
      style={style}
      {...props}
      display="grid"
      gridTemplateColumns={{
        base: "repeat(3, 1fr)",
        sm: "repeat(4, 1fr)",
        md: "repeat(5, 1fr)",
        lg: "repeat(6, 1fr)",
      }}
      gap={3}
      p={2}
    >
      {_children}
    </Box>
  )
);

FaceGrid.displayName = "FaceGrid";

const FaceGridItem = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <Box {...props}>{children}</Box>
);

export function FaceClaimPage() {
  const { user, updateProfile, refreshClaimedFaceStatus, handleUnauthorizedError } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  const [unclaimedPeople, setUnclaimedPeople] = useState<ImmichPerson[]>([]);
  const [personAssets, setPersonAssets] = useState<ImmichAsset[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [loadingPersonAssets, setLoadingPersonAssets] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const { openLightbox } = useGalleryLightbox();

  const isGuest = !user;

  useEffect(() => {
    const fetchPeople = async () => {
      try {
        const data = await immich.people.list();
        const list = data.people || [];
        setUnclaimedPeople(list.filter((p) => !p.name || p.name.trim() === ""));
      } catch (err) {
        console.error("Error fetching people:", err);
      } finally {
        setLoadingPeople(false);
      }
    };
    fetchPeople();
  }, []);

  const filteredPeople = useMemo(() => {
    if (!searchQuery.trim()) return unclaimedPeople;
    const q = searchQuery.toLowerCase();
    return unclaimedPeople.filter((_, i) =>
      `face ${i + 1}`.includes(q) || String(i + 1).includes(q)
    );
  }, [unclaimedPeople, searchQuery]);

  const handleSelectPerson = (personId: string) => {
    if (isGuest) {
      // Guests can select to see the locked preview — but can't claim
      setSelectedPersonIds((prev) =>
        prev.includes(personId) ? prev.filter((id) => id !== personId) : [...prev, personId]
      );
      return;
    }
    setSelectedPersonIds((prev) =>
      prev.includes(personId) ? prev.filter((id) => id !== personId) : [...prev, personId]
    );
  };

  // Fetch preview assets for selected people (logged-in users only)
  useEffect(() => {
    let active = true;
    if (selectedPersonIds.length === 0 || !user) {
      Promise.resolve().then(() => {
        if (active) setPersonAssets([]);
      });
      return () => { active = false; };
    }

    const fetchSelectedAssets = async () => {
      setLoadingPersonAssets(true);
      try {
        const data = await immich.assets.searchMetadata({ personIds: selectedPersonIds });
        if (active) setPersonAssets(data.assets?.items || []);
      } catch (err) {
        console.error("Search assets error:", err);
      } finally {
        if (active) setLoadingPersonAssets(false);
      }
    };

    fetchSelectedAssets();
    return () => { active = false; };
  }, [selectedPersonIds, user]);

  const handleExecuteClaim = async () => {
    if (!user || selectedPersonIds.length === 0) return;
    setClaiming(true);

    try {
      let avatarUpdated = false;

      if (personAssets.length > 0 && !user.profile_pic_url) {
        const previewUrl = immich.assets.thumbnailUrl(personAssets[0].id, "preview");
        const success = await updateProfile({
          nickname: user.nickname || "Student",
          faculty: user.faculty || "",
          major: user.major || undefined,
          ig: user.ig || undefined,
          avatarColor: user.avatar_color,
          bio: user.bio || undefined,
          profilePicUrl: previewUrl,
          immichAssetId: personAssets[0].id,
        });
        if (success) avatarUpdated = true;
      }

      const inserts = selectedPersonIds.map((id) => ({
        student_id: user.student_id,
        immich_person_id: id,
      }));

      const { error: sbError } = await supabase.from("user_faces").insert(inserts);
      if (sbError && sbError.code !== "23505") {
        console.error("Supabase insert error:", sbError);
        const errObj = sbError as { code?: string; status?: number; message?: string };
        if (
          errObj.code === "P0001" ||
          errObj.status === 401 ||
          (errObj.message?.includes("Unauthorized") && errObj.code !== "42501")
        ) {
          handleUnauthorizedError();
          return;
        }
      }

      const defaultName = `Student ${user.student_id}`;
      const formattedName =
        (user.full_name && user.full_name.trim() !== ""
          ? `${user.nickname || "Student"} (${user.full_name.trim()})`
          : user.nickname) || defaultName;

      await Promise.all(
        selectedPersonIds.map((id) => immich.people.update(id, { name: formattedName }))
      );

      toaster.create({
        title: "Claim Successful",
        description: avatarUpdated
          ? "Successfully claimed faces and updated profile picture."
          : "Successfully claimed faces.",
        type: "success",
      });

      refreshClaimedFaceStatus();
      setUnclaimedPeople((prev) => prev.filter((p) => !selectedPersonIds.includes(p.id)));
      setSelectedPersonIds([]);
      setPersonAssets([]);
    } catch (err: unknown) {
      console.error("Execute claim error:", err);
      const errObj = err as { code?: string; status?: number; message?: string };
      if (
        errObj?.code === "P0001" ||
        errObj?.status === 401 ||
        (errObj?.message?.includes("Unauthorized") && errObj?.code !== "42501")
      ) {
        handleUnauthorizedError();
        return;
      }
      toaster.create({
        title: "Claim Failed",
        description: "Failed to commit face claim. Please try again.",
        type: "error",
      });
    } finally {
      setClaiming(false);
    }
  };

  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const [isMobilePreviewOpen, setIsMobilePreviewOpen] = useState(false);
  const PREVIEW_LIMIT = 6;

  const displayedAssets = useMemo(
    () => (showAllPhotos ? personAssets : personAssets.slice(0, PREVIEW_LIMIT)),
    [personAssets, showAllPhotos]
  );

  return (
    <Box
      maxW="var(--container-max)"
      mx="auto"
      px={{ base: 4, md: 16 }}
      pt={{ base: 2, md: 28 }}
      pb={{ base: 32, md: 20 }}
      minH="100vh"
    >
      {/* Page Header */}
      <VStack gap={2} mb={{ base: 6, md: 8 }} animation="fade-in-up 0.6s var(--ease-out-expo) both">
        <Heading
          as="h1"
          fontFamily="'Playfair Display', serif"
          fontSize={{ base: "2rem", md: "3.5rem" }}
          fontWeight={700}
          lineHeight={1.05}
          letterSpacing="-0.02em"
          color="brand.900"
          textAlign="center"
        >
          Find Your Face
        </Heading>
        <Text color="fg.muted" textAlign="center" maxW="55ch" fontSize={{ base: "sm", md: "md" }}>
          Our AI has detected faces from orientation activities. Select any face that belongs to you.
        </Text>
      </VStack>

      {/* Guest banner */}
      {isGuest && (
        <Flex
          bg="color-mix(in srgb, var(--chakra-colors-accent-solid) 8%, white 92%)"
          border="1.5px solid"
          borderColor="accent.solid"
          borderRadius="xl"
          p={{ base: 4, md: 5 }}
          mb={6}
          align="center"
          gap={4}
          justify="space-between"
          direction={{ base: "column", sm: "row" }}
          animation="fade-in-up 0.5s var(--ease-out-expo) both"
        >
          <HStack gap={3}>
            <Box
              as="span"
              className="material-symbols-outlined"
              fontSize="24px"
              color="brand.solid"
              flexShrink={0}
            >
              lock_person
            </Box>
            <Text fontSize="sm" color="brand.900" fontWeight="500">
              You are browsing as a guest. Select a face to preview — login to claim it.
            </Text>
          </HStack>
          <Button
            bg="brand.solid"
            color="white"
            borderRadius="xl"
            px={6}
            h="40px"
            fontSize="sm"
            fontWeight="700"
            flexShrink={0}
            onClick={() => navigate("/login", { state: { from: location.pathname } })}
            _hover={{ bg: "brand.600" }}
          >
            Login
          </Button>
        </Flex>
      )}

      {/* Main split-pane layout on desktop */}
      <Flex
        direction={{ base: "column", lg: "row" }}
        gap={{ base: 6, lg: 8 }}
        align="flex-start"
      >
        {/* LEFT — Face Grid */}
        <Box flex={{ base: "unset", lg: "0 0 55%" }} w={{ base: "100%", lg: "55%" }}>
          {/* Search */}
          <Flex
            bg="bg.surface"
            border="1px solid"
            borderColor="border.subtle"
            borderRadius="xl"
            px={4}
            h="44px"
            align="center"
            gap={3}
            mb={4}
            _focusWithin={{ borderColor: "brand.solid", boxShadow: "0 0 0 2px color-mix(in srgb, var(--chakra-colors-brand-solid) 12%, transparent)" }}
            transition="all 0.2s"
          >
            <Box as="span" className="material-symbols-outlined" fontSize="20px" color="fg.muted">
              search
            </Box>
            <Input
              border="none"
              outline="none"
              bg="transparent"
              placeholder="Search by face number (e.g. 12)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              fontSize="sm"
              color="fg.default"
              _placeholder={{ color: "fg.subtle" }}
              p={0}
              h="100%"
            />
            {searchQuery && (
              <Box
                as="button"
                onClick={() => setSearchQuery("")}
                className="material-symbols-outlined"
                fontSize="18px"
                color="fg.muted"
                cursor="pointer"
                _hover={{ color: "fg.default" }}
              >
                close
              </Box>
            )}
          </Flex>

          {/* Stats */}
          {!loadingPeople && (
            <Flex gap={3} mb={4} wrap="wrap">
              <Badge
                px={3}
                py={1}
                borderRadius="full"
                bg="bg.surface"
                border="1px solid"
                borderColor="border.subtle"
                color="fg.muted"
                fontSize="xs"
                fontWeight="600"
              >
                {filteredPeople.length} unclaimed faces
              </Badge>
              {selectedPersonIds.length > 0 && (
                <Badge
                  px={3}
                  py={1}
                  borderRadius="full"
                  bg="brand.solid"
                  color="white"
                  fontSize="xs"
                  fontWeight="700"
                >
                  {selectedPersonIds.length} selected
                </Badge>
              )}
            </Flex>
          )}

          {/* Face virtuoso grid */}
          {loadingPeople ? (
            <Flex justify="center" py={12}>
              <Spinner size="lg" color="brand.solid" />
            </Flex>
          ) : filteredPeople.length === 0 ? (
            <Flex
              justify="center"
              direction="column"
              align="center"
              py={12}
              bg="bg.surface"
              border="1px dashed"
              borderColor="border.subtle"
              borderRadius="2xl"
              gap={3}
            >
              <Box as="span" className="material-symbols-outlined" fontSize="48px" color="fg.subtle">
                face_retouching_off
              </Box>
              <Text color="fg.subtle" fontSize="sm">No unclaimed faces found.</Text>
            </Flex>
          ) : (
            <Box
              w="100%"
              bg="bg.surface"
              borderRadius="2xl"
              border="1px solid"
              borderColor="border.subtle"
              overflow="hidden"
            >
              <VirtuosoGrid
                data={filteredPeople}
                useWindowScroll
                components={{ List: FaceGrid, Item: FaceGridItem }}
                itemContent={(index, person) => {
                  const isSelected = selectedPersonIds.includes(person.id);
                  const faceNumber = unclaimedPeople.indexOf(person) + 1;
                  return (
                    <VStack
                      onClick={() => handleSelectPerson(person.id)}
                      cursor="pointer"
                      align="center"
                      gap={1.5}
                      p={2}
                      borderRadius="xl"
                      transition="all 0.2s var(--ease-out-quart)"
                      _hover={{ bg: "bg.muted" }}
                      position="relative"
                    >
                      <Box
                        w={{ base: "60px", sm: "72px" }}
                        h={{ base: "60px", sm: "72px" }}
                        borderRadius="full"
                        position="relative"
                        border={isSelected ? "3px solid var(--chakra-colors-brand-solid)" : "2.5px solid transparent"}
                        outline={isSelected ? "none" : "2px dashed var(--chakra-colors-border-subtle)"}
                        outlineOffset="2px"
                        p="2px"
                        transition="all 0.2s"
                        transform={isSelected ? "scale(1.08)" : "none"}
                        boxShadow={isSelected ? "0 0 0 4px color-mix(in srgb, var(--chakra-colors-brand-solid) 16%, transparent)" : "none"}
                      >
                        <Box w="100%" h="100%" borderRadius="full" overflow="hidden">
                          <ImmichImage
                            endpoint={immich.people.thumbnailUrl(person.id)}
                            alt={`Face ${faceNumber}`}
                            w="100%"
                            h="100%"
                            objectFit="cover"
                            decoding="async"
                          />
                        </Box>
                        {isSelected && (
                          <Flex
                            position="absolute"
                            top="-4px"
                            right="-4px"
                            bg="brand.solid"
                            w="22px"
                            h="22px"
                            borderRadius="full"
                            align="center"
                            justify="center"
                            color="white"
                            boxShadow="0 2px 6px rgba(0,0,0,0.25)"
                          >
                            <Box as="span" className="material-symbols-outlined" fontSize="13px">check</Box>
                          </Flex>
                        )}
                      </Box>
                      <Text fontSize="10px" fontWeight="600" color="fg.subtle" letterSpacing="0.02em">
                        #{faceNumber}
                      </Text>
                    </VStack>
                  );
                }}
              />
            </Box>
          )}
        </Box>

        {/* RIGHT — Preview Panel (Desktop Sticky & Mobile Bottom Sheet) */}
        <Box
          flex={1}
          position={{ base: "unset", lg: "sticky" }}
          top={{ lg: "120px" }}
          w={{ base: "100%", lg: "auto" }}
          display={{ base: "none", lg: "block" }}
        >
          {selectedPersonIds.length === 0 ? (
            // Empty state
            <Flex
              direction="column"
              align="center"
              justify="center"
              bg="bg.surface"
              border="1.5px dashed"
              borderColor="border.subtle"
              borderRadius="2xl"
              p={{ base: 8, md: 12 }}
              gap={4}
              minH="300px"
            >
              <Box
                as="span"
                className="material-symbols-outlined"
                fontSize="48px"
                color="fg.subtle"
                opacity={0.5}
              >
                touch_app
              </Box>
              <VStack gap={1}>
                <Text fontWeight="600" color="fg.muted" fontSize="sm">
                  Select a face to preview
                </Text>
                <Text fontSize="xs" color="fg.subtle" textAlign="center" maxW="28ch">
                  Tap any face on the left to see matching photos from orientation activities.
                </Text>
              </VStack>
            </Flex>
          ) : isGuest ? (
            // Guest locked preview
            <Flex
              direction="column"
              align="center"
              justify="center"
              bg="color-mix(in srgb, var(--chakra-colors-accent-solid) 5%, white 95%)"
              border="1.5px solid"
              borderColor="accent.solid"
              borderRadius="2xl"
              p={{ base: 8, md: 12 }}
              gap={5}
              minH="300px"
            >
              <Box
                w="56px"
                h="56px"
                bg="accent.solid"
                borderRadius="full"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Box as="span" className="material-symbols-outlined" fontSize="28px" color="white">
                  lock
                </Box>
              </Box>
              <VStack gap={2}>
                <Text fontWeight="700" color="brand.900" fontSize="md">
                  Login to see matching photos
                </Text>
                <Text fontSize="sm" color="fg.muted" textAlign="center" maxW="30ch">
                  {selectedPersonIds.length} face{selectedPersonIds.length > 1 ? "s" : ""} selected. Login to view photos and claim them as yours.
                </Text>
              </VStack>
              <Button
                bg="brand.solid"
                color="white"
                borderRadius="xl"
                px={8}
                h="48px"
                fontWeight="700"
                onClick={() => navigate("/login", { state: { from: location.pathname } })}
                _hover={{ bg: "brand.600" }}
              >
                Login to Claim
              </Button>
            </Flex>
          ) : (
            // Logged-in preview panel
            <Box
              bg="bg.surface"
              border="1px solid"
              borderColor="border.subtle"
              borderRadius="2xl"
              overflow="hidden"
            >
              {/* Preview header */}
              <Flex
                px={4}
                py={3}
                borderBottom="1px solid"
                borderColor="border.subtle"
                align="center"
                justify="space-between"
                bg="white"
              >
                <HStack gap={2}>
                  <Text fontWeight="700" fontSize="sm" color="brand.900">
                    {selectedPersonIds.length} Face{selectedPersonIds.length > 1 ? "s" : ""} Selected
                  </Text>
                  {!loadingPersonAssets && personAssets.length > 0 && (
                    <Badge
                      bg="bg.muted"
                      color="fg.muted"
                      fontSize="xs"
                      borderRadius="full"
                      px={2}
                    >
                      Showing {displayedAssets.length} of {personAssets.length} photos
                    </Badge>
                  )}
                </HStack>
                <Button
                  variant="ghost"
                  size="xs"
                  color="fg.muted"
                  fontSize="xs"
                  borderRadius="lg"
                  onClick={() => { setSelectedPersonIds([]); setPersonAssets([]); }}
                  _hover={{ bg: "bg.muted" }}
                >
                  Clear
                </Button>
              </Flex>

              {/* Photo preview grid (Truncated to displayedAssets) */}
              {loadingPersonAssets ? (
                <Flex justify="center" py={10}>
                  <Spinner size="md" color="brand.solid" />
                </Flex>
              ) : personAssets.length === 0 ? (
                <Flex justify="center" py={10} direction="column" align="center" gap={2}>
                  <Text color="fg.subtle" fontSize="sm">No photos matched this face.</Text>
                </Flex>
              ) : (
                <Box p={3}>
                  <Box
                    display="grid"
                    gridTemplateColumns="repeat(3, 1fr)"
                    gap={2}
                  >
                    {displayedAssets.map((asset, idx) => (
                      <Box
                        key={asset.id}
                        position="relative"
                        borderRadius="xl"
                        overflow="hidden"
                        cursor="pointer"
                        aspectRatio={1}
                        onClick={() => openLightbox(idx, personAssets)}
                        transition="all 0.2s var(--ease-out-quart)"
                        _hover={{ transform: "scale(1.04)", zIndex: 2 }}
                        boxShadow="sm"
                      >
                        <ImmichImage
                          endpoint={immich.assets.thumbnailUrl(asset.id, "thumbnail")}
                          w="100%"
                          h="100%"
                          objectFit="cover"
                          decoding="async"
                        />
                      </Box>
                    ))}
                  </Box>

                  {/* Toggle Show All Photos Pill Button */}
                  {personAssets.length > PREVIEW_LIMIT && (
                    <Flex justify="center" mt={3}>
                      <Button
                        size="xs"
                        variant="outline"
                        borderRadius="full"
                        fontSize="xs"
                        fontWeight="700"
                        color="brand.900"
                        borderColor="border.subtle"
                        onClick={() => setShowAllPhotos((prev) => !prev)}
                        cursor="pointer"
                        _hover={{ bg: "bg.muted" }}
                      >
                        {showAllPhotos
                          ? "Show Fewer Photos"
                          : `+ View All ${personAssets.length} Photos`}
                      </Button>
                    </Flex>
                  )}
                </Box>
              )}

              {/* Claim action footer */}
              <Box px={4} py={3} borderTop="1px solid" borderColor="border.subtle" bg="white">
                <Text fontSize="xs" color="fg.muted" mb={2.5} lineHeight={1.4}>
                  By confirming, you link these faces to your profile. Your name will be tagged in the orientation gallery.
                </Text>
                <Button
                  w="100%"
                  h="48px"
                  bg="brand.solid"
                  color="white"
                  borderRadius="xl"
                  fontWeight="700"
                  fontSize="sm"
                  loading={claiming}
                  onClick={handleExecuteClaim}
                  _hover={{ bg: "brand.600" }}
                  disabled={personAssets.length === 0 && !claiming}
                >
                  Confirm Claim — {selectedPersonIds.length} Face{selectedPersonIds.length > 1 ? "s" : ""}
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      </Flex>

      {/* MOBILE FLOATING ACTION MENU BAR */}
      {selectedPersonIds.length > 0 && (
        <Box
          display={{ base: "block", lg: "none" }}
          position="fixed"
          bottom="20px"
          left="16px"
          right="16px"
          zIndex={1000}
        >
          <Flex
            bg="rgba(28, 18, 12, 0.94)"
            backdropFilter="blur(16px)"
            border="1px solid rgba(255, 255, 255, 0.18)"
            borderRadius="24px"
            p={3}
            px={4}
            align="center"
            justify="space-between"
            boxShadow="0 16px 40px rgba(0, 0, 0, 0.4)"
          >
            <HStack gap={2.5}>
              <Badge
                bg="accent.solid"
                color="brand.900"
                fontSize="xs"
                fontWeight="800"
                px={3}
                py={1}
                borderRadius="full"
              >
                {selectedPersonIds.length} Selected
              </Badge>
              {!isGuest && personAssets.length > 0 && (
                <Text
                  fontSize="xs"
                  color="whiteAlpha.800"
                  fontWeight="600"
                  cursor="pointer"
                  textDecoration="underline"
                  onClick={() => setIsMobilePreviewOpen(true)}
                >
                  Preview ({personAssets.length} pics)
                </Text>
              )}
            </HStack>

            <HStack gap={2}>
              {isGuest ? (
                <Button
                  size="sm"
                  bg="accent.solid"
                  color="brand.900"
                  borderRadius="xl"
                  fontWeight="700"
                  onClick={() => navigate("/login", { state: { from: location.pathname } })}
                >
                  Login
                </Button>
              ) : (
                <Button
                  size="sm"
                  bg="accent.solid"
                  color="brand.900"
                  borderRadius="xl"
                  fontWeight="800"
                  px={5}
                  h="40px"
                  loading={claiming}
                  onClick={handleExecuteClaim}
                  cursor="pointer"
                >
                  Claim ({selectedPersonIds.length})
                </Button>
              )}
            </HStack>
          </Flex>
        </Box>
      )}

      {/* MOBILE PHOTO PREVIEW MODAL / DRAWER */}
      {isMobilePreviewOpen && (
        <Box
          position="fixed"
          inset={0}
          zIndex={2000}
          bg="rgba(0, 0, 0, 0.6)"
          backdropFilter="blur(8px)"
          display="flex"
          alignItems="flex-end"
          onClick={() => setIsMobilePreviewOpen(false)}
        >
          <Box
            w="100%"
            bg="var(--c-ivory)"
            borderTopRadius="24px"
            p={5}
            maxH="80vh"
            overflowY="auto"
            onClick={(e) => e.stopPropagation()}
            boxShadow="0 -10px 40px rgba(0,0,0,0.3)"
          >
            <Flex justify="space-between" align="center" mb={4}>
              <Box>
                <Heading size="xs" fontWeight="700" color="brand.900">
                  Matching Photos Preview
                </Heading>
                <Text fontSize="xs" color="fg.subtle">
                  Showing {displayedAssets.length} of {personAssets.length} photos
                </Text>
              </Box>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setIsMobilePreviewOpen(false)}
                cursor="pointer"
              >
                Close
              </Button>
            </Flex>

            <Box display="grid" gridTemplateColumns="repeat(3, 1fr)" gap={2} mb={4}>
              {displayedAssets.map((asset, idx) => (
                <Box
                  key={asset.id}
                  borderRadius="lg"
                  overflow="hidden"
                  aspectRatio={1}
                  onClick={() => openLightbox(idx, personAssets)}
                >
                  <ImmichImage
                    endpoint={immich.assets.thumbnailUrl(asset.id, "thumbnail")}
                    w="100%"
                    h="100%"
                    objectFit="cover"
                  />
                </Box>
              ))}
            </Box>

            {personAssets.length > PREVIEW_LIMIT && (
              <Button
                w="100%"
                size="sm"
                variant="outline"
                mb={3}
                onClick={() => setShowAllPhotos((prev) => !prev)}
              >
                {showAllPhotos
                  ? "Show Fewer Photos"
                  : `+ View All ${personAssets.length} Photos`}
              </Button>
            )}

            <Button
              w="100%"
              h="44px"
              bg="brand.solid"
              color="white"
              borderRadius="xl"
              fontWeight="700"
              loading={claiming}
              onClick={handleExecuteClaim}
            >
              Confirm Claim Face
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
