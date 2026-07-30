import {
  Box,
  Dialog,
  Flex,
  HStack,
  Text,
  VStack,
  Spinner,
  Badge,
} from "@chakra-ui/react";
import { UserAvatar } from "../UserAvatar";
import { useLikedByUsers } from "../../hooks/useLikedByUsers";
import { FACULTIES } from "../../lib/constants";

interface LikedByModalProps {
  isOpen: boolean;
  onClose: () => void;
  likedByStudentIds: string[];
  postLikesCount: number;
  onInspectUser?: (studentId: string) => void;
}

interface FacultyMatch {
  en?: string;
  th?: string;
  short?: string;
}

const getShortFaculty = (faculty: string | null | undefined): string | null => {
  if (!faculty) return null;
  const match = (FACULTIES as FacultyMatch[]).find(
    (f) => f.en === faculty || f.th === faculty || f.short === faculty
  );
  if (match && match.short) return match.short;
  const words = faculty.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].substring(0, 4).toUpperCase();
  return words
    .filter((w) => w.length > 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .substring(0, 4);
};

export function LikedByModal({
  isOpen,
  onClose,
  likedByStudentIds,
  postLikesCount,
  onInspectUser,
}: LikedByModalProps) {
  const { data: likers = [], isLoading } = useLikedByUsers(likedByStudentIds, isOpen);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Dialog.Backdrop
        bg="rgba(13, 26, 54, 0.65)"
        backdropFilter="blur(6px)"
        transition="opacity 0.25s ease"
      />
      <Dialog.Positioner
        zIndex={2200}
        px={{ base: 0, md: 4 }}
        py={{ base: 0, md: 6 }}
        display="flex"
        alignItems={{ base: "flex-end", md: "center" }}
        justifyContent="center"
      >
        <Dialog.Content
          w="100%"
          maxW={{ base: "100%", md: "460px" }}
          bg="#FFFFFF"
          color="brand.900"
          borderTopRadius={{ base: "3xl", md: "2xl" }}
          borderBottomRadius={{ base: "0", md: "2xl" }}
          boxShadow="0 24px 60px rgba(13, 26, 54, 0.35)"
          overflow="hidden"
          animation="fade-in-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
          border="1px solid"
          borderColor="rgba(59, 106, 191, 0.15)"
          p={0}
        >
          {/* Mobile Drag/Pull Handle */}
          <Box
            display={{ base: "block", md: "none" }}
            pt={3}
            pb={1}
            w="100%"
            textAlign="center"
          >
            <Box
              w="36px"
              h="4px"
              bg="rgba(13, 26, 54, 0.18)"
              borderRadius="full"
              mx="auto"
            />
          </Box>

          {/* Modal Header */}
          <Dialog.Header px={6} pt={{ base: 3, md: 6 }} pb={4} borderBottom="1px solid" borderColor="rgba(13, 26, 54, 0.08)">
            <Flex align="center" justify="space-between" w="100%">
              <HStack gap={2.5}>
                <Flex
                  w={9}
                  h={9}
                  borderRadius="full"
                  bg="rgba(242, 100, 117, 0.12)"
                  align="center"
                  justify="center"
                  color="#f26475"
                >
                  <Box className="material-symbols-outlined fill" fontSize="20px">
                    favorite
                  </Box>
                </Flex>
                <VStack align="start" gap={0}>
                  <Dialog.Title fontSize="md" fontWeight="800" color="brand.900">
                    Liked By
                  </Dialog.Title>
                  <Text fontSize="xs" color="rgba(13, 26, 54, 0.6)" fontWeight="500">
                    {postLikesCount} {postLikesCount === 1 ? "like" : "likes"} total
                  </Text>
                </VStack>
              </HStack>

              <Dialog.CloseTrigger
                asChild
                onClick={onClose}
                position="relative"
                top="0"
                right="0"
              >
                <Box
                  as="button"
                  w={8}
                  h={8}
                  borderRadius="full"
                  bg="rgba(13, 26, 54, 0.05)"
                  color="brand.900"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  _hover={{ bg: "rgba(13, 26, 54, 0.1)" }}
                  transition="all 0.2s"
                >
                  <Box className="material-symbols-outlined" fontSize="18px">
                    close
                  </Box>
                </Box>
              </Dialog.CloseTrigger>
            </Flex>
          </Dialog.Header>

          {/* Modal Body */}
          <Dialog.Body px={4} py={4} maxH={{ base: "65vh", md: "420px" }} overflowY="auto">
            {isLoading ? (
              <Flex align="center" justify="center" py={10} direction="column" gap={3}>
                <Spinner color="brand.solid" size="md" />
                <Text fontSize="xs" color="rgba(13, 26, 54, 0.6)">
                  Loading likers list...
                </Text>
              </Flex>
            ) : likers.length === 0 ? (
              <VStack py={10} gap={2} textAlign="center">
                <Box
                  className="material-symbols-outlined"
                  fontSize="40px"
                  color="rgba(13, 26, 54, 0.25)"
                >
                  favorite_border
                </Box>
                <Text fontSize="sm" fontWeight="700" color="brand.900">
                  No likes yet
                </Text>
                <Text fontSize="xs" color="rgba(13, 26, 54, 0.6)">
                  Be the first to like this memory!
                </Text>
              </VStack>
            ) : (
              <VStack gap={2} align="stretch">
                {likers.map((user) => {
                  const isStaff = user.role !== "student";
                  const prefix = isStaff ? "P' " : "N' ";
                  const displayName = `${prefix}${user.nickname || "Guest"}`;
                  const shortFac = getShortFaculty(user.faculty);

                  return (
                    <Flex
                      key={user.student_id}
                      align="center"
                      justify="space-between"
                      p={3}
                      borderRadius="xl"
                      bg="rgba(13, 26, 54, 0.03)"
                      border="1px solid"
                      borderColor="rgba(13, 26, 54, 0.06)"
                      transition="all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
                      _hover={{
                        bg: "rgba(59, 106, 191, 0.08)",
                        transform: "translateX(2px)",
                        borderColor: "rgba(59, 106, 191, 0.2)",
                      }}
                      onClick={() => {
                        if (onInspectUser) {
                          onInspectUser(user.student_id);
                          onClose();
                        }
                      }}
                      cursor={onInspectUser ? "pointer" : "default"}
                      role={onInspectUser ? "button" : undefined}
                      tabIndex={onInspectUser ? 0 : undefined}
                    >
                      <HStack gap={3}>
                        <UserAvatar
                          src={user.profile_pic_url}
                          name={displayName}
                          avatarColor={user.avatar_color || "#496268"}
                          size="40px"
                          fontSize="sm"
                        />
                        <VStack align="start" gap={0.5}>
                          <HStack gap={1.5} flexWrap="wrap">
                            <Text fontSize="sm" fontWeight="700" color="brand.900" lineHeight={1.2}>
                              {displayName}
                            </Text>
                            {isStaff && (
                              <Badge colorPalette="teal" fontSize="3xs" px={1.5} py={0.2}>
                                {user.house_position || user.role}
                              </Badge>
                            )}
                          </HStack>
                          {shortFac && (
                            <Text fontSize="2xs" fontWeight="600" color="rgba(13, 26, 54, 0.55)">
                              {shortFac} Faculty
                            </Text>
                          )}
                        </VStack>
                      </HStack>

                      {onInspectUser && (
                        <Box
                          className="material-symbols-outlined"
                          fontSize="18px"
                          color="rgba(13, 26, 54, 0.4)"
                        >
                          chevron_right
                        </Box>
                      )}
                    </Flex>
                  );
                })}
              </VStack>
            )}
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
