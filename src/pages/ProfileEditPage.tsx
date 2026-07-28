import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Container,
  Heading,
  Input,
  Text,
  VStack,
  HStack,
  Flex,
  Image,
  Textarea,
  Spinner,
  Badge,
} from "@chakra-ui/react";
import { useUser, type User } from "../context/UserContext";
import { useFaceClaim } from "../hooks/useFaceClaim";
import { supabase } from "../lib/supabase";
import { toaster } from "../components/ui/toaster";
import { STAFF_ROLES, FACULTIES } from "../lib/constants";
import { FacultySelect } from "../components/FacultySelect";
import { SearchableSelect } from "../components/SearchableSelect";
import { useWhitelistedStaff } from "../hooks/useVibeQueries";
import { Tabs } from "@chakra-ui/react";
import { useGalleryLightbox } from "../context/GalleryLightboxContext";
import { immich } from "../lib/immich";
import type { ImmichAsset } from "../lib/immich";



const PRESET_COLORS = [
  "var(--c-lagoon)",
  "var(--chakra-colors-accent-solid)",
  "var(--c-warm-muted)",
  "var(--c-light-cocoa)",
  "var(--c-sage-slate)",
  "var(--c-warm-ochre)",
];

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

interface SuggestedAsset {
  id: string;
  people?: Array<{ id: string; personId?: string }>;
  personId?: string;
}

interface ProfileEditFormProps {
  user: User;
}

