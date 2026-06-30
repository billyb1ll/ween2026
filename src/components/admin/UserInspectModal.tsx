import React, { useEffect } from "react";
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
} from "@chakra-ui/react";
import { Tooltip } from "../ui/tooltip";
import { FacultySelect } from "../FacultySelect";
import { SearchableSelect } from "../SearchableSelect";
import { STAFF_ROLES } from "../../lib/constants";
import type { DBUser, AuditLog } from "../../pages/AdminDashboardPage";
import { UserAvatar } from "../UserAvatar";

interface UserInspectModalProps {
  inspectUser: DBUser | null;
  onClose: () => void;
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
}

export function UserInspectModal({
  inspectUser,
  onClose,
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
}: UserInspectModalProps) {
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
      <Dialog.Backdrop
        bg="color-mix(in srgb, var(--c-ink) 70%, transparent)"
        backdropFilter="blur(4px)"
      />
      <Dialog.Positioner zIndex={2200} px={4}>
        <Dialog.Content
          bg="var(--c-ivory)"
          border={{ base: "none", md: "2px solid var(--c-chocolate)" }}
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
              color="var(--c-chocolate)"
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
                  border="2px solid var(--c-chocolate)"
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
                            ? "teal"
                            : inspectUser.role === "media_admin"
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
                        <Text fontWeight="700" color="var(--c-chocolate)">
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
                    _focus={{ borderColor: "var(--c-chocolate)", boxShadow: "0 0 0 2px var(--c-chocolate-light)", bg: "var(--c-white)" }}
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
                    _focus={{ borderColor: "var(--c-chocolate)", boxShadow: "0 0 0 2px var(--c-chocolate-light)", bg: "var(--c-white)" }}
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
                    <SearchableSelect
                      id="inspect-house-position"
                      value={editHousePosition}
                      onChange={(val) => setEditHousePosition(val)}
                      options={[
                        { value: "", primaryText: "None / Unknown" },
                        ...STAFF_ROLES.map((role) => ({
                          value: role,
                          primaryText: role,
                        })),
                      ]}
                      placeholder="Select position..."
                      searchPlaceholder="ค้นหาตำแหน่ง / Search position..."
                      aria-label="House Position"
                      title="House Position"
                    />
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
                    <SearchableSelect
                      id="inspect-role"
                      value={editRole}
                      onChange={(val) => setEditRole(val)}
                      options={[
                        { value: "student", primaryText: "Student", badge: "STUDENT" },
                        { value: "staff", primaryText: "Staff", badge: "STAFF" },
                        { value: "media_admin", primaryText: "Media Admin", badge: "MEDIA" },
                        { value: "moderator", primaryText: "Moderator", badge: "MOD" },
                      ]}
                      placeholder="Select role..."
                      searchPlaceholder="ค้นหาบทบาท / Search role..."
                      aria-label="System Role"
                      title="System Role"
                    />
                  </Tooltip>
                </Box>
                <Button
                  type="submit"
                  bg="var(--c-chocolate)"
                  color="white"
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
    </Dialog.Root>
  );
}
