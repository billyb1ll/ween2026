import {
  Box,
  Flex,
  Heading,
  SimpleGrid,
  Text,
  VStack,
  Button,
  Spinner,
  Input,
  Collapsible,
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



const GridList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ style, children, ...props }, ref) => (
  <Box ref={ref} style={style} {...props} display="grid" gridTemplateColumns={{ base: "repeat(3, 1fr)", sm: "repeat(4, 1fr)", md: "repeat(6, 1fr)", lg: "repeat(8, 1fr)" }} gap={4} p={2}>
    {children}
  </Box>
));

const GridItem = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <Box {...props}>{children}</Box>
);

const PreviewGridList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ style, children, ...props }, ref) => (
  <Box ref={ref} style={style} {...props} display="grid" gridTemplateColumns={{ base: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", md: "repeat(4, 1fr)" }} gap={4} p={4}>
    {children}
  </Box>
));

const PreviewGridItem = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <Box {...props}>{children}</Box>
);

export function FaceClaimPage() {
  const { user, updateProfile, refreshClaimedFaceStatus } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  const [unclaimedPeople, setUnclaimedPeople] = useState<ImmichPerson[]>([]);
  const [personAssets, setPersonAssets] = useState<ImmichAsset[]>([]);
  
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [loadingPersonAssets, setLoadingPersonAssets] = useState(false);
  const [claiming, setClaiming] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  
  // Support multi-select
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const { openLightbox, virtuosoRef } = useGalleryLightbox();

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
    if (!searchQuery) return unclaimedPeople;
    return unclaimedPeople.filter(p => p.id.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [unclaimedPeople, searchQuery]);

  const handleSelectPerson = async (personId: string) => {
    setSelectedPersonIds((prev) => {
      if (prev.includes(personId)) {
        return prev.filter((id) => id !== personId);
      } else {
        return [...prev, personId];
      }
    });
  };

  // When selection changes, fetch assets for ALL selected people
  useEffect(() => {
    let active = true;
    // If no selection or if user is a guest (guests can't see the photos anyway), skip fetching.
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

      // Update Supabase using the first available asset
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

      // Dual write: Supabase user_faces table
      const inserts = selectedPersonIds.map(id => ({
        student_id: user.student_id,
        immich_person_id: id
      }));
      
      const { error: sbError } = await supabase.from('user_faces').insert(inserts);
      if (sbError && sbError.code !== '23505') { // Ignore unique constraint violations
        console.error("Supabase insert error:", sbError);
      }

      const defaultName = `Student ${user.student_id}`;
      const formattedName = (user.full_name && user.full_name.trim() !== "" 
        ? `${user.nickname || "Student"} (${user.full_name.trim()})` 
        : user.nickname) || defaultName;

      // Dual write: Update Immich for ALL selected people
      await Promise.all(
        selectedPersonIds.map((id) => immich.people.update(id, { name: formattedName }))
      );

      toaster.create({
        title: "Claim Successful",
        description: avatarUpdated ? "Successfully claimed faces and updated profile picture." : "Successfully claimed faces.",
        type: "success",
      });

      refreshClaimedFaceStatus();

      setUnclaimedPeople((prev) => prev.filter((p) => !selectedPersonIds.includes(p.id)));
      setSelectedPersonIds([]);
      setPersonAssets([]);
    } catch (err) {
      console.error("Execute claim error:", err);
      toaster.create({
        title: "Claim Failed",
        description: "Failed to commit face claim. Please try again.",
        type: "error",
      });
    } finally {
      setClaiming(false);
    }
  };

  return (
    <Flex direction="column" position="relative" maxW="var(--container-max)" mx="auto" px={{ base: 4, md: 16 }} pt={{ base: 2, md: 28 }} pb={32} minH="100vh">
      <VStack gap={2} mb={{ base: 6, md: 8 }} animation="fade-in-up 0.6s var(--ease-out-expo) both">
        <Heading as="h1" fontSize={{ base: "2rem", md: "3.5rem" }} color="brand.900" textAlign="center">
          Claim Your Faces
        </Heading>
        <Text color="fg.muted" textAlign="center" maxW="lg">
          Select all faces that belong to you to link them to your profile.
        </Text>
      </VStack>

      <Box mb={6} maxW="md" mx="auto">
        <Input 
          placeholder="Filter faces (e.g. by partial ID)..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          bg="white"
          borderRadius="full"
          boxShadow="sm"
        />
      </Box>

      <Box mb={8}>
        {loadingPeople ? (
          <Flex justify="center" py={6}><Spinner size="lg" color="brand.solid" /></Flex>
        ) : filteredPeople.length === 0 ? (
          <Flex justify="center" py={6} bg="bg.surface" border="1px dashed" borderColor="border.subtle" borderRadius="2xl">
            <Text color="fg.subtle">No unclaimed faces found in the database.</Text>
          </Flex>
        ) : (
          <Box w="100%">
            <VirtuosoGrid
              data={filteredPeople}
              useWindowScroll
              components={{
                List: GridList,
                Item: GridItem
              }}
              itemContent={(_, person) => {
                const isSelected = selectedPersonIds.includes(person.id);
                return (
                  <VStack 
                    onClick={() => handleSelectPerson(person.id)} 
                    cursor="pointer" align="center" gap={2}
                    p={2}
                    borderRadius="xl"
                    transition="all 0.2s var(--ease-out-quart)"
                    _hover={{ bg: "bg.muted" }}
                    position="relative"
                    minH="48px"
                    minW="48px"
                  >
                    <Box 
                      w="72px" h="72px" borderRadius="full" position="relative"
                      border={isSelected ? "3px solid var(--chakra-colors-brand-solid)" : "2px dashed var(--chakra-colors-fg-muted)"} 
                      p="2px" 
                      transition="all 0.2s" 
                      transform={isSelected ? "scale(1.05)" : "none"}
                    >
                      <Box w="100%" h="100%" borderRadius="full" overflow="hidden">
                        <ImmichImage endpoint={immich.people.thumbnailUrl(person.id)} alt="Anonymous face" w="100%" h="100%" objectFit="cover" decoding="async" />
                      </Box>
                      {isSelected && (
                        <Flex 
                          position="absolute" top="-4px" right="-4px" 
                          bg="brand.solid" w="24px" h="24px" borderRadius="full" 
                          align="center" justify="center" color="white"
                          boxShadow="sm"
                        >
                          <Box as="span" className="material-symbols-outlined" fontSize="16px">check</Box>
                        </Flex>
                      )}
                    </Box>
                  </VStack>
                );
              }}
            />
          </Box>
        )}
      </Box>

      {/* Sticky Bottom Footer */}
      {selectedPersonIds.length > 0 && (
        <Box 
          position="fixed" bottom="0" left="0" right="0" zIndex="sticky" 
          animation="fade-in-up 0.4s var(--ease-out-expo) both"
          pointerEvents="none"
        >
          <Collapsible.Root defaultOpen={false}>
            <Collapsible.Content>
              <Box pointerEvents="auto" bg="whiteAlpha.950" backdropFilter="blur(8px)" borderTop="1px solid" borderColor="border.subtle" p={{ base: 4, md: 6 }} pb={0} boxShadow="0 -4px 12px rgba(0,0,0,0.05)">
                <Box maxW="var(--container-max)" mx="auto" w="100%">
                  {!user ? (
                    <Flex justify="center" align="center" direction="column" py={8} bg="bg.surface" border="1px dashed" borderColor="border.subtle" borderRadius="2xl" mb={4}>
                      <Box as="span" className="material-symbols-outlined" fontSize="48px" color="fg.subtle" mb={4}>lock</Box>
                      <Text color="fg.muted" mb={6} textAlign="center" maxW="sm">
                        Login to view full photos matching this face and claim it as yours.
                      </Text>
                      <Button onClick={() => navigate("/login", { state: { from: location.pathname } })} bg="brand.solid" color="white" borderRadius="xl" px={8} h="48px" _hover={{ bg: "brand.600" }}>
                        Login to Claim
                      </Button>
                    </Flex>
                  ) : loadingPersonAssets ? (
                    <SimpleGrid columns={{ base: 2, sm: 3, md: 4 }} gap={4} mb={4}>
                      {[1, 2, 3, 4].map((n) => <Box key={n} borderRadius="xl" bg="color-mix(in srgb, var(--chakra-colors-accent-solid) 5%, var(--chakra-colors-white) 95%)" h="200px" animation="pulse 2s infinite ease-in-out" />)}
                    </SimpleGrid>
                  ) : personAssets.length === 0 ? (
                    <Flex justify="center" py={12} bg="bg.surface" border="1px dashed" borderColor="border.subtle" borderRadius="2xl" mb={4}><Text color="fg.subtle">No photos matched this face classification.</Text></Flex>
                  ) : (
                    <Box flex="1" w="100%" h="400px" borderRadius="xl" overflow="hidden" border="1px solid" borderColor="border.subtle" mb={4} bg="bg.surface">
                      <VirtuosoGrid
                        ref={virtuosoRef}
                        data={personAssets}
                        useWindowScroll={false}
                        style={{ height: '100%', width: '100%' }}
                        components={{
                          List: PreviewGridList,
                          Item: PreviewGridItem
                        }}
                        itemContent={(index, asset) => (
                          <Box position="relative" borderRadius="xl" overflow="hidden" cursor="pointer" onClick={() => openLightbox(index, personAssets)} transition="all 0.3s var(--ease-out-quart)" _hover={{ transform: "translateY(-2px)", boxShadow: "var(--shadow-card-hover)" }}>
                            <Box h={{ base: "160px", sm: "200px", md: "240px" }}>
                              <ImmichImage endpoint={immich.assets.thumbnailUrl(asset.id, "thumbnail")} w="100%" h="100%" objectFit="cover" decoding="async" />
                            </Box>
                          </Box>
                        )}
                      />
                    </Box>
                  )}
                </Box>
              </Box>
            </Collapsible.Content>

            <Flex 
              pointerEvents="auto"
              bg="whiteAlpha.900" backdropFilter="blur(8px)" borderTop="1px solid" borderColor="border.subtle"
              p={{ base: 4, md: 6 }} align="center" justify="center"
              boxShadow="0 -4px 12px rgba(0,0,0,0.05)"
            >
              <Flex maxW="var(--container-max)" w="100%" align="center" justify="space-between" px={{ base: 2, md: 8 }}>
                <Collapsible.Trigger asChild>
                  <Flex cursor="pointer" _hover={{ opacity: 0.8 }} transition="opacity 0.2s" align="center" gap={3}>
                    <VStack align="start" gap={0}>
                      <Text fontSize={{ base: "sm", md: "md" }} fontWeight="700" color="brand.900">
                        {selectedPersonIds.length} Face{selectedPersonIds.length > 1 ? 's' : ''} Selected
                      </Text>
                      <Text fontSize="xs" color="fg.muted" display={{ base: "none", sm: "block" }}>
                        {user ? "Tap to review photos before confirming." : "Login to review photos and claim."}
                      </Text>
                    </VStack>
                    <Box as="span" className="material-symbols-outlined" fontSize="24px" color="brand.600">
                      expand_less
                    </Box>
                  </Flex>
                </Collapsible.Trigger>
                {!user ? (
                  <Button h={{ base: "44px", md: "52px" }} px={{ base: 6, md: 10 }} bg="brand.solid" color="white" borderRadius="xl" fontWeight="700" fontSize={{ base: "sm", md: "md" }} onClick={() => navigate("/login", { state: { from: location.pathname } })} _hover={{ bg: "brand.600" }}>
                    Login to Claim
                  </Button>
                ) : (
                  <Button h={{ base: "44px", md: "52px" }} px={{ base: 6, md: 10 }} bg="brand.solid" color="white" borderRadius="xl" fontWeight="700" fontSize={{ base: "sm", md: "md" }} loading={claiming} onClick={handleExecuteClaim} _hover={{ bg: "brand.600" }}>
                    Confirm Selection
                  </Button>
                )}
              </Flex>
            </Flex>
          </Collapsible.Root>
        </Box>
      )}
    </Flex>
  );
}
