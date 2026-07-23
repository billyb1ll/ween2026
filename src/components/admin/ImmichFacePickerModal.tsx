import { useState, useEffect, useMemo } from "react";
import {
  Box,
  Flex,
  Text,
  Spinner,
  Button,
  Dialog,
  HStack,
  Portal,
  Badge,
  Input,
} from "@chakra-ui/react";
import { immich } from "../../lib/immich";
import type { ImmichPerson } from "../../lib/immich";
import { supabase } from "../../lib/supabase";
import { toaster } from "../ui/toaster";
import { useUser } from "../../context/UserContext";

interface ImmichFacePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: {
    student_id: string;
    nickname: string | null;
    full_name?: string | null;
    profile_pic_url?: string | null;
    avatar_color?: string;
  } | null;
  onClaimSuccess?: () => void;
}

export function ImmichFacePickerModal({
  isOpen,
  onClose,
  targetUser,
  onClaimSuccess,
}: ImmichFacePickerModalProps) {
  const { user: currentUser } = useUser();
  const [people, setPeople] = useState<ImmichPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"unclaimed" | "all">("unclaimed");
  const [selectedPersonIds, setSelectedPersonIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    immich.people
      .list()
      .then((data) => {
        if (isMounted) {
          setPeople(data.people || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Error loading people in FacePickerModal:", err);
        if (isMounted) {
          setLoading(false);
        }
      });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedPersonIds(new Set());
    setSearchQuery("");

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const filteredPeople = useMemo(() => {
    let list = people;
    if (filterTab === "unclaimed") {
      list = list.filter((p) => !p.name || p.name.trim() === "");
    }
    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase();
    return list.filter(
      (p, i) =>
        `face ${i + 1}`.includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.name && p.name.toLowerCase().includes(q))
    );
  }, [people, filterTab, searchQuery]);

  const toggleSelectPerson = (id: string) => {
    setSelectedPersonIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleClaim = async () => {
    if (!targetUser || selectedPersonIds.size === 0) return;
    setClaiming(true);

    try {
      const ids = Array.from(selectedPersonIds);
      const inserts = ids.map((personId) => ({
        student_id: targetUser.student_id,
        immich_person_id: personId,
      }));

      // 1. Insert into user_faces table
      const { error: sbError } = await supabase.from("user_faces").insert(inserts);
      if (sbError && sbError.code !== "23505") {
        console.error("Supabase user_faces insert error:", sbError);
      }

      // 2. Update name on Immich person objects (safely catch 403 or server errors)
      const formattedName = targetUser.nickname
        ? `${targetUser.nickname} (${targetUser.student_id})`
        : `Student ${targetUser.student_id}`;

      await Promise.all(
        ids.map(async (id) => {
          try {
            await immich.people.update(id, { name: formattedName });
          } catch (immichErr) {
            console.warn(`Immich person name update 403/error for ${id}:`, immichErr);
          }
        })
      );

      // 3. If target user has no avatar set, update profile picture from first claimed face preview
      if (!targetUser.profile_pic_url && ids.length > 0) {
        try {
          const assetsData = await immich.assets.searchMetadata({ personIds: [ids[0]] });
          const firstAsset = assetsData.assets?.items?.[0];
          if (firstAsset) {
            const previewUrl = immich.assets.thumbnailUrl(firstAsset.id, "preview");
            await supabase
              .from("users")
              .update({ profile_pic_url: previewUrl, immich_asset_id: firstAsset.id })
              .eq("student_id", targetUser.student_id);
          }
        } catch (avatarErr) {
          console.error("Failed to auto-update target user avatar:", avatarErr);
        }
      }

      // 4. Log audit log
      try {
        await supabase.from("audit_logs").insert({
          moderator_id: currentUser?.student_id,
          action_type: "admin_claim_face",
          target_id: targetUser.student_id,
          details: `Moderator claimed ${ids.length} face(s) for student ID ${targetUser.student_id}`,
        });
      } catch (auditErr) {
        console.error("Audit log error:", auditErr);
      }

      toaster.create({
        title: "Face Claimed Successfully!",
        description: `Linked ${ids.length} face(s) to ${targetUser.nickname || targetUser.student_id}.`,
        type: "success",
      });

      onClaimSuccess?.();
      onClose();
    } catch (err) {
      console.error("Admin face claim error:", err);
      toaster.create({
        title: "Claim Failed",
        description: "Failed to claim face for user. Please try again.",
        type: "error",
      });
    } finally {
      setClaiming(false);
    }
  };

  if (!isOpen || !targetUser) return null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose} placement={{ base: "bottom", md: "center" }}>
      <Portal>
        <Dialog.Backdrop bg="color-mix(in srgb, var(--c-ink) 70%, transparent)" backdropFilter="blur(4px)" />
        <Dialog.Positioner zIndex={2300} px={4}>
          <Dialog.Content
            bg="var(--c-ivory)"
            border="2px solid var(--chakra-colors-accent-solid)"
            color="var(--c-ink)"
            borderRadius="2xl"
            maxW="640px"
            w="100%"
            maxH="85vh"
            p={6}
            boxShadow="var(--shadow-card)"
            display="flex"
            flexDirection="column"
            position="relative"
          >
            <Dialog.Header p={0} mb={4}>
              <Flex justify="space-between" align="center">
                <Box>
                  <Dialog.Title fontSize="lg" fontWeight="700" color="brand.900">
                    Claim Face for {targetUser.nickname || `ID ${targetUser.student_id}`}
                  </Dialog.Title>
                  <Text fontSize="xs" color="fg.subtle">
                    Select unrecognized facial clusters to link to student ID #{targetUser.student_id}
                  </Text>
                </Box>
              </Flex>
            </Dialog.Header>

            <Dialog.Body p={0} flex={1} overflowY="auto" display="flex" flexDirection="column" gap={4}>
              {/* Filter Tabs & Search Bar */}
              <Flex gap={3} flexWrap="wrap" align="center" justify="space-between">
                <HStack gap={2}>
                  <Button
                    size="xs"
                    variant={filterTab === "unclaimed" ? "solid" : "outline"}
                    bg={filterTab === "unclaimed" ? "brand.900" : "transparent"}
                    color={filterTab === "unclaimed" ? "white" : "brand.900"}
                    onClick={() => setFilterTab("unclaimed")}
                    cursor="pointer"
                  >
                    Unclaimed Faces ({people.filter((p) => !p.name || p.name.trim() === "").length})
                  </Button>
                  <Button
                    size="xs"
                    variant={filterTab === "all" ? "solid" : "outline"}
                    bg={filterTab === "all" ? "brand.900" : "transparent"}
                    color={filterTab === "all" ? "white" : "brand.900"}
                    onClick={() => setFilterTab("all")}
                    cursor="pointer"
                  >
                    All Clusters ({people.length})
                  </Button>
                </HStack>

                <Input
                  placeholder="Search face # or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  size="sm"
                  maxW="220px"
                  bg="white"
                  borderRadius="md"
                />
              </Flex>

              {/* People Grid */}
              {loading ? (
                <Flex justify="center" align="center" py={12}>
                  <Spinner size="md" color="accent.solid" />
                </Flex>
              ) : filteredPeople.length === 0 ? (
                <Box py={8} textAlign="center" bg="white" borderRadius="lg" border="1px dashed" borderColor="border.subtle">
                  <Text fontSize="sm" color="fg.subtle">
                    No matching faces found.
                  </Text>
                </Box>
              ) : (
                <Box
                  display="grid"
                  gridTemplateColumns={{ base: "repeat(3, 1fr)", sm: "repeat(4, 1fr)", md: "repeat(5, 1fr)" }}
                  gap={3}
                  maxH="380px"
                  overflowY="auto"
                  p={1}
                >
                  {filteredPeople.map((person, idx) => {
                    const isSelected = selectedPersonIds.has(person.id);
                    const thumbnailUrl = immich.people.thumbnailUrl(person.id);

                    return (
                      <Box
                        key={person.id}
                        position="relative"
                        borderRadius="xl"
                        overflow="hidden"
                        border="2px solid"
                        borderColor={isSelected ? "accent.solid" : "border.subtle"}
                        boxShadow={isSelected ? "0 0 0 2px var(--chakra-colors-accent-solid)" : "none"}
                        cursor="pointer"
                        onClick={() => toggleSelectPerson(person.id)}
                        transition="all 0.2s ease"
                        bg="white"
                        _hover={{ transform: "translateY(-2px)" }}
                      >
                        <Box position="relative" pt="100%" bg="gray.100">
                          <img
                            src={thumbnailUrl}
                            alt={`Face ${idx + 1}`}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='%23999'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/></svg>";
                            }}
                            style={{
                              position: "absolute",
                              inset: 0,
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                            loading="lazy"
                          />
                          {isSelected && (
                            <Flex
                              position="absolute"
                              inset={0}
                              bg="rgba(235, 126, 61, 0.4)"
                              align="center"
                              justify="center"
                            >
                              <Badge colorPalette="orange" size="sm">
                                Selected
                              </Badge>
                            </Flex>
                          )}
                        </Box>

                        <Box p={1.5} bg="white" textOverflow="ellipsis" overflow="hidden" whiteSpace="nowrap">
                          <Text fontSize="2xs" fontWeight="700" color="brand.900" textAlign="center">
                            {person.name || `Face #${idx + 1}`}
                          </Text>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Dialog.Body>

            <Dialog.Footer p={0} mt={5}>
              <HStack justify="space-between" w="100%">
                <Text fontSize="xs" color="fg.subtle">
                  {selectedPersonIds.size} face(s) selected
                </Text>

                <HStack gap={3}>
                  <Button variant="ghost" size="sm" onClick={onClose} cursor="pointer">
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    bg="accent.solid"
                    color="brand.900"
                    onClick={handleClaim}
                    loading={claiming}
                    disabled={selectedPersonIds.size === 0}
                    cursor="pointer"
                  >
                    Claim {selectedPersonIds.size > 0 ? `(${selectedPersonIds.size})` : ""}
                  </Button>
                </HStack>
              </HStack>
            </Dialog.Footer>

            <Dialog.CloseTrigger position="absolute" top={4} right={4} asChild>
              <Button variant="ghost" size="xs" onClick={onClose} cursor="pointer" p={0}>
                <Box as="span" className="material-symbols-outlined" fontSize="18px">
                  close
                </Box>
              </Button>
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