function ProfileEditForm({ user }: ProfileEditFormProps) {
  const navigate = useNavigate();
  const { updateProfile, refreshClaimedFaceStatus } = useUser();

  const [nickname, setNickname] = useState(user?.nickname || "");
  const userFac = user?.faculty || "";
  const isKnown =
    userFac === "" ||
    FACULTIES.some(
      (f) =>
        f.short.toLowerCase() === userFac.toLowerCase() ||
        f.en.toLowerCase() === userFac.toLowerCase() ||
        f.th.toLowerCase() === userFac.toLowerCase()
    );
  const [faculty, setFaculty] = useState(isKnown ? userFac : "OTHER");
  const [customFaculty, setCustomFaculty] = useState(isKnown ? "" : userFac);
  const [major, setMajor] = useState(user?.major || "");
  const [ig, setIg] = useState(user?.ig || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [avatarColor, setAvatarColor] = useState(
    user?.avatar_color || PRESET_COLORS[0],
  );
  const [profilePicUrl, setProfilePicUrl] = useState(
    user?.profile_pic_url || "",
  );
  const [immichAssetId, setImmichAssetId] = useState<string | null>(
    user?.immich_asset_id || null,
  );
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // My Photos states
  const [myPhotos, setMyPhotos] = useState<ImmichAsset[]>([]);
  const [myClaimedFaces, setMyClaimedFaces] = useState<string[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const { openLightbox } = useGalleryLightbox();
  const [isImmichPickerOpen, setIsImmichPickerOpen] = useState(false);
  
  const { unclaimFace } = useFaceClaim();

  // House Position States (Option A predefined roles + custom fallback)
  const { data: allStaff = [] } = useWhitelistedStaff();

  const dynamicPositions = useMemo(() => {
    const positions = new Set<string>();
    allStaff.forEach((s) => {
      if (s.house_position) {
        positions.add(s.house_position);
      }
    });
    STAFF_ROLES.forEach((r) => positions.add(r));
    return Array.from(positions).sort();
  }, [allStaff]);

  const isCustomPosition =
    user?.house_position && !STAFF_ROLES.includes(user.house_position);
  const [housePosition, setHousePosition] = useState(
    user?.house_position || "",
  );
  const [selectedSelectRole, setSelectedSelectRole] = useState(
    isCustomPosition ? "Other" : user?.house_position || "",
  );
  const [customPositionText, setCustomPositionText] = useState(
    isCustomPosition ? user?.house_position || "" : "",
  );

  // Crop States
  const [isOpenCrop, setIsOpenCrop] = useState(false);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);

  const serverUrl = import.meta.env.VITE_IMMICH_SERVER_URL || "https://immich.b1lly.tech";

  const isComingSoon =
    !serverUrl ||
    serverUrl.includes("placeholder") ||
    serverUrl.includes("todo");

  const [suggestedAsset, setSuggestedAsset] = useState<SuggestedAsset | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  // AI Name-Tag smart search trigger
  useEffect(() => {
    if (!user?.nickname || isComingSoon) {
      const timer = setTimeout(() => setSuggestedAsset(null), 0);
      return () => clearTimeout(timer);
    }

    const fetchSuggestion = async () => {
      try {
        const token = localStorage.getItem("baan7_session_token");
        const res = await fetch(`/api/immich/search`, {
          method: "POST",
          headers: {
            "x-baan7-session": token || "",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ q: user.nickname }),
        });
        if (!res.ok) throw new Error("Smart search query failed");
        const data = await res.json();
        const assets = data.assets || (Array.isArray(data) ? data : []);
        if (assets.length > 0) {
          setSuggestedAsset(assets[0]);
        } else {
          setSuggestedAsset(null);
        }
      } catch (err) {
        console.error("Smart search exception:", err);
        setSuggestedAsset(null);
      }
    }

    fetchSuggestion();
  }, [user, serverUrl, isComingSoon]);

  // Fetch "My Photos"
  useEffect(() => {
    if (!user) return;
    const fetchUserPhotos = async () => {
      setLoadingPhotos(true);
      try {
        const { data, error } = await supabase
          .from('user_faces')
          .select('immich_person_id')
          .eq('student_id', user.student_id);

        if (error) throw error;

        const personIds = data.map(d => d.immich_person_id);
        setMyClaimedFaces(personIds);
        
        if (personIds.length > 0) {
          const assets = await immich.assets.searchMetadata({ personIds });
          setMyPhotos(assets.assets?.items || []);
        } else {
          setMyPhotos([]);
        }
      } catch (err) {
        console.error("Error fetching user photos:", err);
      } finally {
        setLoadingPhotos(false);
      }
    };
    fetchUserPhotos();
  }, [user]);

  const handleClaimSuggestion = async () => {
    if (!user || !suggestedAsset) return;
    try {
      const previewUrl = immich.assets.thumbnailUrl(suggestedAsset.id, "preview");
      
      // Write A (Local Core Sync)
      const success = await updateProfile({
        nickname: nickname.trim(),
        faculty: faculty.trim(),
        major: major.trim(),
        ig: ig.trim(),
        avatarColor,
        bio: bio.trim(),
        profilePicUrl: previewUrl,
        photoPool: user.photo_pool || [],
        housePosition: housePosition.trim(),
        immichAssetId: suggestedAsset.id,
      });

      if (success) {
        setProfilePicUrl(previewUrl);
        setImmichAssetId(suggestedAsset.id);

        // Write B (Immich AI Feedback Loop)
        const personId = suggestedAsset.people?.[0]?.id || suggestedAsset.people?.[0]?.personId || suggestedAsset.personId;
        
        if (personId) {
          try {
            const fullName = user.full_name || user.nickname || "Student";
            const token = localStorage.getItem("baan7_session_token");
            const feedbackRes = await fetch(`/api/immich/people/${personId}`, {
              method: "PUT",
              headers: {
                "x-baan7-session": token || "",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                name: `${user.nickname} (${fullName})`,
              }),
            });

            if (!feedbackRes.ok) {
              throw new Error("Feedback loop failed");
            }
          } catch (immichErr) {
            console.error("Immich metadata feedback write failed:", immichErr);
            // Gracefully handle: ensure primary avatar claim remains intact, emit clean warning toast
            toaster.create({
              title: "Name Sync Warning",
              description: "Avatar was updated, but face classification database sync failed.",
              type: "warning",
            });
          }
        }

        setSuggestedAsset(null);
        toaster.create({
          title: "Claim Successful",
          description: "Your profile picture has been updated with the suggested photo.",
          type: "success",
        });
        refreshClaimedFaceStatus();
      } else {
        throw new Error("Update failed");
      }
    } catch (err) {
      console.error("Claim suggestion failed:", err);
      toaster.create({
        title: "Claim Failed",
        description: "Failed to update profile picture with suggested photo.",
        type: "error",
      });
    }
  };

  const handleDismissSuggestion = () => {
    setSuggestedAsset(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        setImageObj(img);
        setIsOpenCrop(true);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleCropCancel = () => {
    setIsOpenCrop(false);
    setImageObj(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCropSave = async (blob: Blob) => {
    if (!user) return;

    setUploading(true);
    setIsOpenCrop(false);

    try {
      const fileExt = "jpg";
      const fileName = `${user.student_id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("profiles")
        .upload(filePath, blob, {
          contentType: "image/jpeg",
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("profiles").getPublicUrl(filePath);

      setProfilePicUrl(publicUrl);
      setImmichAssetId(null);
      toaster.create({
        title: "Avatar updated!",
        description: "Successfully cropped and uploaded profile picture.",
        type: "success",
      });
    } catch (err) {
      console.error("File upload failed:", err);
      toaster.create({
        title: "Upload failed",
        description: "Please try again.",
        type: "error",
      });
    } finally {
      setUploading(false);
      setImageObj(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nickname.trim() || !faculty.trim() || (faculty === "OTHER" && !customFaculty.trim())) {
      toaster.create({
        title: "Required Fields Missing",
        description: "Nickname and Faculty are required.",
        type: "error",
      });
      return;
    }

    // Enforce house_position for staff/moderators
    const needsHousePosition =
      user?.role === "staff" || user?.role === "moderator";
    if (needsHousePosition && !housePosition.trim()) {
      toaster.create({
        title: "House Position is required",
        description: "Please select or enter your staff position in the house.",
        type: "error",
      });
      return;
    }

    setSubmitting(true);
    const success = await updateProfile({
      nickname: nickname.trim(),
      faculty: faculty === "OTHER" ? customFaculty.trim() : faculty.trim(),
      major: major.trim(),
      ig: ig.trim(),
      avatarColor,
      bio: bio.trim(),
      profilePicUrl: profilePicUrl.trim(),
      photoPool: user?.photo_pool || [], // keep photo pool intact
      housePosition: housePosition.trim(),
      immichAssetId: immichAssetId,
    });
    setSubmitting(false);

    if (success) {
      toaster.create({
        title: "Profile Saved!",
        type: "success",
      });
      navigate("/");
    } else {
      toaster.create({
        title: "Save failed",
        type: "error",
      });
    }
  };

  return (
    <Box
      minH="90vh"
      display="flex"
      alignItems="flex-start"
      justifyContent="center"
      py={{ base: 6, md: 12 }}
      px={4}
    >
      <Container maxW="3xl">
        <Tabs.Root defaultValue="profile" variant="line" size="lg">
          <Tabs.List bg="bg.surface" p={2} borderRadius="xl" mb={6} justifyContent="center" gap={{ base: 4, md: 10 }}>
            <Tabs.Trigger value="profile" px={6} py={3} borderRadius="md" _selected={{ bg: "brand.900", color: "white" }}>
              Profile Details
            </Tabs.Trigger>
            <Tabs.Trigger value="photos" px={6} py={3} borderRadius="md" _selected={{ bg: "brand.900", color: "white" }}>
              My Photos
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="photos">
            <Box bg="bg.surface" border="1px solid" borderColor="border.subtle" borderRadius="2xl" p={{ base: 5, md: 8 }} boxShadow="var(--shadow-card)" animation="scale-in 0.4s var(--ease-out-quart)">
              <VStack align="stretch" gap={6}>
                <VStack align="center" textAlign="center" gap={1}>
                  <Heading as="h2" fontSize="2xl" color="brand.900" fontWeight="700">My Claimed Faces</Heading>
                  <Text color="fg.muted" fontSize="sm">Faces you have identified as yourself.</Text>
                </VStack>

                {myClaimedFaces.length > 0 ? (
                  <Box display="grid" gridTemplateColumns={{ base: "repeat(3, 1fr)", sm: "repeat(5, 1fr)", md: "repeat(7, 1fr)" }} gap={4}>
                    {myClaimedFaces.map(personId => (
                      <VStack key={personId} align="center" gap={2}>
                        <Box w="72px" h="72px" borderRadius="full" overflow="hidden" border="2px solid var(--c-lagoon)" boxShadow="sm">
                          <Image src={immich.people.thumbnailUrl(personId)} w="100%" h="100%" objectFit="cover" loading="lazy" />
                        </Box>
                        <Button 
                          variant="ghost" 
                          color="red.500" 
                          h="24px" 
                          px={2}
                          fontSize="xs"
                          borderRadius="md"
                          _hover={{ bg: "red.50" }}
                          onClick={async () => {
                            if (window.confirm("Are you sure you want to unclaim this face?")) {
                              const ok = await unclaimFace(personId);
                              if (ok) {
                                setMyClaimedFaces(prev => prev.filter(id => id !== personId));
                                setMyPhotos([]); // Will require refresh or refetching
                                refreshClaimedFaceStatus();
                              }
                            }
                          }}
                        >
                          Remove
                        </Button>
                      </VStack>
                    ))}
                  </Box>
                ) : (
                  <Text textAlign="center" color="fg.subtle">No faces claimed yet. Visit the Gallery to claim faces.</Text>
                )}

                <Box borderTop="1px solid" borderColor="border.subtle" pt={6} mt={2} />

                <VStack align="center" textAlign="center" gap={1}>
                  <Heading as="h2" fontSize="2xl" color="brand.900" fontWeight="700">My Identified Photos</Heading>
                  <Text color="fg.muted" fontSize="sm">Photos from the gallery where your face was recognized.</Text>
                </VStack>
                {loadingPhotos ? (
                  <Text textAlign="center" color="fg.subtle" py={10}>Searching for your photos...</Text>
                ) : myPhotos.length === 0 ? (
                  <Flex justify="center" py={12} bg="bg.hero" border="1px dashed" borderColor="border.subtle" borderRadius="xl">
                    <Text color="fg.subtle">No photos found. You can claim your face in the Gallery.</Text>
                  </Flex>
                ) : (
                  <Box display="grid" gridTemplateColumns={{ base: "repeat(2, 1fr)", sm: "repeat(3, 1fr)" }} gap={4}>
                    {myPhotos.map((asset, i) => (
                      <Box key={asset.id} borderRadius="xl" overflow="hidden" cursor="pointer" onClick={() => openLightbox(i, myPhotos)} transition="transform 0.3s" _hover={{ transform: "translateY(-2px)" }}>
                        <Image src={immich.assets.thumbnailUrl(asset.id, "thumbnail")} h={{ base: "160px", sm: "200px" }} w="100%" objectFit="cover" loading="lazy" />
                      </Box>
                    ))}
                  </Box>
                )}
              </VStack>
            </Box>
          </Tabs.Content>

          <Tabs.Content value="profile" p={0}>
            <Box
              maxW="lg"
              mx="auto"
              bg="white"
              borderRadius="24px"
              p={{ base: 5, md: 8 }}
              boxShadow="0 20px 50px -12px rgba(73,98,104,0.18)"
              border="1px solid rgba(124,86,63,0.12)"
              animation="scale-in 0.4s var(--ease-out-quart)"
              position="relative"
              overflow="hidden"
            >
              {/* Top Accent Strip */}
              <Box
                h="6px"
                w="100%"
                bg="linear-gradient(90deg, #496268 0%, #7c563f 100%)"
                position="absolute"
                top={0}
                left={0}
                right={0}
              />

              <VStack align="stretch" gap={6} as="form" onSubmit={handleSubmit} pt={2}>
                
                {/* ── Page Header ────────────────────────────────────── */}
                <VStack align="center" textAlign="center" gap={1}>
                  <Heading
                    as="h1"
                    fontFamily="'Playfair Display', serif"
                    fontSize="2xl"
                    color="#1b1c1c"
                    fontWeight="800"
                    letterSpacing="-0.02em"
                  >
                    Edit Profile
                  </Heading>
                  <Text color="fg.subtle" fontSize="xs" maxW="320px">
                    Customize your Baan 7 orientation identity & student album details.
                  </Text>
                  <HStack gap={2} mt={1}>
                    <Badge colorPalette="blue" size="xs" borderRadius="full" px={2.5}>
                      {user?.student_id}
                    </Badge>
                    <Badge
                      colorPalette={
                        user?.role === "moderator"
                          ? "red"
                          : user?.role === "staff"
                          ? "orange"
                          : "teal"
                      }
                      size="xs"
                      borderRadius="full"
                      px={2.5}
                    >
                      {user?.role === "student"
                        ? "Freshman"
                        : user?.role === "moderator"
                        ? "Moderator"
                        : "Staff"}
                    </Badge>
                  </HStack>
                </VStack>

                {/* ── AI Suggestion Banner Panel ───────────────────────── */}
                {suggestedAsset && (
                  <Flex
                    direction={{ base: "column", sm: "row" }}
                    align="center"
                    justify="space-between"
                    gap={3}
                    p={4}
                    bg="#FFFDF6"
                    border="1.5px dashed #7c563f"
                    borderRadius="16px"
                    boxShadow="sm"
                    w="100%"
                  >
                    <HStack gap={3} align="center" w={{ base: "100%", sm: "auto" }}>
                      <Image
                        src={immich.assets.thumbnailUrl(suggestedAsset.id, "thumbnail")}
                        alt={`Suggested profile picture for ${user?.nickname || 'you'}`}
                        w="44px"
                        h="44px"
                        borderRadius="full"
                        objectFit="cover"
                        draggable={false}
                        loading="lazy"
                        border="2px solid #7c563f"
                      />
                      <VStack align="start" gap={0}>
                        <Text fontSize="xs" fontWeight="700" color="#1b1c1c">
                          Is this you?
                        </Text>
                        <Text fontSize="3xs" color="fg.subtle">
                          Photo matched via your name tag in the gallery.
                        </Text>
                      </VStack>
                    </HStack>
                    <Flex gap={2} w={{ base: "100%", sm: "auto" }} justify="flex-end">
                      <Button
                        type="button"
                        h="36px"
                        px={4}
                        bg="#7c563f"
                        color="white"
                        borderRadius="full"
                        fontSize="xs"
                        fontWeight="700"
                        cursor="pointer"
                        _hover={{ opacity: 0.9 }}
                        onClick={handleClaimSuggestion}
                        flex={{ base: 1, sm: "initial" }}
                      >
                        Use Photo
                      </Button>
                      <Button
                        type="button"
                        h="36px"
                        px={3}
                        variant="ghost"
                        color="fg.subtle"
                        borderRadius="full"
                        fontSize="xs"
                        fontWeight="600"
                        cursor="pointer"
                        onClick={handleDismissSuggestion}
                        flex={{ base: 1, sm: "initial" }}
                      >
                        Dismiss
                      </Button>
                    </Flex>
                  </Flex>
                )}

                {/* Required setup warning for staff/moderator */}
                {(user?.role === "staff" || user?.role === "moderator") &&
                  !user.house_position && (
                    <Box
                      bg="rgba(197, 48, 48, 0.08)"
                      border="1.5px solid"
                      borderColor="red.500"
                      borderRadius="16px"
                      p={3.5}
                      w="100%"
                      role="alert"
                    >
                      <Text
                        fontSize="xs"
                        color="red.600"
                        fontWeight="700"
                        display="flex"
                        alignItems="center"
                        gap={1.5}
                      >
                        <Box
                          as="span"
                          className="material-symbols-outlined"
                          fontSize="16px"
                        >
                          campaign
                        </Box>
                        House Position Required: Please select your official role below.
                      </Text>
                    </Box>
                  )}

                {/* ── Avatar Customization Header ───────────────────────── */}
                <VStack align="center" gap={3} py={1}>
                  <Box position="relative">
                    <Box
                      borderRadius="full"
                      overflow="hidden"
                      w="104px"
                      h="104px"
                      border="4px solid white"
                      boxShadow="0 8px 24px -4px rgba(73,98,104,0.25)"
                      bg={avatarColor}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      color="white"
                      fontWeight="800"
                      fontSize="2xl"
                    >
                      {profilePicUrl ? (
                        <Image
                          src={profilePicUrl}
                          alt={`Profile picture preview for ${nickname || user?.nickname || 'user'}`}
                          w="100%"
                          h="100%"
                          objectFit="cover"
                          loading="lazy"
                        />
                      ) : (
                        getInitials(nickname || user?.student_id || "?")
                      )}
                    </Box>

                    {profilePicUrl && (
                      <Button
                        type="button"
                        position="absolute"
                        bottom="-2px"
                        right="-2px"
                        w="28px"
                        h="28px"
                        minW="28px"
                        p={0}
                        borderRadius="full"
                        bg="red.500"
                        color="white"
                        cursor="pointer"
                        boxShadow="sm"
                        _hover={{ bg: "red.600" }}
                        onClick={() => {
                          setProfilePicUrl("");
                          setImmichAssetId(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        title="Remove photo"
                      >
                        <Box className="material-symbols-outlined" fontSize="14px">
                          delete
                        </Box>
                      </Button>
                    )}
                  </Box>

                  {/* Avatar Upload / Choice Actions */}
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    ref={fileInputRef}
                    display="none"
                  />
                  <HStack gap={2} flexWrap="wrap" justify="center">
                    <Button
                      type="button"
                      size="xs"
                      h="32px"
                      px={3.5}
                      borderRadius="full"
                      bg="#496268"
                      color="white"
                      fontWeight="700"
                      cursor="pointer"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      _hover={{ bg: "#3a4f54" }}
                    >
                      {uploading ? <Spinner size="xs" mr={1} /> : null}
                      <Box className="material-symbols-outlined" fontSize="14px" mr={1}>
                        upload
                      </Box>
                      Upload Photo
                    </Button>
                    {myPhotos.length > 0 && (
                      <Button
                        type="button"
                        size="xs"
                        h="32px"
                        px={3.5}
                        borderRadius="full"
                        bg="#7c563f"
                        color="white"
                        fontWeight="700"
                        cursor="pointer"
                        onClick={() => setIsImmichPickerOpen(!isImmichPickerOpen)}
                        _hover={{ opacity: 0.9 }}
                      >
                        <Box className="material-symbols-outlined" fontSize="14px" mr={1}>
                          photo_library
                        </Box>
                        Pick Immich Photo
                      </Button>
                    )}
                  </HStack>

                  {/* Immich Photo Picker Grid */}
                  {isImmichPickerOpen && myPhotos.length > 0 && (
                    <Box
                      p={3}
                      bg="#f9f6f3"
                      border="1px solid rgba(124,86,63,0.15)"
                      borderRadius="16px"
                      w="100%"
                      animation="scale-in 0.2s ease"
                    >
                      <Text fontSize="xs" fontWeight="700" color="#1b1c1c" mb={2} textAlign="center">
                        Select a photo from your album:
                      </Text>
                      <Box display="grid" gridTemplateColumns="repeat(4, 1fr)" gap={2} maxH="180px" overflowY="auto" p={1}>
                        {myPhotos.map((asset) => (
                          <Box
                            key={asset.id}
                            cursor="pointer"
                            borderRadius="10px"
                            overflow="hidden"
                            onClick={() => {
                              setProfilePicUrl(immich.assets.thumbnailUrl(asset.id, "preview"));
                              setImmichAssetId(asset.id);
                              setIsImmichPickerOpen(false);
                            }}
                            border="2px solid transparent"
                            _hover={{ borderColor: "#496268", transform: "scale(1.04)" }}
                            transition="all 0.15s ease"
                          >
                            <Image
                              src={immich.assets.thumbnailUrl(asset.id, "thumbnail")}
                              h="60px"
                              w="100%"
                              objectFit="cover"
                              loading="lazy"
                            />
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}

                  {/* Preset Color Swatches */}
                  {!profilePicUrl && (
                    <HStack gap={2} mt={1}>
                      {PRESET_COLORS.map((c) => (
                        <Box
                          key={c}
                          w="28px"
                          h="28px"
                          borderRadius="full"
                          bg={c}
                          cursor="pointer"
                          border={
                            avatarColor === c
                              ? "2.5px solid #1b1c1c"
                              : "2px solid white"
                          }
                          boxShadow={avatarColor === c ? "0 0 0 2px rgba(73,98,104,0.4)" : "sm"}
                          transform={avatarColor === c ? "scale(1.15)" : "none"}
                          transition="all 0.18s ease"
                          onClick={() => setAvatarColor(c)}
                        />
                      ))}
                    </HStack>
                  )}
                </VStack>

                {/* ── Form Inputs Stack ───────────────────────────────── */}
                <VStack align="stretch" gap={4} bg="#f9f6f3" p={5} borderRadius="18px" border="1px solid rgba(124,86,63,0.1)">

                  {/* Nickname */}
                  <VStack align="stretch" gap={1}>
                    <Text fontSize="xs" fontWeight="700" color="#1b1c1c">
                      Nickname <Box as="span" color="red.500">*</Box>
                    </Text>
                    <Input
                      id="edit-nickname"
                      placeholder="e.g. Bill"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      borderRadius="12px"
                      border="1px solid rgba(124,86,63,0.2)"
                      bg="white"
                      _focus={{ borderColor: "#496268", boxShadow: "0 0 0 2px rgba(73,98,104,0.15)" }}
                      h="42px"
                      fontSize="sm"
                      required
                    />
                  </VStack>

                  {/* Faculty */}
                  <VStack align="stretch" gap={1}>
                    <Text fontSize="xs" fontWeight="700" color="#1b1c1c">
                      Faculty <Box as="span" color="red.500">*</Box>
                    </Text>
                    <FacultySelect
                      value={faculty}
                      onChange={(val) => {
                        setFaculty(val);
                        if (val !== "OTHER") setCustomFaculty("");
                      }}
                    />
                    {faculty === "OTHER" && (
                      <Input
                        placeholder="โปรดระบุคณะของคุณ / Type your faculty..."
                        value={customFaculty}
                        onChange={(e) => setCustomFaculty(e.target.value)}
                        bg="white"
                        h="42px"
                        borderRadius="12px"
                        border="1px solid rgba(124,86,63,0.2)"
                        _focus={{ borderColor: "#496268" }}
                        mt={1}
                        fontSize="sm"
                      />
                    )}
                  </VStack>

                  {/* Major */}
                  <VStack align="stretch" gap={1}>
                    <Text fontSize="xs" fontWeight="700" color="#1b1c1c">
                      Major <Text as="span" color="fg.subtle" fontWeight="400">(Optional)</Text>
                    </Text>
                    <Input
                      id="edit-major"
                      placeholder="e.g. Computer Science"
                      value={major}
                      onChange={(e) => setMajor(e.target.value)}
                      borderRadius="12px"
                      border="1px solid rgba(124,86,63,0.2)"
                      bg="white"
                      _focus={{ borderColor: "#496268" }}
                      h="42px"
                      fontSize="sm"
                    />
                  </VStack>

                  {/* House Position (Staff/Moderator Only) */}
                  {(user?.role === "staff" || user?.role === "moderator") && (
                    <VStack align="stretch" gap={1}>
                      <Text fontSize="xs" fontWeight="700" color="#1b1c1c">
                        House Position <Text as="span" color="red.500">* Required</Text>
                      </Text>
                      <SearchableSelect
                        value={selectedSelectRole}
                        onChange={(val) => {
                          setSelectedSelectRole(val);
                          if (val === "Other") {
                            setHousePosition(customPositionText);
                          } else {
                            setHousePosition(val);
                          }
                        }}
                        options={[
                          ...dynamicPositions.map((role) => ({ value: role, primaryText: role })),
                          { value: "Other", primaryText: "Other..." },
                        ]}
                        placeholder="Select Position..."
                        searchPlaceholder="พิมพ์ค้นหาตำแหน่ง / Type to search..."
                      />
                      {selectedSelectRole === "Other" && (
                        <Input
                          id="custom-house-position"
                          aria-label="Custom house position"
                          placeholder="Enter position (e.g. Photographer)"
                          value={customPositionText}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomPositionText(val);
                            setHousePosition(val);
                          }}
                          borderRadius="12px"
                          border="1px solid rgba(124,86,63,0.2)"
                          bg="white"
                          _focus={{ borderColor: "#496268" }}
                          h="42px"
                          fontSize="sm"
                          mt={1}
                          required
                        />
                      )}
                    </VStack>
                  )}

                  {/* Instagram */}
                  <VStack align="stretch" gap={1}>
                    <Text fontSize="xs" fontWeight="700" color="#1b1c1c">
                      Instagram (IG) <Text as="span" color="fg.subtle" fontWeight="400">(Optional)</Text>
                    </Text>
                    <Input
                      id="edit-ig"
                      placeholder="e.g. username"
                      value={ig}
                      onChange={(e) => setIg(e.target.value)}
                      borderRadius="12px"
                      border="1px solid rgba(124,86,63,0.2)"
                      bg="white"
                      _focus={{ borderColor: "#496268" }}
                      h="42px"
                      fontSize="sm"
                    />
                  </VStack>

                  {/* Bio */}
                  <VStack align="stretch" gap={1}>
                    <Text fontSize="xs" fontWeight="700" color="#1b1c1c">
                      Bio Quote <Text as="span" color="fg.subtle" fontWeight="400">(Optional)</Text>
                    </Text>
                    <Textarea
                      id="edit-bio"
                      placeholder="Share a favorite quote or intro line..."
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      borderRadius="12px"
                      border="1px solid rgba(124,86,63,0.2)"
                      bg="white"
                      _focus={{ borderColor: "#496268" }}
                      minH="72px"
                      fontSize="sm"
                      py={2.5}
                    />
                  </VStack>

                </VStack>

                {/* ── Form Footer Actions ─────────────────────────────── */}
                <HStack w="100%" gap={3} pt={2}>
                  <Button
                    type="button"
                    variant="outline"
                    borderColor="rgba(124,86,63,0.2)"
                    color="#1b1c1c"
                    borderRadius="full"
                    h="44px"
                    flex={1}
                    fontSize="sm"
                    fontWeight="600"
                    cursor="pointer"
                    onClick={() => navigate("/")}
                    _hover={{ bg: "bg.hero" }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    bg="#7c563f"
                    color="white"
                    borderRadius="full"
                    h="44px"
                    flex={2}
                    fontSize="sm"
                    fontWeight="700"
                    _hover={{ opacity: 0.9, transform: "scale(1.01)" }}
                    transition="all 0.18s ease"
                    disabled={submitting}
                  >
                    {submitting ? <Spinner size="xs" color="white" /> : "Save Profile"}
                  </Button>
                </HStack>

              </VStack>
            </Box>
          </Tabs.Content>
        </Tabs.Root>
      </Container>

      {/* Crop Overlay Modal */}
      <AvatarCropModal
        isOpen={isOpenCrop}
        imageObj={imageObj}
        onCancel={handleCropCancel}
        onSave={handleCropSave}
      />
    </Box>
  );
}

interface AvatarCropModalProps {
  isOpen: boolean;
  imageObj: HTMLImageElement | null;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
}

export function AvatarCropModal({
  isOpen,
  imageObj,
  onCancel,
  onSave,
}: AvatarCropModalProps) {
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });

  const C = 400; // Canvas resolution

  const clampPan = useCallback(
    (px: number, py: number, currentZoom: number) => {
      if (!imageObj) return { x: 0, y: 0 };
      const baseScale = Math.max(C / imageObj.width, C / imageObj.height);
      const scale = baseScale * currentZoom;
      const sw = imageObj.width * scale;
      const sh = imageObj.height * scale;

      const limitX = Math.max(0, (sw - C) / 2);
      const limitY = Math.max(0, (sh - C) / 2);

      return {
        x: Math.max(-limitX, Math.min(limitX, px)),
        y: Math.max(-limitY, Math.min(limitY, py)),
      };
    },
    [imageObj],
  );

  const handleStart = useCallback(
    (clientX: number, clientY: number) => {
      if (!imageObj || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleFactor = C / rect.width;
      setIsDragging(true);
      dragStart.current = {
        x: clientX * scaleFactor - pan.x,
        y: clientY * scaleFactor - pan.y,
      };
    },
    [imageObj, pan],
  );

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDragging || !imageObj || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleFactor = C / rect.width;
      const newX = clientX * scaleFactor - dragStart.current.x;
      const newY = clientY * scaleFactor - dragStart.current.y;
      const clamped = clampPan(newX, newY, zoom);
      setPan(clamped);
    },
    [isDragging, imageObj, zoom, clampPan],
  );

  const handleEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObj || !isOpen) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, C, C);

    // Calculate scaling
    const baseScale = Math.max(C / imageObj.width, C / imageObj.height);
    const scale = baseScale * zoom;
    const sw = imageObj.width * scale;
    const sh = imageObj.height * scale;

    // Centered position + pan
    const x = (C - sw) / 2 + pan.x;
    const y = (C - sh) / 2 + pan.y;

    // Draw image
    ctx.drawImage(imageObj, x, y, sw, sh);
  }, [imageObj, zoom, pan, isOpen]);

  const handleCropSaveLocal = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob(
      (blob) => {
        if (blob) {
          onSave(blob);
        } else {
          toaster.create({ title: "Cropping failed", type: "error" });
        }
      },
      "image/jpeg",
      0.9,
    );
  }, [onSave]);

  // Global key event listeners inside the modal lifecycle
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleCropSaveLocal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onCancel, handleCropSaveLocal]);

  if (!isOpen) return null;

  return (
    <Box
      position="fixed"
      top="0"
      left="0"
      right="0"
      bottom="0"
      bg="color-mix(in srgb, var(--c-ink) 85%, transparent)"
      backdropFilter="blur(8px)"
      zIndex="9999"
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={4}
    >
      <Box
        bg="bg.surface"
        border="1px solid"
        borderColor="border.subtle"
        borderRadius="2xl"
        width={{ base: "calc(100% - 32px)", sm: "360px" }}
        maxH={{ base: "90vh", sm: "620px" }}
        boxShadow="var(--shadow-card)"
        animation="scale-in 0.3s var(--ease-out-quart)"
        display="flex"
        flexDirection="column"
        overflow="hidden"
      >
        <VStack gap={5} align="stretch" overflowY="auto" p={6}>
          <VStack align="center" textAlign="center" gap={1}>
            <Heading
              as="h2"
              fontSize="lg"
              color="brand.900"
              fontWeight="700"
            >
              Adjust Profile Pic
            </Heading>
            <Text color="fg.muted" fontSize="xs">
              Drag to pan, slide to zoom. Ensure your face fits inside the
              circle.
            </Text>
          </VStack>

          {/* Crop Canvas Wrapper */}
          <Box
            position="relative"
            w="100%"
            maxW={{ base: "280px", sm: "320px" }}
            aspectRatio="1/1"
            mx="auto"
            bg="black"
            borderRadius="xl"
            overflow="hidden"
            boxShadow="inner"
          >
            <canvas
              ref={canvasRef}
              width={C}
              height={C}
              aria-label="Profile picture crop editor"
              className="crop-canvas"
              data-dragging={isDragging ? "true" : "false"}
              onMouseDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                handleStart(e.clientX - rect.left, e.clientY - rect.top);
              }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                handleMove(e.clientX - rect.left, e.clientY - rect.top);
              }}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
              onTouchStart={(e) => {
                if (e.touches[0]) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  handleStart(
                    e.touches[0].clientX - rect.left,
                    e.touches[0].clientY - rect.top,
                  );
                }
              }}
              onTouchMove={(e) => {
                if (e.touches[0]) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  handleMove(
                    e.touches[0].clientX - rect.left,
                    e.touches[0].clientY - rect.top,
                  );
                }
              }}
              onTouchEnd={handleEnd}
            />

            {/* Circular Mask Overlay */}
            <Box
              position="absolute"
              top="0"
              left="0"
              width="100%"
              height="100%"
              pointerEvents="none"
              background="radial-gradient(circle, transparent 46%, color-mix(in srgb, var(--c-ink) 75%, transparent) 47%)"
            >
              <Box
                position="absolute"
                top="50%"
                left="50%"
                transform="translate(-50%, -50%)"
                width="93.75%"
                height="93.75%"
                borderRadius="full"
                border="2.5px dashed rgba(255, 255, 255, 0.8)"
                boxShadow="0 0 0 9999px color-mix(in srgb, var(--c-ink) 10%, transparent)"
              />
            </Box>
          </Box>

          {/* Slider Controls */}
          <VStack gap={2} align="stretch">
            <Text
              fontSize="xs"
              fontWeight="700"
              color="brand.900"
              textTransform="none"
              letterSpacing="0.05em"
            >
              Zoom Control
            </Text>
            <HStack gap={3} px={1}>
              <Button
                size="xs"
                h="44px"
                w="44px"
                minW="44px"
                borderRadius="lg"
                variant="outline"
                borderColor="border.subtle"
                color="brand.900"
                onClick={() => {
                  const newZoom = Math.max(1, zoom - 0.1);
                  setZoom(newZoom);
                  setPan((prev) => clampPan(prev.x, prev.y, newZoom));
                }}
                _hover={{ bg: "bg.hero" }}
                cursor="pointer"
              >
                -
              </Button>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                aria-label="Zoom level"
                title="Zoom level"
                className="crop-slider"
                onChange={(e) => {
                  const z = parseFloat(e.target.value);
                  setZoom(z);
                  setPan((prev) => clampPan(prev.x, prev.y, z));
                }}
              />
              <Button
                size="xs"
                h="44px"
                w="44px"
                minW="44px"
                borderRadius="lg"
                variant="outline"
                borderColor="border.subtle"
                color="brand.900"
                onClick={() => {
                  const newZoom = Math.min(3, zoom + 0.1);
                  setZoom(newZoom);
                  setPan((prev) => clampPan(prev.x, prev.y, newZoom));
                }}
                _hover={{ bg: "bg.hero" }}
                cursor="pointer"
              >
                +
              </Button>
            </HStack>
          </VStack>

          {/* Actions */}
          <HStack gap={3} mt={2}>
            <Button
              variant="outline"
              borderColor="border.subtle"
              color="brand.900"
              borderRadius="xl"
              h="44px"
              flex={1}
              fontSize="sm"
              fontWeight="600"
              onClick={onCancel}
              _hover={{ bg: "bg.hero" }}
              cursor="pointer"
            >
              Cancel
            </Button>
            <Button
              bg="brand.900"
              color="white"
              borderRadius="xl"
              h="44px"
              flex={1.5}
              fontSize="sm"
              fontWeight="700"
              onClick={handleCropSaveLocal}
              _hover={{ opacity: 0.9 }}
              cursor="pointer"
            >
              Apply Crop
            </Button>
          </HStack>
        </VStack>
      </Box>
    </Box>
  );
}

export function ProfileEditPage() {
  const { user, loading } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <Flex minH="90vh" align="center" justify="center" bg="bg.hero">
        <Spinner color="brand.900" size="xl" />
      </Flex>
    );
  }

  return <ProfileEditForm user={user} />;
}
