import React, { useEffect } from "react";
import { FiAlertTriangle } from "react-icons/fi";
import {
  Dialog,
  Button,
  VStack,
  Flex,
  Box,
  Heading,
  Text,
  Badge,
  HStack,
  Spinner,
  Input,
  Portal,
  NativeSelect,
} from "@chakra-ui/react";
import { Tooltip } from "../ui/tooltip";
import { FacultySelect } from "../FacultySelect";
import { SearchableSelect } from "../SearchableSelect";
import { STAFF_ROLES } from "../../lib/constants";
import type { DBUser, AuditLog } from "../../pages/AdminDashboardPage";
import { UserAvatar } from "../UserAvatar";
import { useUser } from "../../context/UserContext";
import {
  useResetVibecheckMutation,
  useSetMissionMutation,
  useAdminMissions,
} from "../../hooks/useAdminQueries";
import { toaster } from "../ui/toaster";
import { immich, type ImmichAsset } from "../../lib/immich";
import { ImmichImage } from "../gallery/ImmichImage";
import { ImmichFacePickerModal, extractPersonId } from "./ImmichFacePickerModal";
import { supabase } from "../../lib/supabase";

interface UserInspectModalProps {
  inspectUser: DBUser | null;
  onClose: () => void;
  onRefreshStats?: () => void;
  inspectUserStats: {
    collectedCount: number;
    collectedFromCount: number;
    vibeStatus?: {
      strike_count: number;
      locked_until: string | null;
      current_mission_id: number | null;
    } | null;
    isLocked: boolean;
    unlockedStaff?: Array<{
      staff_id: string;
      nickname: string;
      profile_pic_url: string | null;
      avatar_color: string;
    }>;
  } | null;
  inspectUserLogs: AuditLog[];
  editNickname: string;
  setEditNickname: (val: string) => void;
  editFaculty: string;
  setEditFaculty: (val: string) => void;
  editMajor: string;
  setEditMajor: (val: string) => void;
  editHousePosition: string;
  setEditHousePosition: (val: string) => void;
  editRole: string;
  setEditRole: (val: string) => void;
  handleEditUser: (e: React.FormEvent) => void;
  getRoleDescription: (role: string) => string;
  dynamicPositions?: string[];
}

