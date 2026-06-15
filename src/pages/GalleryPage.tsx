import {
  Box,
  Flex,
  Heading,
  SimpleGrid,
  Text,
  VStack,
  Image,
  Button,
  Spinner,
  Dialog,
} from "@chakra-ui/react";
import { useState, useEffect } from "react";
import { useUser } from "../context/UserContext";
import { toaster } from "../components/ui/toaster";

interface ImmichAsset {
  id: string;
  createdAt: string;
  thumbhash?: string;
}

interface ImmichPerson {
  id: string;
  name: string;
}

export function GalleryPage() {
  const { user, updateProfile } = useUser();
  const proxyUrl = "/api/immich";

  const [viewMode, setViewMode] = useState<'photos' | 'unclaimed'>('photos');
  const [activeDay, setActiveDay] = useState<'day1' | 'day2' | 'day3'>('day1');
  
  // Data States
  const [photos, setPhotos] = useState<ImmichAsset[]>([]);
  const [people, setPeople] = useState<ImmichPerson[]>([]);
  const [unclaimedPeople, setUnclaimedPeople] = useState<ImmichPerson[]>([]);
  const [personAssets, setPersonAssets] = useState<ImmichAsset[]>([]);
  
  // Loading States
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [loadingPersonAssets, setLoadingPersonAssets] = useState(false);
  const [claiming, setClaiming] = useState(false);
  
  // Selection States
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<ImmichAsset | null>(null);

  // 1. Fetch people list securely via proxy
  useEffect(() => {
    const fetchPeople = async () => {
      try {
        const res = await fetch(`${proxyUrl}/people`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.people || []);
        
        // Split into claimed (identified) and unclaimed (anonymous)
        setUnclaimedPeople(list.filter((p: ImmichPerson) => !p.name || p.name.trim() === ""));
        setPeople(list.filter((p: ImmichPerson) => p.name && p.name.trim() !== ""));
      } catch (err) {
        console.error("Error fetching people:", err);
      } finally {
        setLoadingPeople(false);
      }
    };
    fetchPeople();
  }, []);

  // 2. Fetch global album photos based on active tab
  useEffect(() => {
    if (viewMode === 'unclaimed') return; // Don't fetch global photos if viewing unclaimed
    if (selectedPersonId) return; // Don't fetch global if viewing a specific person

    const fetchPhotos = async () => {
      setLoadingPhotos(true);
      setPhotos([]);
      try {
        // Resolve album ID dynamically from the mapped name
        const albumsRes = await fetch(`${proxyUrl}/albums?name=${activeDay}`);
        const albumsData = await albumsRes.json();
        const album = Array.isArray(albumsData) && albumsData.length > 0 ? albumsData[0] : null;

        if (album && album.id) {
          const assetsRes = await fetch(`${proxyUrl}/albums/${album.id}`);
          const data = await assetsRes.json();
          const list = data.assets || (Array.isArray(data) ? data : []);
          setPhotos(list as ImmichAsset[]);
        }
      } catch (err) {
        console.error("Error fetching gallery photos:", err);
      } finally {
        setLoadingPhotos(false);
      }
    };
    
    fetchPhotos();
  }, [activeDay, viewMode, selectedPersonId]);

  // 3. Fetch specific person's assets
  const handleSelectPerson = async (personId: string) => {
    if (selectedPersonId === personId) {
      // Toggle off
      setSelectedPersonId(null);
      setPersonAssets([]);
      return;
    }
    
    setSelectedPersonId(personId);
    setLoadingPersonAssets(true);
    setPersonAssets([]);

    try {
      const res = await fetch(`${proxyUrl}/search/metadata`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personIds: [personId] }),
      });

      if (!res.ok) throw new Error("Search query failed");
      const data = await res.json();
      const list = data.assets?.items || (Array.isArray(data) ? data : []);
      setPersonAssets(list as ImmichAsset[]);
    } catch (err) {
      console.error("Search assets error:", err);
      toaster.create({
        title: "Query Error",
        description: "Failed to retrieve photos for selected face.",
        type: "error",
      });
    } finally {
      setLoadingPersonAssets(false);
    }
  };

  // 4. Handle self-serve claim (when in unclaimed mode)
  const handleExecuteClaim = async () => {
    if (!user || !selectedPersonId) return;
    setClaiming(true);

    try {
      let avatarUpdated = false;

      // Write A: Supabase Core Update
      if (personAssets.length > 0) {
        const previewUrl = `${proxyUrl}/assets/${personAssets[0].id}/thumbnail?size=is_preview`;
        const success = await updateProfile({
          nickname: user.nickname || "Student",
          faculty: user.faculty || "",
          major: user.major || undefined,
          ig: user.ig || undefined,
          avatarColor: user.avatar_color,
          bio: user.bio || undefined,
          profilePicUrl: previewUrl,
          photoPool: user.photo_pool || [],
          housePosition: user.house_position || undefined,
          immichAssetId: personAssets[0].id,
        });

        if (success) {
          avatarUpdated = true;
        }
      }

      // Write B: Immich Server Naming Loop
      const formattedName = user.full_name && user.full_name.trim() !== "" 
        ? `${user.nickname} (${user.full_name.trim()})` 
        : user.nickname;

      const feedbackRes = await fetch(`${proxyUrl}/people/${selectedPersonId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formattedName }),
      });

      if (!feedbackRes.ok) throw new Error("Naming feedback loop failed");

      if (personAssets.length === 0) {
        toaster.create({
          title: "Face Bound",
          description: "Claimed face, but no valid profile asset found to update avatar.",
          type: "warning",
        });
      } else {
        toaster.create({
          title: "Claim Successful",
          description: avatarUpdated ? "Successfully claimed face and updated profile picture." : "Successfully claimed face.",
          type: "success",
        });
      }

      // Filter out claimed person from local state smoothly
      setUnclaimedPeople((prev) => prev.filter((p) => p.id !== selectedPersonId));
      setSelectedPersonId(null);
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

  // Keyboard dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedAsset(null);
    };
    if (selectedAsset) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedAsset]);

  const activeAssets = selectedPersonId ? personAssets : photos;
  const loadingActiveAssets = selectedPersonId ? loadingPersonAssets : loadingPhotos;

  return (
    <Box position="relative" zIndex={10} maxW="var(--container-max)" mx="auto" px={{ base: 4, md: 16 }} pt={{ base: 2, md: 28 }} pb={{ base: 4, md: 20 }} minH="100vh">
      {/* Page Header */}
      <VStack gap={2} mb={{ base: 6, md: 8 }} animation="fade-in-up 0.6s var(--ease-out-expo) both">
        <Heading as="h1" fontFamily="heading" fontSize={{ base: "2rem", md: "3.5rem" }} fontWeight={700} lineHeight={1.1} letterSpacing="-0.02em" color="accent.solid" textAlign="center">
          {viewMode === 'photos' ? 'Baan 7 Gallery' : 'Unclaimed Faces'}
        </Heading>
        <Text color="fg.muted" fontSize={{ base: "sm", md: "lg" }} textAlign="center" maxW="lg">
          {viewMode === 'photos' 
            ? 'Relive the moments. View photos from our orientation activities.'
            : 'Select your face from the anonymous list below to link it to your orientation profile.'}
        </Text>
      </VStack>

      {/* Sub-Onboarding Toggle (Premium Dashed Ribbon) */}
      <Box mb={8} animation="fade-in-up 0.7s var(--ease-out-expo) both">
        <Flex
          w="100%"
          bg="var(--c-ivory)"
          border="2px dashed"
          borderColor="var(--c-chocolate)"
          borderRadius="xl"
          p={{ base: 4, md: 5 }}
          align="center"
          justify="center"
          cursor="pointer"
          role="button"
          tabIndex={0}
          aria-label="Toggle gallery view"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setViewMode(viewMode === 'photos' ? 'unclaimed' : 'photos');
              setSelectedPersonId(null);
            }
          }}
          onClick={() => {
            setViewMode(viewMode === 'photos' ? 'unclaimed' : 'photos');
            setSelectedPersonId(null);
          }}
          transition="all 0.3s var(--ease-out-quart)"
          _hover={{
            bg: "color-mix(in srgb, var(--c-chocolate) 4%, var(--c-ivory) 96%)",
            transform: "translateY(-2px)",
            boxShadow: "var(--shadow-card-hover)"
          }}
        >
          <Box as="span" className="material-symbols-outlined" fontSize="24px" color="accent.solid" mr={3}>
            {viewMode === 'photos' ? 'person_search' : 'photo_library'}
          </Box>
          <Text color="accent.solid" fontWeight="700" fontSize={{ base: "sm", md: "md" }} letterSpacing="0.02em" textAlign="center">
            {viewMode === 'photos' 
              ? 'Cannot find your photos? Try searching for your face using our AI face finder.'
              : 'Back to main photo gallery'}
          </Text>
        </Flex>
      </Box>

      {/* Unified Console View Engine */}
      {viewMode === 'photos' ? (
        <>
          {/* Daily Control Bar Tabs */}
          <Flex justify="center" mb={6} gap={2}>
            {['day1', 'day2', 'day3'].map((dayKey) => (
              <Button
                key={dayKey}
                onClick={() => {
                  setActiveDay(dayKey as 'day1' | 'day2' | 'day3');
                  setSelectedPersonId(null);
                }}
                h="44px"
                px={6}
                borderRadius="full"
                fontWeight="600"
                fontSize="sm"
                variant={activeDay === dayKey && !selectedPersonId ? 'solid' : 'outline'}
                bg={activeDay === dayKey && !selectedPersonId ? 'var(--c-chocolate)' : 'transparent'}
                color={activeDay === dayKey && !selectedPersonId ? 'white' : 'var(--c-chocolate)'}
                borderColor="var(--c-chocolate)"
                _hover={{ bg: activeDay === dayKey && !selectedPersonId ? 'var(--c-chocolate)' : 'color-mix(in srgb, var(--c-chocolate) 5%, transparent)' }}
                cursor="pointer"
                transition="all 0.3s var(--ease-out-quart)"
              >
                Day {dayKey.replace('day', '')}
              </Button>
            ))}
          </Flex>

          {/* Face Recognition Row (Identified People) */}
          {!loadingPeople && people.length > 0 && (
            <Box mb={10}>
              <Text fontSize="xs" fontWeight="700" color="var(--c-muted)" mb={3} textTransform="uppercase" letterSpacing="0.05em">
                Detected Faces
              </Text>
              <Flex
                overflowX="auto"
                py={4}
                px={2}
                gap={4}
                w="100%"
                bg="var(--c-white)"
                borderRadius="2xl"
                border="1px solid"
                borderColor="border.subtle"
                boxShadow="var(--shadow-card)"
                css={{ "&::-webkit-scrollbar": { display: "none" }, scrollbarWidth: "none" }}
              >
                {people.map((person) => (
                  <VStack 
                    key={person.id} 
                    onClick={() => handleSelectPerson(person.id)} 
                    cursor="pointer" align="center" gap={1.5} minW="60px"
                    role="button"
                    tabIndex={0}
                    aria-label={`Filter photos by face: ${person.name || "Unknown"}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectPerson(person.id);
                      }
                    }}
                  >
                    <Box
                      borderRadius="full"
                      border={selectedPersonId === person.id ? "2.5px solid var(--c-chocolate)" : "2.5px solid transparent"}
                      p="2px"
                      transition="all 0.3s var(--ease-out-quart)"
                      transform={selectedPersonId === person.id ? "scale(1.08)" : "none"}
                    >
                      <Box w="44px" h="44px" minW="44px" minH="44px" borderRadius="full" overflow="hidden" border="2px solid var(--c-chocolate)" bg="var(--c-ivory)">
                        <Image src={`${proxyUrl}/people/${person.id}/thumbnail`} alt={`Face crop of ${person.name || "detected person"} from gallery album`} w="100%" h="100%" objectFit="cover" draggable={false} />
                      </Box>
                    </Box>
                    <Text fontSize="2xs" fontWeight="600" color={selectedPersonId === person.id ? "accent.solid" : "fg.muted"} textAlign="center" maxW="60px" truncate>
                      {person.name || "Unknown"}
                    </Text>
                  </VStack>
                ))}
              </Flex>
            </Box>
          )}

          {/* Main Photo Layout Grid */}
          <Text fontSize="xs" fontWeight="700" color="var(--c-muted)" mb={4} textTransform="uppercase" letterSpacing="0.05em">
            {selectedPersonId ? "Discovered Photo Stream" : `Day ${activeDay.replace('day', '')} Gallery`}
          </Text>

          {loadingActiveAssets ? (
            <SimpleGrid columns={{ base: 2, sm: 3, md: 4 }} gap={{ base: 3, md: 4 }}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <Box key={n} borderRadius="xl" overflow="hidden" bg="color-mix(in srgb, var(--c-chocolate) 5%, var(--c-white) 95%)" h="200px" animation="pulse 2s infinite ease-in-out" />
              ))}
            </SimpleGrid>
          ) : activeAssets.length === 0 ? (
            <Flex justify="center" py={12} bg="bg.surface" border="1px dashed" borderColor="border.subtle" borderRadius="2xl">
              <Text color="fg.subtle">No photos found in this view.</Text>
            </Flex>
          ) : (
            <SimpleGrid columns={{ base: 2, sm: 3, md: 4 }} gap={{ base: 3, md: 4 }}>
              {activeAssets.map((asset, i) => (
                <Box
                  key={asset.id}
                  position="relative"
                  borderRadius="xl"
                  overflow="hidden"
                  cursor="pointer"
                  onClick={() => setSelectedAsset(asset)}
                  transition="transform 0.5s var(--ease-out-quart)"
                  _hover={{ transform: "translateY(-2px)", boxShadow: "var(--shadow-card-hover)" }}
                  animation={`scale-in 0.5s var(--ease-out-expo) ${Math.min(0.05 + i * 0.04, 0.35)}s both`}
                >
                  <Box h={{ base: "160px", sm: "200px", md: "240px" }}>
                    <Image src={`${proxyUrl}/assets/${asset.id}/thumbnail?size=thumbnail`} alt={`Baan 7 orientation activity image for Day ${activeDay === 'day1' ? '1' : activeDay === 'day2' ? '2' : '3'}`} w="100%" h="100%" objectFit="cover" loading="lazy" draggable={false} />
                  </Box>
                </Box>
              ))}
            </SimpleGrid>
          )}
        </>
      ) : (
        /* Unclaimed Anonymous Grid View */
        <Box mb={8}>
          {loadingPeople ? (
            <Flex justify="center" py={6}><Spinner size="lg" color="var(--c-lagoon)" /></Flex>
          ) : unclaimedPeople.length === 0 ? (
            <Flex justify="center" py={6} bg="bg.surface" border="1px dashed" borderColor="border.subtle" borderRadius="2xl">
              <Text color="fg.subtle">No unclaimed faces found in the database.</Text>
            </Flex>
          ) : (
            <SimpleGrid columns={{ base: 3, sm: 4, md: 6 }} gap={4}>
              {unclaimedPeople.map((person) => (
                <VStack 
                  key={person.id} 
                  onClick={() => handleSelectPerson(person.id)} 
                  cursor="pointer" align="center" gap={2}
                  role="button"
                  tabIndex={0}
                  aria-label="Select this face to claim identity"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectPerson(person.id);
                    }
                  }}
                >
                  <Box w="44px" h="44px" minW="44px" minH="44px" borderRadius="full" border={selectedPersonId === person.id ? "2px solid var(--c-chocolate)" : "2px dashed var(--c-chocolate)"} p="2px" transition="all 0.3s var(--ease-out-quart)" transform={selectedPersonId === person.id ? "scale(1.1)" : "none"}>
                    <Box w="100%" h="100%" borderRadius="full" overflow="hidden">
                      <Image src={`${proxyUrl}/people/${person.id}/thumbnail`} alt="Anonymous face detected in orientation album" w="100%" h="100%" objectFit="cover" draggable={false} />
                    </Box>
                  </Box>
                </VStack>
              ))}
            </SimpleGrid>
          )}

          {/* Sticky Claim Header when person selected */}
          {selectedPersonId && viewMode === 'unclaimed' && (
            <Box animation="scale-in 0.4s var(--ease-out-quart)" mt={8}>
              <Flex position="sticky" top="80px" zIndex={20} bg="var(--c-ivory)" border="2px solid var(--c-chocolate)" borderRadius="xl" p={4} align="center" justify="space-between" boxShadow="var(--shadow-card)" mb={6}>
                <VStack align="start" gap={0}>
                  <Text fontSize="sm" fontWeight="700" color="accent.solid">Reviewing Face Photos</Text>
                  <Text fontSize="xs" color="fg.muted">Ensure this is you before confirming.</Text>
                </VStack>
                <Button h="44px" px={6} bg="accent.solid" color="white" borderRadius="xl" fontWeight="700" fontSize="sm" loading={claiming} onClick={handleExecuteClaim} cursor="pointer" _hover={{ bg: "chocolate.600" }}>
                  Claim This Face
                </Button>
              </Flex>

              {loadingPersonAssets ? (
                <SimpleGrid columns={{ base: 2, sm: 3, md: 4 }} gap={{ base: 3, md: 4 }}>
                  {[1, 2, 3, 4].map((n) => <Box key={n} borderRadius="xl" bg="color-mix(in srgb, var(--c-chocolate) 5%, var(--c-white) 95%)" h="200px" animation="pulse 2s infinite ease-in-out" />)}
                </SimpleGrid>
              ) : personAssets.length === 0 ? (
                <Flex justify="center" py={12} bg="bg.surface" border="1px dashed" borderColor="border.subtle" borderRadius="2xl"><Text color="fg.subtle">No photos matched this face classification.</Text></Flex>
              ) : (
                <SimpleGrid columns={{ base: 2, sm: 3, md: 4 }} gap={{ base: 3, md: 4 }}>
                  {personAssets.map((asset, i) => (
                    <Box key={asset.id} position="relative" borderRadius="xl" overflow="hidden" cursor="pointer" onClick={() => setSelectedAsset(asset)} transition="all 0.3s var(--ease-out-quart)" _hover={{ transform: "translateY(-2px)", boxShadow: "var(--shadow-card-hover)" }} animation={`scale-in 0.5s var(--ease-out-expo) ${Math.min(0.05 + i * 0.04, 0.35)}s both`}>
                      <Box h={{ base: "160px", sm: "200px", md: "240px" }}>
                        <Image src={`${proxyUrl}/assets/${asset.id}/thumbnail?size=thumbnail`} alt={`Baan 7 orientation activity image for Day ${activeDay === 'day1' ? '1' : activeDay === 'day2' ? '2' : '3'}`} w="100%" h="100%" objectFit="cover" loading="lazy" draggable={false} />
                      </Box>
                    </Box>
                  ))}
                </SimpleGrid>
              )}
            </Box>
          )}
        </Box>
      )}

      {/* Modal Preview */}
      {selectedAsset && (
        <Dialog.Root open={!!selectedAsset} onOpenChange={(e) => { if (!e.open) setSelectedAsset(null); }} placement={{ base: "bottom", md: "center" }}>
          <Dialog.Backdrop bg="color-mix(in srgb, var(--c-ink) 70%, transparent)" backdropFilter="blur(4px)" />
          <Dialog.Positioner zIndex={2000} px={4}>
            <Dialog.Content bg="var(--c-ivory)" border={{ base: "none", md: "2px solid var(--c-chocolate)" }} color="var(--c-ink)" borderRadius={{ base: "t-3xl", md: "2xl" }} width={{ base: "100%", md: "640px" }} maxH={{ base: "90vh", sm: "80vh" }} p={6} boxShadow="var(--shadow-card)" display="flex" flexDirection="column" position="relative" overflowY="auto">
              <VStack align="stretch" gap={4}>
                <Box borderRadius="lg" overflow="hidden" maxH="55vh">
                  <Image src={`${proxyUrl}/assets/${selectedAsset.id}/thumbnail?size=is_preview`} alt="Full preview of orientation activity photo" w="100%" h="auto" maxH="55vh" objectFit="contain" mx="auto" />
                </Box>
                <Dialog.Footer p={0} justifyContent="flex-end" gap={3}>
                  <Dialog.CloseTrigger asChild>
                    <Button variant="outline" h="44px" borderRadius="xl" cursor="pointer" onClick={() => setSelectedAsset(null)}>Close</Button>
                  </Dialog.CloseTrigger>
                </Dialog.Footer>
              </VStack>
              <Dialog.CloseTrigger position="absolute" top={4} right={4} asChild>
                <Button variant="ghost" w="44px" h="44px" minW="44px" borderRadius="full" display="flex" alignItems="center" justifyContent="center" cursor="pointer" color="var(--c-muted)" p={0} onClick={() => setSelectedAsset(null)}>
                  <Box as="span" className="material-symbols-outlined" fontSize="20px">close</Box>
                </Button>
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Root>
      )}
    </Box>
  );
}