export function UserInspectModal({
  inspectUser,
  onClose,
  onRefreshStats,
  inspectUserStats,
  inspectUserLogs,
  editNickname,
  setEditNickname,
  editFaculty,
  setEditFaculty,
  editMajor,
  setEditMajor,
  editHousePosition,
  setEditHousePosition,
  editRole,
  setEditRole,
  handleEditUser,
  getRoleDescription,
  dynamicPositions,
}: UserInspectModalProps) {
  const { user, getAdminPin } = useUser();
  const resetVibecheckMutation = useResetVibecheckMutation(user?.student_id || "");
  const setMissionMutation = useSetMissionMutation(user?.student_id || "");
  const { data: missions } = useAdminMissions(user?.role === "moderator");

  const [selectedMission, setSelectedMission] = React.useState<string>("");
  const [claimedFaces, setClaimedFaces] = React.useState<Array<{ immich_person_id: string; created_at: string }>>([]);
  const [loadingFaces, setLoadingFaces] = React.useState(false);
  const [isFacePickerOpen, setIsFacePickerOpen] = React.useState(false);
  const [unclaimingPersonId, setUnclaimingPersonId] = React.useState<string | null>(null);
  const [directFaceInput, setDirectFaceInput] = React.useState("");
  const [linkingFace, setLinkingFace] = React.useState(false);

  const [inspectPhotos, setInspectPhotos] = React.useState<ImmichAsset[]>([]);
  const [loadingInspectPhotos, setLoadingInspectPhotos] = React.useState(false);

  useEffect(() => {
    let isMounted = true;
    if (inspectUser?.student_id) {
      setLoadingFaces(true);
      supabase
        .from("user_faces")
        .select("immich_person_id, created_at")
        .eq("student_id", inspectUser.student_id)
        .then(({ data, error }) => {
          if (isMounted) {
            if (!error && data) setClaimedFaces(data);
            setLoadingFaces(false);
          }
        });
    } else {
      setClaimedFaces([]);
    }
    return () => {
      isMounted = false;
    };
  }, [inspectUser?.student_id]);

  useEffect(() => {
    if (claimedFaces.length === 0) {
      setInspectPhotos([]);
      return;
    }
    let isMounted = true;
    setLoadingInspectPhotos(true);
    const personIds = claimedFaces.map((f) => f.immich_person_id);
    immich.assets
      .searchMetadata({ personIds })
      .then((res) => {
        if (isMounted) {
          setInspectPhotos(res.assets?.items || []);
          setLoadingInspectPhotos(false);
        }
      })
      .catch((err) => {
        console.error("Error fetching inspected user photos:", err);
        if (isMounted) setLoadingInspectPhotos(false);
      });
    return () => {
      isMounted = false;
    };
  }, [claimedFaces]);

  const handleDirectFaceClaim = async () => {
    if (!inspectUser || !directFaceInput.trim()) return;
    const personId = extractPersonId(directFaceInput);
    if (!personId) {
      toaster.create({
        title: "Invalid URL or Face ID",
        description: "Could not find a valid 36-character Immich Face UUID in input.",
        type: "error",
      });
      return;
    }

    setLinkingFace(true);
    try {
      const { error: sbError } = await supabase
        .from("user_faces")
        .insert({ student_id: inspectUser.student_id, immich_person_id: personId });
      if (sbError && sbError.code !== "23505") {
        throw sbError;
      }

      // Fetch user nickname to ensure exact naming format
      const { data: dbUserData } = await supabase
        .from("users")
        .select("nickname")
        .eq("student_id", inspectUser.student_id)
        .maybeSingle();

      const nickname = (dbUserData?.nickname || inspectUser.nickname || "Student").trim();
      const studentId = inspectUser.student_id;
      const formattedName = `${nickname} (${studentId})`;

      // Sync ALL claimed faces for this student to the formatted name
      const { data: userClaimedFaces } = await supabase
        .from("user_faces")
        .select("immich_person_id")
        .eq("student_id", inspectUser.student_id);

      const allPersonIdsToUpdate = Array.from(
        new Set([personId, ...(userClaimedFaces?.map((f) => f.immich_person_id) || [])])
      );

      let immichNameSuccess = true;
      await Promise.all(
        allPersonIdsToUpdate.map(async (id) => {
          try {
            await immich.people.update(id, { name: formattedName });
          } catch (immichErr) {
            immichNameSuccess = false;
            console.warn(`Immich person name update warning for face ${id}:`, immichErr);
          }
        })
      );

      await supabase.from("audit_logs").insert({
        moderator_id: user?.student_id,
        action_type: "admin_claim_face",
        target_id: inspectUser.student_id,
        details: `Moderator claimed face ${personId} via direct URL/ID for ${inspectUser.student_id}`,
      });

      toaster.create({
        title: "Face Claimed Successfully!",
        description: immichNameSuccess
          ? `Linked face ID ${personId.slice(0, 8)}... to ${inspectUser.nickname || inspectUser.student_id}.`
          : `Linked face ID ${personId.slice(0, 8)}... to ${inspectUser.nickname || inspectUser.student_id} in DB (Immich name update restricted).`,
        type: "success",
      });

      setDirectFaceInput("");
      const { data } = await supabase
        .from("user_faces")
        .select("immich_person_id, created_at")
        .eq("student_id", inspectUser.student_id);
      if (data) setClaimedFaces(data);
      onRefreshStats?.();
    } catch (err) {
      console.error("Direct face claim error:", err);
      toaster.create({ title: "Failed to claim face", type: "error" });
    } finally {
      setLinkingFace(false);
    }
  };

  const handleUnclaimFace = async (personId: string) => {
    if (!inspectUser) return;
    if (
      !confirm(
        `Are you sure you want to unclaim face cluster for ${inspectUser.nickname || inspectUser.student_id}?`
      )
    )
      return;

    setUnclaimingPersonId(personId);
    try {
      const { error } = await supabase
        .from("user_faces")
        .delete()
        .eq("student_id", inspectUser.student_id)
        .eq("immich_person_id", personId);
      if (error) throw error;

      try {
        await immich.people.update(personId, { name: "" });
      } catch (immichErr) {
        console.warn(`Immich person name reset 403/error for ${personId}:`, immichErr);
      }

      await supabase.from("audit_logs").insert({
        moderator_id: user?.student_id,
        action_type: "admin_unclaim_face",
        target_id: inspectUser.student_id,
        details: `Moderator unclaimed face ${personId} for student ID ${inspectUser.student_id}`,
      });

      toaster.create({
        title: "Face Unclaimed",
        description: `Successfully unlinked face from ${inspectUser.nickname || inspectUser.student_id}.`,
        type: "success",
      });

      const { data } = await supabase
        .from("user_faces")
        .select("immich_person_id, created_at")
        .eq("student_id", inspectUser.student_id);
      if (data) setClaimedFaces(data);
      onRefreshStats?.();
    } catch (err) {
      console.error("Error unclaiming face:", err);
      toaster.create({ title: "Failed to unclaim face", type: "error" });
    } finally {
      setUnclaimingPersonId(null);
    }
  };

  const handleResetVibecheck = async () => {
    if (!inspectUser || !user || user.role !== 'moderator') return;
    if (confirm(`Are you sure you want to completely wipe the VibeCheck progress for ${inspectUser.nickname || inspectUser.student_id}? This cannot be undone.`)) {
      try {
        await resetVibecheckMutation.mutateAsync({
          targetId: inspectUser.student_id,
          pinHash: getAdminPin(),
        });
        toaster.create({ title: "VibeCheck progress reset successfully.", type: "success" });
        onRefreshStats?.();
      } catch (e) {
        console.error(e);
        toaster.create({ title: "Failed to reset progress", type: "error" });
      }
    }
  };

  const handleSetMission = async () => {
    if (!inspectUser || !user || user.role !== 'moderator' || !selectedMission) return;
    if (confirm(`Change active mission to ID ${selectedMission}?`)) {
      try {
        await setMissionMutation.mutateAsync({
          targetId:  inspectUser.student_id,
          missionId: Number(selectedMission),
          pinHash: getAdminPin(),
        });
        toaster.create({ title: "Mission updated successfully.", type: "success" });
        setSelectedMission("");
        onRefreshStats?.();
      } catch (e) {
        console.error(e);
        toaster.create({ title: "Failed to set mission", type: "error" });
      }
    }
  };

  // Ensure document scroll and pointer-events are unlocked on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
      document.body.style.pointerEvents = "";
    };
  }, []);

  if (!inspectUser) {
    return (
      <Dialog.Root
        open={false}
        onOpenChange={onClose}
        placement={{ base: "bottom", md: "center" }}
      >
        <></>
      </Dialog.Root>
    );
  }

  return (
    <Dialog.Root
      open={!!inspectUser}
      onOpenChange={onClose}
      placement={{ base: "bottom", md: "center" }}
    >
      <Portal>
        <Dialog.Backdrop
          bg="color-mix(in srgb, var(--c-ink) 70%, transparent)"
          backdropFilter="blur(4px)"
        />
        <Dialog.Positioner zIndex={2200} px={4}>
          <Dialog.Content
            bg="var(--c-ivory)"
            border={{ base: "none", md: "2px solid var(--chakra-colors-accent-solid)" }}
            color="var(--c-ink)"
            borderRadius={{ base: "t-3xl", md: "2xl" }}
            width={{ base: "100%", md: "560px" }}
            maxH={{ base: "92vh", md: "80vh" }}
            p={6}
            boxShadow={{ base: "none", md: "var(--shadow-card)" }}
            display="flex"
            flexDirection="column"
            position="relative"
          >
          <Dialog.Header p={0} mb={3}>
            <Dialog.Title
              fontSize="md"
              color="brand.900"
              fontWeight="700"
            >
              User Audit & Inspector
            </Dialog.Title>
          </Dialog.Header>

          <Dialog.Body
            p={0}
            flex={1}
            overflowY="auto"
            display="flex"
            flexDirection="column"
            gap={4}
          >
            <VStack align="stretch" gap={5}>
              {/* Profile Header Block */}
              <Flex
                bg="var(--c-ivory)"
                p={4}
                borderRadius="xl"
                border="1px solid"
                borderColor="border.subtle"
                gap={4}
                align="center"
              >
                <UserAvatar
                  src={inspectUser.profile_pic_url}
                  name={inspectUser.nickname || "User"}
                  avatarColor={inspectUser.avatar_color || "var(--c-lagoon)"}
                  size="64px"
                  fontSize="md"
                  border="2px solid var(--chakra-colors-accent-solid)"
                  boxShadow="sm"
                />

                <VStack align="start" gap={0.5}>
                  <Text
                    fontSize="sm"
                    fontWeight="700"
                    color="var(--c-ink)"
                  >
                    {inspectUser.nickname || "No Nickname"}
                  </Text>
                  <HStack gap={1.5}>
                    <Badge
                      colorPalette={
                        inspectUser.role === "moderator"
                          ? "red"
                          : inspectUser.role === "staff"
                            ? "orange"
                            : "gray"
                      }
                    >
                      {inspectUser.role}
                    </Badge>
                    <Text fontSize="xs" color="fg.subtle">
                      ID: {inspectUser.student_id}
                    </Text>
                  </HStack>
                  {inspectUser.ig && (
                    <Text
                      fontSize="xs"
                      color="var(--c-lagoon)"
                      fontWeight="600"
                    >
                      IG: {inspectUser.ig}
                    </Text>
                  )}
                  {inspectUser.created_at && (
                    <Text fontSize="xs" color="fg.subtle">
                      Registered:{" "}
                      {new Date(inspectUser.created_at).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </Text>
                  )}
                </VStack>
              </Flex>

              {/* Bio Block */}
              {inspectUser.bio && (
                <Box>
                  <Text
                    fontSize="xs"
                    fontWeight="700"
                    color="var(--c-muted)"
                    mb={1}
                    textTransform="uppercase"
                  >
                    Biography
                  </Text>
                  <Text
                    fontSize="xs"
                    color="fg.muted"
                    fontStyle="italic"
                    bg="white"
                    p={3}
                    borderRadius="lg"
                    border="1px solid"
                    borderColor="border.subtle"
                  >
                    "{inspectUser.bio}"
                  </Text>
                </Box>
              )}

              {/* Facial Recognition (Claimed Faces) Section */}
              <Box>
                <Flex justify="space-between" align="center" mb={2}>
                  <Text
                    fontSize="xs"
                    fontWeight="700"
                    color="var(--c-muted)"
                    textTransform="uppercase"
                  >
                    Claimed Faces ({claimedFaces.length})
                  </Text>
                  <Button
                    size="xs"
                    bg="accent.solid"
                    color="brand.900"
                    onClick={() => setIsFacePickerOpen(true)}
                    cursor="pointer"
                  >
                    + Browse Picker
                  </Button>
                </Flex>

                {/* Quick Direct URL / Face ID Claim Bar */}
                <Box bg="white" p={2.5} borderRadius="lg" border="1px solid" borderColor="border.subtle" mb={3}>
                  <Text fontSize="2xs" fontWeight="700" color="brand.900" mb={1}>
                    Direct URL or Face UUID Claim
                  </Text>
                  <HStack gap={2}>
                    <Input
                      placeholder="Paste Immich URL or Face ID..."
                      value={directFaceInput}
                      onChange={(e) => setDirectFaceInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && directFaceInput.trim()) {
                          handleDirectFaceClaim();
                        }
                      }}
                      size="xs"
                      bg="var(--c-ivory)"
                      borderRadius="md"
                    />
                    <Button
                      size="xs"
                      bg="brand.900"
                      color="white"
                      onClick={handleDirectFaceClaim}
                      loading={linkingFace}
                      disabled={!directFaceInput.trim()}
                      cursor="pointer"
                      px={3}
                    >
                      Link Face
                    </Button>
                  </HStack>
                </Box>

                {loadingFaces ? (
                  <Flex justify="center" p={3} bg="white" borderRadius="lg" border="1px solid" borderColor="border.subtle">
                    <Spinner size="xs" color="accent.solid" />
                  </Flex>
                ) : claimedFaces.length === 0 ? (
                  <Box p={3} bg="white" borderRadius="lg" border="1px dashed" borderColor="border.subtle" textAlign="center">
                    <Text fontSize="xs" color="fg.subtle">
                      No facial recognition clusters currently linked.
                    </Text>
                  </Box>
                ) : (
                  <Flex wrap="wrap" gap={2.5}>
                    {claimedFaces.map((face) => (
                      <Flex
                        key={face.immich_person_id}
                        align="center"
                        gap={2}
                        p={2}
                        bg="white"
                        borderRadius="lg"
                        border="1px solid"
                        borderColor="border.subtle"
                        boxShadow="sm"
                      >
                        <Box w="36px" h="36px" borderRadius="md" overflow="hidden" bg="gray.100" flexShrink={0}>
                          <img
                            src={immich.people.thumbnailUrl(face.immich_person_id)}
                            alt="Claimed face"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='%23999'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/></svg>";
                            }}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        </Box>
                        <VStack align="start" gap={0} flex={1}>
                          <Text fontSize="2xs" fontWeight="700" color="brand.900" maxW="100px" truncate>
                            ID: {face.immich_person_id.slice(0, 8)}...
                          </Text>
                          <Text fontSize="3xs" color="fg.subtle">
                            {new Date(face.created_at).toLocaleDateString()}
                          </Text>
                        </VStack>
                        <Button
                          size="2xs"
                          variant="ghost"
                          colorPalette="red"
                          onClick={() => handleUnclaimFace(face.immich_person_id)}
                          loading={unclaimingPersonId === face.immich_person_id}
                          cursor="pointer"
                        >
                          Unclaim
                        </Button>
                      </Flex>
                    ))}
                  </Flex>
                )}

                {/* Identified Photos (My Moments) for Inspected User */}
                {claimedFaces.length > 0 && (
                  <Box mt={4}>
                    <Flex justify="space-between" align="center" mb={2}>
                      <Text
                        fontSize="xs"
                        fontWeight="700"
                        color="var(--c-muted)"
                        textTransform="uppercase"
                      >
                        Identified Photos ({inspectPhotos.length})
                      </Text>
                      {loadingInspectPhotos && <Spinner size="xs" color="brand.900" />}
                    </Flex>
                    {inspectPhotos.length === 0 && !loadingInspectPhotos ? (
                      <Box p={3} bg="white" borderRadius="lg" border="1px dashed" borderColor="border.subtle">
                        <Text fontSize="xs" color="fg.subtle">
                          No photos matched for linked face clusters yet.
                        </Text>
                      </Box>
                    ) : (
                      <Box
                        display="grid"
                        gridTemplateColumns="repeat(4, 1fr)"
                        gap={2}
                        maxH="220px"
                        overflowY="auto"
                        p={1}
                      >
                        {inspectPhotos.map((asset) => (
                          <Box
                            key={asset.id}
                            borderRadius="lg"
                            overflow="hidden"
                            border="1px solid rgba(124,86,63,0.12)"
                            bg="gray.100"
                            h="64px"
                            cursor="pointer"
                          >
                            <ImmichImage
                              endpoint={immich.assets.thumbnailUrl(asset.id, "thumbnail")}
                              alt="Inspected photo"
                              w="100%"
                              h="100%"
                              objectFit="cover"
                            />
                          </Box>
                        ))}
                      </Box>
                    )}

                    {/* AI Beta Disclaimer */}
                    <Box
                      mt={2.5}
                      p={2.5}
                      bg="#FFFDF6"
                      border="1.5px dashed #7c563f"
                      borderRadius="xl"
                    >
                      <Text fontSize="3xs" color="#7c563f" fontWeight="600" display="flex" alignItems="center" gap={1.5}>
                        <Box as="span" className="material-symbols-outlined" fontSize="14px" flexShrink={0}>
                          info
                        </Box>
                        Beta Disclaimer: Some pictures might be missing because AI cannot recognize all face angles. Please check all photos in the main Gallery.
                      </Text>
                    </Box>
                  </Box>
                )}
              </Box>

              {/* Statistics & Game Progress */}
              <Box>
                <Text
                  fontSize="xs"
                  fontWeight="700"
                  color="var(--c-muted)"
                  mb={2}
                  textTransform="uppercase"
                >
                  Baan Game Progress (Stickering)
                </Text>
                <VStack align="stretch" gap={2}>
                  {inspectUserStats ? (
                    <>
                      <Flex
                        justify="space-between"
                        p={2.5}
                        bg="white"
                        borderRadius="lg"
                        border="1px solid"
                        borderColor="border.subtle"
                        fontSize="xs"
                      >
                        <Text color="fg.subtle">Stickers Collected</Text>
                        <Text fontWeight="700" color="brand.900">
                          {inspectUserStats.collectedCount} cards
                        </Text>
                      </Flex>
                      {inspectUser.role !== "student" && (
                        <Flex
                          justify="space-between"
                          p={2.5}
                          bg="white"
                          borderRadius="lg"
                          border="1px solid"
                          borderColor="border.subtle"
                          fontSize="xs"
                        >
                          <Text color="fg.subtle">Stickers Distributed</Text>
                          <Text fontWeight="700" color="var(--c-lagoon)">
                            {inspectUserStats.collectedFromCount} students
                          </Text>
                        </Flex>
                      )}
                      {/* VibeQuest Strike Level Indicator */}
                      <Flex
                        justify="space-between"
                        p={2.5}
                        bg="white"
                        borderRadius="lg"
                        border="1px solid"
                        borderColor="border.subtle"
                        fontSize="xs"
                        align="center"
                      >
                        <Text color="fg.subtle">Moderation Warning Strikes</Text>
                        <Badge
                          colorPalette={
                            (inspectUserStats.vibeStatus?.strike_count || 0) >= 3
                              ? "red"
                              : (inspectUserStats.vibeStatus?.strike_count || 0) > 0
                                ? "yellow"
                                : "green"
                          }
                        >
                          {inspectUserStats.vibeStatus?.strike_count || 0} / 5
                        </Badge>
                      </Flex>
                      {/* Locked until date display */}
                      {inspectUserStats.vibeStatus?.locked_until &&
                        inspectUserStats.isLocked && (
                          <Flex
                            justify="space-between"
                            p={2.5}
                            bg="red.50"
                            borderRadius="lg"
                            border="1px solid"
                            borderColor="red.200"
                            fontSize="xs"
                          >
                            <Text color="red.700" fontWeight="600">
                              Quest Lockdown Status
                            </Text>
                            <Text color="red.700" fontWeight="700">
                              Locked until{" "}
                              {new Date(
                                inspectUserStats.vibeStatus.locked_until,
                              ).toLocaleTimeString()}
                            </Text>
                          </Flex>
                        )}
                      {/* Sub-block showing which Staff users have been met/sticker collected */}
                      {inspectUserStats.unlockedStaff &&
                        inspectUserStats.unlockedStaff.length > 0 && (
                          <Box>
                            <Text
                              fontSize="xs"
                              fontWeight="700"
                              color="var(--c-muted)"
                              mb={1.5}
                              textTransform="uppercase"
                            >
                              Unlocked Staff Members (Met)
                            </Text>
                            <Flex
                              wrap="wrap"
                              gap={2}
                              maxH="100px"
                              overflowY="auto"
                              p={2}
                              bg="white"
                              borderRadius="lg"
                              border="1px solid"
                              borderColor="border.subtle"
                            >
                              {inspectUserStats.unlockedStaff.map((staff, idx) => (
                                <Flex
                                  key={idx}
                                  align="center"
                                  gap={1.5}
                                  bg="var(--c-ivory)"
                                  px={2}
                                  py={1}
                                  borderRadius="md"
                                  border="1px solid"
                                  borderColor="border.subtle"
                                  boxShadow="sm"
                                >
                                  <UserAvatar
                                      src={staff.profile_pic_url}
                                      name={staff.nickname}
                                      avatarColor={staff.avatar_color}
                                      size="24px"
                                      fontSize="xs"
                                    />
                                  <Text
                                    fontSize="sm"
                                    fontWeight="600"
                                    color="var(--c-ink)"
                                  >
                                    {staff.nickname}
                                  </Text>
                                </Flex>
                              ))}
                            </Flex>
                          </Box>
                        )}

                      {/* Admin Overrides */}
                      {user?.role === "moderator" && (
                        <Box
                          mt={2}
                          p={3}
                          bg="red.50"
                          borderRadius="lg"
                          border="1px dashed"
                          borderColor="red.300"
                        >
                          <Flex
                            fontSize="xs"
                            fontWeight="700"
                            color="red.700"
                            mb={2}
                            textTransform="uppercase"
                            alignItems="center"
                            gap={2}
                          >
                            <FiAlertTriangle size={18} color="var(--chakra-colors-red-500)" />
                            Admin Overrides
                          </Flex>
                          <VStack align="stretch" gap={3}>
                            <Button
                              size="sm"
                              bg="red.600"
                              color="white"
                              onClick={handleResetVibecheck}
                              loading={resetVibecheckMutation.isPending}
                              _hover={{ bg: "red.700" }}
                            >
                              Reset All Progress (Wipe Data)
                            </Button>

                            <HStack>
                              <SearchableSelect
                                id="admin-set-mission"
                                value={selectedMission}
                                onChange={(val) => setSelectedMission(val)}
                                options={
                                  missions?.map((m) => ({
                                    value: m.id.toString(),
                                    primaryText: `M${m.sequence_order}: ${m.required_count}x ${m.target_role}`,
                                  })) || []
                                }
                                placeholder="Select mission..."
                                aria-label="Set Mission"
                              />
                              <Button
                                size="sm"
                                bg="accent.solid"
                                color="brand.900"
                                onClick={handleSetMission}
                                loading={setMissionMutation.isPending}
                                disabled={!selectedMission}
                              >
                                Set Mission
                              </Button>
                            </HStack>
                          </VStack>
                        </Box>
                      )}
                    </>
                  ) : (
                    <Spinner size="xs" color="var(--c-lagoon)" />
                  )}
                </VStack>
              </Box>

              {/* Record Editor Form */}
              <VStack
                as="form"
                onSubmit={handleEditUser}
                gap={4}
                align="stretch"
              >
                <Heading
                  as="h4"
                  fontSize="xs"
                  fontWeight="700"
                  fontFamily="'Playfair Display', serif"
                  color="var(--c-muted)"
                  textTransform="uppercase"
                >
                  Manual Record Editor
                </Heading>
                <Box>
                  <Box
                    display="block"
                    fontSize="xs"
                    fontWeight="700"
                    color="fg.subtle"
                    mb={1}
                  >
                    <label htmlFor="inspect-nickname">Nickname</label>
                  </Box>
                  <Input
                    id="inspect-nickname"
                    value={editNickname}
                    onChange={(e) => setEditNickname(e.target.value)}
                    bg="var(--c-ivory)"
                    h="38px"
                    _focus={{ borderColor: "accent.solid", boxShadow: "0 0 0 2px var(--c-chocolate-light)", bg: "var(--c-white)" }}
                  />
                </Box>
                <Box>
                  <Box
                    display="block"
                    fontSize="xs"
                    fontWeight="700"
                    color="fg.subtle"
                    mb={1}
                  >
                    <label htmlFor="inspect-faculty">Faculty</label>
                  </Box>
                  <FacultySelect
                    value={editFaculty}
                    onChange={(val) => setEditFaculty(val)}
                  />
                </Box>
                <Box>
                  <Box
                    display="block"
                    fontSize="xs"
                    fontWeight="700"
                    color="fg.subtle"
                    mb={1}
                  >
                    <label htmlFor="inspect-major">
                      Major (Field of Study)
                    </label>
                  </Box>
                  <Input
                    id="inspect-major"
                    value={editMajor}
                    onChange={(e) => setEditMajor(e.target.value)}
                    bg="var(--c-ivory)"
                    h="38px"
                    _focus={{ borderColor: "accent.solid", boxShadow: "0 0 0 2px var(--c-chocolate-light)", bg: "var(--c-white)" }}
                  />
                </Box>
                {editRole !== "student" && (
                  <Box>
                    <Box
                      display="block"
                      fontSize="xs"
                      fontWeight="700"
                      color="fg.subtle"
                      mb={1}
                    >
                      <label htmlFor="inspect-house-position">
                        House Position (Staff Assignment)
                      </label>
                    </Box>
                    <NativeSelect.Root size="sm">
                      <NativeSelect.Field
                        id="inspect-house-position"
                        aria-label="House Position"
                        title="House Position"
                        value={editHousePosition}
                        onChange={(e) => setEditHousePosition(e.target.value)}
                        h="38px"
                        borderRadius="8px"
                        border="1.5px solid var(--c-outline)"
                        bg="var(--c-white)"
                        _focus={{ borderColor: "accent.solid", boxShadow: "0 0 0 2px var(--c-chocolate-light)" }}
                        cursor="pointer"
                      >
                        <option value="">None / Unknown</option>
                        {(dynamicPositions || STAFF_ROLES).map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Box>
                )}
                <Box>
                  <Box
                    display="block"
                    fontSize="xs"
                    fontWeight="700"
                    color="fg.subtle"
                    mb={1}
                  >
                    <label htmlFor="inspect-role">System Role</label>
                  </Box>
                  <Tooltip label={getRoleDescription(editRole)}>
                    <NativeSelect.Root size="sm">
                      <NativeSelect.Field
                        id="inspect-role"
                        aria-label="System Role"
                        title="System Role"
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        h="38px"
                        borderRadius="8px"
                        border="1.5px solid var(--c-outline)"
                        bg="var(--c-white)"
                        _focus={{ borderColor: "accent.solid", boxShadow: "0 0 0 2px var(--c-chocolate-light)" }}
                        cursor="pointer"
                      >
                        <option value="student">Student</option>
                        <option value="staff">Staff</option>

                        <option value="moderator">Moderator</option>
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Tooltip>
                </Box>
                <Button
                  type="submit"
                  bg="accent.solid"
                  color="brand.900"
                  h="40px"
                  py={1.5}
                  borderRadius="lg"
                  cursor="pointer"
                >
                  Save Changes
                </Button>
              </VStack>

              {/* Inspector local audit logs */}
              <VStack align="stretch" gap={2} mt={2}>
                <Heading
                  as="h4"
                  fontSize="xs"
                  fontWeight="700"
                  fontFamily="'Playfair Display', serif"
                  color="var(--c-muted)"
                  textTransform="uppercase"
                >
                  Recent Administrative Audit Log
                </Heading>
                <Box
                  maxH="150px"
                  overflowY="auto"
                  border="1px solid"
                  borderColor="border.subtle"
                  borderRadius="lg"
                  p={3}
                >
                  {inspectUserLogs.map((log) => (
                    <Box
                      key={log.id}
                      fontSize="xs"
                      borderBottom="1px solid"
                      borderColor="border.subtle"
                      py={1.5}
                      px={3}
                    >
                      <Text color="fg.subtle">
                        {new Date(log.created_at).toLocaleString()} -{" "}
                        <strong>{log.action_type}</strong>
                      </Text>
                      <Text>{log.details}</Text>
                    </Box>
                  ))}
                  {inspectUserLogs.length === 0 && (
                    <Text
                      fontSize="xs"
                      fontStyle="italic"
                      color="fg.subtle"
                      p={2}
                    >
                      No recent logs found for this user.
                    </Text>
                  )}
                </Box>
              </VStack>
            </VStack>
          </Dialog.Body>

          <Dialog.CloseTrigger
            position="absolute"
            top={4}
            right={4}
            asChild
          >
            <Button
              variant="ghost"
              w="44px"
              h="44px"
              minW="44px"
              borderRadius="full"
              display="flex"
              alignItems="center"
              justifyContent="center"
              cursor="pointer"
              color="var(--c-muted)"
              p={0}
              onClick={onClose}
            >
              <Box
                as="span"
                className="material-symbols-outlined"
                fontSize="20px"
              >
                close
              </Box>
            </Button>
          </Dialog.CloseTrigger>
        </Dialog.Content>
        </Dialog.Positioner>
      </Portal>

      <ImmichFacePickerModal
        isOpen={isFacePickerOpen}
        onClose={() => setIsFacePickerOpen(false)}
        targetUser={inspectUser}
        onClaimSuccess={async () => {
          if (inspectUser?.student_id) {
            const { data } = await supabase
              .from("user_faces")
              .select("immich_person_id, created_at")
              .eq("student_id", inspectUser.student_id);
            if (data) setClaimedFaces(data);
          }
          onRefreshStats?.();
        }}
      />
    </Dialog.Root>
  );
}
