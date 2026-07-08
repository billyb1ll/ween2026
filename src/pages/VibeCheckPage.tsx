import {
  Box,
  Flex,
  Heading,
  HStack,
  Text,
  VStack,
  Button,
  Input,
  Portal,
  Image,
  Spinner,
  Dialog,
  Badge,
  Grid,
} from "@chakra-ui/react";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import {
  motion,
  useMotionValue,
  useTransform,
  AnimatePresence,
  animate,
} from "framer-motion";
import { useUser } from "../context/UserContext";
import { supabase } from "../lib/supabase";
import { toaster } from "../components/ui/toaster";
import { UserAvatar } from "../components/UserAvatar";
import { StaffVibeDashboard } from "../components/admin/StaffVibeDashboard";
import {
  useVibecheckEnabled,
  useVibeStatus,
  useCollectedCards,
  useWhitelistedStaff,
  useSwipeCardMutation,
  useVibeDeck,
  useMaxStrikesConfig,
  vibeQueryKeys,
  type DBStaff,
} from "../hooks/useVibeQueries";

interface StaffProfile {
  id: string; // student_id
  name: string;
  avatar_color: string;
  profile_pic_url: string | null;
  bio: string;
  ig: string | null;
  images: string[];
  tags: string[];
}

interface StickerBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  groupedStaffData: {
    grouped: Record<string, DBStaff[]>;
    sortedKeys: string[];
  };
  collectedIds: Set<string> | undefined;
  setSelectedStaffDetail: (staff: DBStaff) => void;
}

function StickerBookModal({
  isOpen,
  onClose,
  searchQuery,
  setSearchQuery,
  groupedStaffData,
  collectedIds,
  setSelectedStaffDetail,
}: StickerBookModalProps) {
  if (!isOpen) return null;

  return (
    <Portal>
      {/* Backdrop */}
      <Box
        position="fixed"
        top={0}
        left={0}
        right={0}
        bottom={0}
        bg="color-mix(in srgb, var(--c-ink) 50%, transparent)"
        zIndex="2000"
        onClick={onClose}
      />
      {/* Drawer content */}
      <Box
        position="fixed"
        top={0}
        right={0}
        h="100vh"
        w={{ base: "100%", md: "460px" }}
        bg="var(--c-ivory)"
        borderLeft="2px solid var(--c-chocolate)"
        boxShadow="-4px 0 20px rgba(0,0,0,0.15)"
        zIndex="2100"
        display="flex"
        flexDirection="column"
        p={6}
      >
        <Flex justify="space-between" align="center" mb={4}>
          <HStack gap={2}>
            <Box
              as="span"
              className="material-symbols-outlined"
              fontSize="22px"
              color="accent.solid"
              aria-hidden="true"
            >
              auto_stories
            </Box>
            <Heading as="h2" fontSize="md" color="var(--c-chocolate)" fontWeight="800">
              Orientation Sticker Album
            </Heading>
          </HStack>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            cursor="pointer"
          >
            Close
          </Button>
        </Flex>

        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by nickname or department..."
          bg="white"
          borderRadius="xl"
          mb={4}
          fontSize="xs"
          h="38px"
          _focus={{ borderColor: "var(--c-chocolate)" }}
        />

        {/* List scroll wrapper */}
        <Box flex={1} overflowY="auto" pr={1}>
          {groupedStaffData.sortedKeys.map((position) => {
            const staffList = groupedStaffData.grouped[position];
            return (
              <Box key={position} mb={5}>
                <Text
                  fontSize="2xs"
                  fontWeight="700"
                  color="var(--c-muted)"
                  mb={2.5}
                  textTransform="uppercase"
                  letterSpacing="0.04em"
                >
                  {position}
                </Text>

                <Grid templateColumns="repeat(3, 1fr)" gap={2.5}>
                  {staffList.map((staff) => {
                    const isCollected = collectedIds?.has(staff.student_id);
                    return (
                      <Box
                        key={staff.student_id}
                        onClick={() => {
                          if (isCollected) {
                            setSelectedStaffDetail(staff);
                          } else {
                            toaster.create({
                              title: "Locked!",
                              description: "Successfully guess this staff member to unlock profile details.",
                              type: "warning",
                            });
                          }
                        }}
                        position="relative"
                        bg={isCollected ? "white" : "blackAlpha.50"}
                        border="1px solid"
                        borderColor={isCollected ? "border.subtle" : "blackAlpha.100"}
                        borderRadius="xl"
                        p={2.5}
                        textAlign="center"
                        cursor={isCollected ? "pointer" : "not-allowed"}
                        opacity={isCollected ? 1 : 0.6}
                        transition="transform 0.2s"
                        _hover={isCollected ? { transform: "translateY(-2px)" } : {}}
                      >
                        <Flex justify="center" mb={2}>
                          <UserAvatar
                            src={isCollected ? staff.profile_pic_url : null}
                            name={isCollected ? staff.nickname || "Staff" : "?"}
                            avatarColor={isCollected ? staff.avatar_color : "#CBD5E0"}
                            size="44px"
                            fontSize="sm"
                          />
                        </Flex>
                        <Text
                          fontSize="2xs"
                          fontWeight="700"
                          color={isCollected ? "var(--c-ink)" : "fg.subtle"}
                          lineClamp={1}
                        >
                          {isCollected ? staff.nickname : "???"}
                        </Text>
                      </Box>
                    );
                  })}
                </Grid>
              </Box>
            );
          })}
          {groupedStaffData.sortedKeys.length === 0 && (
            <Box py={8} textAlign="center">
              <Text fontSize="xs" color="fg.muted" fontStyle="italic">
                No matching staff members found.
              </Text>
            </Box>
          )}
        </Box>
      </Box>
    </Portal>
  );
}

const ProfileCardView = ({ profile }: { profile: StaffProfile }) => (
  <Box
    h="100%"
    w="100%"
    bg="white"
    borderRadius="2xl"
    border="1.5px solid var(--c-chocolate)"
    boxShadow="var(--shadow-card)"
    overflow="hidden"
    display="flex"
    flexDirection="column"
    position="relative"
  >
    <Box position="relative" flex={1} bg="bg.muted">
      <Image
        src={
          profile?.images?.[0] ||
          profile?.profile_pic_url ||
          "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500&h=700&fit=crop"
        }
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src =
            "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500&h=700&fit=crop";
        }}
        alt="Baan 7 Staff Member"
        w="100%"
        h={{ base: "380px", md: "450px" }}
        objectFit="cover"
        draggable={false}
      />
      <Box
        position="absolute"
        bottom={0}
        left={0}
        right={0}
        h="120px"
        bg="linear-gradient(to top, color-mix(in srgb, var(--c-ink) 85%, transparent), transparent)"
      />
      <VStack
        position="absolute"
        bottom={0}
        left={0}
        right={0}
        p={4}
        align="stretch"
        gap={1}
      >
        <HStack justify="space-between">
          <Heading as="h3" fontSize="md" color="white" fontWeight="800" textShadow="0 1px 3px rgba(0,0,0,0.5)">
            {profile?.name}
          </Heading>
          {profile?.ig && (
            <Text
              fontSize="2xs"
              color="accent.solid"
              fontWeight="bold"
              bg="whiteAlpha.200"
              px={2}
              py={0.5}
              borderRadius="full"
              backdropFilter="blur(4px)"
            >
              @{profile?.ig}
            </Text>
          )}
        </HStack>
        <Text fontSize="2xs" color="whiteAlpha.800" lineHeight="1.4" lineClamp={2} textShadow="0 1px 2px rgba(0,0,0,0.5)">
          {profile?.bio}
        </Text>
        <HStack gap={1.5} mt={1} wrap="wrap">
          {profile?.tags?.map((t) => (
            <Badge
              key={t}
              size="xs"
              bg="whiteAlpha.200"
              color="white"
              backdropFilter="blur(4px)"
              borderRadius="full"
              px={2}
              py={0.5}
              border="0.5px solid whiteAlpha.300"
            >
              #{t}
            </Badge>
          ))}
        </HStack>
      </VStack>
    </Box>
  </Box>
);

export function VibeCheckPage() {
  const { user, loading: authLoading } = useUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // React Query data fetching layer
  const { data: vibecheckEnabled, isLoading: isConfigLoading } = useVibecheckEnabled();
  const { data: vibeStatus, isLoading: isStatusLoading } = useVibeStatus(user?.student_id);
  const currentMission = vibeStatus?.vibe_missions || null;
  const { data: collectedIds, isLoading: isCollectedLoading } = useCollectedCards(user?.student_id);
  const { data: queryDeck = [], isLoading: isDeckLoading } = useVibeDeck(user?.student_id, currentMission?.target_role);
  const { data: allStaff = [] } = useWhitelistedStaff();
  const { data: maxStrikesConfig = 5 } = useMaxStrikesConfig();
  const swipeCardMutation = useSwipeCardMutation(user?.student_id);

  // Deck states
  const [deck, setDeck] = useState<StaffProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const isSwipingRef = useRef(false);

  // Sticker Book Drawer States
  const [isStickerOpen, setIsStickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStaffDetail, setSelectedStaffDetail] = useState<DBStaff | null>(null);

  // Mission Clear Celebration State
  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const [clearedMissionTarget, setClearedMissionTarget] = useState("");

  const loading = isConfigLoading || isStatusLoading || isCollectedLoading || isDeckLoading;

  // Derived vibe states
  const strikeCount = vibeStatus?.strike_count || 0;
  const lockoutUntil = vibeStatus?.locked_until ? new Date(vibeStatus.locked_until).getTime() : null;

  const [lockoutTimeLeft, setLockoutTimeLeft] = useState(0);

  // Populate deck from React Query server-filtered deck data
  useEffect(() => {
    if (queryDeck.length > 0 && deck.length === 0) {
      const secureDeck: StaffProfile[] = queryDeck.map((s) => ({
        id: s.student_id,
        name: s.nickname || "Staff Member",
        avatar_color: s.avatar_color || "var(--c-lagoon)",
        profile_pic_url: s.profile_pic_url,
        bio: s.bio || "Orientation staff ready to answer all your questions!",
        ig: s.ig,
        images: s.images && s.images.length > 0
          ? s.images
          : [s.profile_pic_url || "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500&h=700&fit=crop"],
        tags: s.tags && s.tags.length > 0 ? s.tags : [s.faculty || "Baan 7", "Staff"],
      }));

      // Fisher-Yates shuffle
      for (let i = secureDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [secureDeck[i], secureDeck[j]] = [secureDeck[j], secureDeck[i]];
      }

      // Set deck state asynchronously to avoid synchronous setState calls inside the effect body
      Promise.resolve().then(() => {
        setDeck(secureDeck);
        setCurrentIndex(0);
      });
    }
  }, [queryDeck, deck.length]);

  const collectedCountForMission = useMemo<number>(() => {
    if (!currentMission || !collectedIds || allStaff.length === 0) return 0;
    const reqRole = currentMission.target_role;
    let count = 0;
    collectedIds.forEach((staffId) => {
      const staff = allStaff.find((s) => s.student_id === staffId);
      if (staff && (staff.house_position === reqRole || staff.major === reqRole || staff.role === reqRole)) {
        count++;
      }
    });
    return count;
  }, [currentMission, collectedIds, allStaff]);

  const actualStaffAvailableForRole = useMemo(() => {
    if (!currentMission || allStaff.length === 0) return 0;
    const reqRole = currentMission.target_role;
    return allStaff.filter((s) => s.house_position === reqRole || s.major === reqRole || s.role === reqRole).length;
  }, [currentMission, allStaff]);

  const adjustedRequiredCount = useMemo(() => {
    if (!currentMission) return 0;
    return Math.min(currentMission.required_count, actualStaffAvailableForRole);
  }, [currentMission, actualStaffAvailableForRole]);

  // NOTE: Mission advancement is handled atomically by the server-side swipe_card_secure RPC.
  // No client-side auto-advance is needed — removing prevents double-advance race conditions.

  // Lockout Countdown Timer Effect
  useEffect(() => {
    if (!lockoutUntil) return;
    const interval = setInterval(() => {
      const diff = lockoutUntil - Date.now();
      if (diff <= 0) {
        if (user?.student_id) {
          queryClient.invalidateQueries({ queryKey: vibeQueryKeys.status(user.student_id) });
        }
        clearInterval(interval);
      } else {
        setLockoutTimeLeft(diff);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil, user?.student_id, queryClient]);

  // Realtime Broadcast Event Synchronization
  useEffect(() => {
    const syncChannel = supabase.channel("live_chat:system_config_sync");
    syncChannel
      .on("broadcast", { event: "vibe_quest_change" }, () => {
        queryClient.invalidateQueries({ queryKey: ["vibecheck_enabled"] });
        queryClient.invalidateQueries({ queryKey: ["vibe_deck"] });
        if (user?.student_id) {
          queryClient.invalidateQueries({ queryKey: vibeQueryKeys.status(user.student_id) });
          queryClient.invalidateQueries({ queryKey: vibeQueryKeys.collected(user.student_id) });
          queryClient.invalidateQueries({ queryKey: vibeQueryKeys.deck(user.student_id) });
        }
      })
      .on("broadcast", { event: "config_change" }, () => {
        queryClient.invalidateQueries({ queryKey: ["vibecheck_enabled"] });
        queryClient.invalidateQueries({ queryKey: ["vibe_deck"] });
        if (user?.student_id) {
          queryClient.invalidateQueries({ queryKey: vibeQueryKeys.status(user.student_id) });
          queryClient.invalidateQueries({ queryKey: vibeQueryKeys.collected(user.student_id) });
          queryClient.invalidateQueries({ queryKey: vibeQueryKeys.deck(user.student_id) });
        }
      })
      .on("broadcast", { event: "force_vibe_refresh" }, (payload) => {
        if (user?.student_id && payload.payload?.target_student_id === user.student_id) {
          queryClient.invalidateQueries({ queryKey: vibeQueryKeys.status(user.student_id) });
          queryClient.invalidateQueries({ queryKey: vibeQueryKeys.collected(user.student_id) });
          queryClient.invalidateQueries({ queryKey: vibeQueryKeys.deck(user.student_id) });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(syncChannel);
    };
  }, [user, queryClient]);

  // Redirect logic when VibeCheck is disabled
  useEffect(() => {
    if (!loading && !vibecheckEnabled) {
      if (user?.role === "student") {
        navigate("/", { replace: true });
      } else if (user && ["staff", "media_admin", "moderator"].includes(user.role)) {
        toaster.create({
          title: "ระบบ Vibe Check ถูกปิดใช้งานชั่วคราว",
          type: "warning",
        });
        navigate("/admin", { replace: true });
      }
    }
  }, [loading, vibecheckEnabled, user, navigate]);

  // Swipe Gesture Motion Values
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const collectOpacity = useTransform(x, [0, 80], [0, 1]);
  const skipOpacity = useTransform(x, [-80, 0], [1, 0]);

  // Safe Swipe Handler wired into Secure DB RPC
  const performSwipeSecure = useCallback(
    async (direction: "left" | "right") => {
      const profile = deck[currentIndex];
      if (!profile || !user) return;
      const activeStaffId = profile.id;

      try {
        const data = await swipeCardMutation.mutateAsync({
          staffId: activeStaffId,
          direction,
          pinHash: user.pin_hash || "",
        });

        if (data.status === "collected" || data.status === "skipped" || data.status === "mission_cleared") {
          queryClient.invalidateQueries({ queryKey: ["vibe_deck"] });
          queryClient.invalidateQueries({ queryKey: ["collected_cards"] });
          queryClient.invalidateQueries({ queryKey: ["active_missions"] });
          queryClient.invalidateQueries({ queryKey: vibeQueryKeys.status(user.student_id) });
          queryClient.invalidateQueries({ queryKey: vibeQueryKeys.collected(user.student_id) });
          queryClient.invalidateQueries({ queryKey: vibeQueryKeys.deck(user.student_id) });
        }

        if (data.status === "collected") {
          toaster.create({ title: "Correct Swipe!", description: `Successfully collected P'${data.collected_staff_name || "Staff"}!`, type: "success" });
        } else if (data.status === "skipped") {
          toaster.create({ title: "Correct Skip!", description: "Nice! That person doesn't match the active quest.", type: "success" });
        } else if (data.status === "mission_cleared") {
          toaster.create({ title: "Quest Completed!", description: `Amazing! You successfully collected enough staff members!`, type: "success" });
          setClearedMissionTarget(currentMission?.target_role || "");
          setCelebrationOpen(true);
          setDeck([]); // resets deck to reshuffle
        } else if (data.status === "locked") {
          toaster.create({ title: "Lockout Penalty!", description: `Too many incorrect swipes. Cooldown active for ${data.cooldown_minutes} min.`, type: "error" });
        } else if (data.status === "trap_locked") {
          toaster.create({ title: "Trap Lockout!", description: `You fell for a Memory Trap! Cooldown active for ${data.cooldown_minutes} min.`, type: "error" });
        } else if (data.status === "strike") {
          toaster.create({ title: "Incorrect Swipe!", description: `Mistake recorded. (Mistakes: ${data.strike_count}/${data.max_strikes || 5})`, type: "error" });
        } else if (data.status === "trap_strike") {
          toaster.create({ title: "Memory Trap!", description: `You swiped right on someone you already collected! DOUBLE STRIKE! (Mistakes: ${data.strike_count}/${data.max_strikes || 5})`, type: "error" });
        }
      } catch (err) {
        console.error("Secure swipe validation failed:", err);
        toaster.create({ title: "Connection error", description: "Could not validate swipe. Please try again.", type: "error" });
      }

      setDeck((currentDeck) => {
        const nextDeck = currentDeck.filter((item) => item.id !== activeStaffId);
        if (nextDeck.length === 0) {
          setCurrentIndex(0);
          return [];
        }
        return nextDeck;
      });
      x.stop();
      x.set(0);
    },
    [deck, currentIndex, user, currentMission, x, swipeCardMutation, queryClient]
  );

  const handleSwipeAction = useCallback(
    async (direction: "left" | "right") => {
      if (isSwipingRef.current) return;
      isSwipingRef.current = true;
      const targetX = direction === "right" ? 500 : -500;
      await animate(x, targetX, { duration: 0.25, ease: "easeOut" });
      await performSwipeSecure(direction);
      isSwipingRef.current = false;
    },
    [x, performSwipeSecure]
  );

  const formatTime = (ms: number) => {
    const totalSecs = Math.ceil(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const currentProfile = currentIndex < deck.length ? deck[currentIndex] : null;
  const nextProfile = currentIndex + 1 < deck.length ? deck[currentIndex + 1] : null;

  // Collection Book Filtering
  const filteredStaff = useMemo(() => allStaff.filter(
    (s) =>
      (s.nickname || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.faculty || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.major || "").toLowerCase().includes(searchQuery.toLowerCase())
  ), [allStaff, searchQuery]);

  const groupedStaffData = useMemo(() => {
    const grouped: { [key: string]: DBStaff[] } = {};
    filteredStaff.forEach((s) => {
      const pos = s.house_position || "General";
      if (!grouped[pos]) {
        grouped[pos] = [];
      }
      grouped[pos].push(s);
    });
    return {
      grouped,
      sortedKeys: Object.keys(grouped).sort((a, b) => a.localeCompare(b)),
    };
  }, [filteredStaff]);

  if (authLoading) {
    return (
      <Flex minH="80vh" align="center" justify="center">
        <Spinner size="xl" color="accent.solid" />
      </Flex>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Branch UI for Staff Dashboard vs Student Game
  if (user.role !== "student") {
    return (
      <Box minH="90vh" py={6} px={4}>
        <StaffVibeDashboard />
      </Box>
    );
  }

  if (loading) {
    return (
      <Flex minH="80vh" align="center" justify="center">
        <Spinner size="xl" color="accent.solid" />
      </Flex>
    );
  }

  if (!vibecheckEnabled) {
    return <Navigate to="/" replace />;
  }

  return (
    <Box position="relative" minH="90vh" py={6} px={4} maxW="md" mx="auto">
      {/* 1. Header & Quick Collection Counter */}
      <Flex justify="space-between" align="center" mb={4}>
        <VStack align="start" gap={0}>
          <Heading as="h1" fontSize="xl" color="accent.solid" fontWeight="700">
            Vibe Check
          </Heading>
          <Text fontSize="2xs" color="fg.muted">
            Swipe right to collect Baan 7 staff!
          </Text>
        </VStack>
        <Button
          size="xs"
          variant="outline"
          borderColor="border.subtle"
          borderRadius="full"
          color="accent.solid"
          px={3}
          onClick={() => setIsStickerOpen(true)}
          _hover={{ bg: "bg.hero" }}
          cursor="pointer"
          aria-label="Open Collection Book"
          title="Open Collection Book"
        >
          <Box
            as="span"
            className="material-symbols-outlined"
            fontSize="14px"
            mr={1}
            aria-hidden="true"
          >
            auto_stories
          </Box>
          My Sticker Book
        </Button>
      </Flex>

      {/* Responsive Swiper Container Constraints */}
      <Box maxW={{ base: "100%", md: "420px" }} w="100%" mx="auto">
        {/* 2. Quest / Target Banner */}
        {currentMission ? (
        <Flex
          bg="bg.hero"
          border="1px solid"
          borderColor="border.subtle"
          p={3.5}
          borderRadius="2xl"
          align="center"
          justify="space-between"
          mb={6}
          boxShadow="sm"
        >
          <VStack align="start" gap={0.5}>
            <Text
              fontSize="2xs"
              color="accent.solid"
              fontWeight="700"
              textTransform="uppercase"
              letterSpacing="0.04em"
            >
              Active Mission: Quest {currentMission?.sequence_order}
            </Text>
            <Heading as="h2" fontSize="sm" color="fg.default" fontWeight="700">
              Collect {adjustedRequiredCount} {currentMission?.target_role}{" "}
              Staff
            </Heading>
          </VStack>
          <Flex direction="column" align="flex-end" gap={0.5}>
            <Text fontSize="2xs" color="fg.muted" fontWeight="600">
              STAMPS
            </Text>
            <Badge
              colorPalette="orange"
              variant="solid"
              borderRadius="full"
              px={2.5}
              py={0.5}
            >
              {collectedCountForMission} / {adjustedRequiredCount}
            </Badge>
          </Flex>
        </Flex>
      ) : (
        <Box
          bg="green.50"
          border="1px solid"
          borderColor="green.200"
          p={3.5}
          borderRadius="2xl"
          mb={6}
          textAlign="center"
        >
          <Text fontSize="xs" color="green.700" fontWeight="600" style={{ fontFamily: "Georgia, serif" }}>
            All missions completed! Wait for further instructions from staff.
          </Text>
        </Box>
      )}

      {/* 3. Swipeable Card Area */}
      <Flex
        position="relative"
        h={{ base: "420px", md: "500px" }}
        w="100%"
        justify="center"
        align="center"
        overflow="hidden"
        borderRadius="3xl"
        bg="bg.muted"
        border="1px solid"
        borderColor="border.subtle"
        mb={4}
      >
        {currentMission && currentProfile && nextProfile && !lockoutUntil && (
          <Box
            position="absolute"
            w="90%"
            h="90%"
            zIndex={5}
            transform="scale(0.96) translateY(10px)"
            opacity={0.6}
            pointerEvents="none"
          >
            <ProfileCardView profile={nextProfile} />
          </Box>
        )}
        <AnimatePresence mode="popLayout">
          {!currentMission ? (
            <motion.div
              key="all-completed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                padding: "24px",
                width: "100%",
              }}
            >
              <Box
                className="material-symbols-outlined"
                fontSize="4xl"
                color="accent.solid"
                mb={2}
                aria-hidden="true"
              >
                emoji_events
              </Box>
              <Heading as="h3" fontSize="sm" color="fg.default" fontWeight="800" mb={1} fontFamily="'Outfit', sans-serif">
                All missions completed!
              </Heading>
              <Text fontSize="xs" color="fg.muted" maxW="220px" fontStyle="italic" style={{ fontFamily: "Georgia, serif" }}>
                All missions completed! Wait for further instructions from staff.
              </Text>
            </motion.div>
          ) : deck.length === 0 ? (
            <motion.div
              key="no-cards"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                padding: "24px",
                width: "100%",
              }}
            >
              <Box
                className="material-symbols-outlined"
                fontSize="4xl"
                color="gray.400"
                mb={2}
                aria-hidden="true"
              >
                person_search
              </Box>
              <Heading as="h3" fontSize="sm" color="fg.default" fontWeight="700" mb={1}>
                Searching...
              </Heading>
              <Text fontSize="xs" color="fg.muted" maxW="200px">
                Looking for more staff in the area. Check back soon!
              </Text>
            </motion.div>
          ) : lockoutUntil ? (
            <motion.div
              key="lockout"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                padding: "24px",
                width: "100%",
              }}
            >
              <Box
                className="material-symbols-outlined"
                fontSize="4xl"
                color="red.500"
                mb={2}
                animation="bounce 1s infinite"
                aria-hidden="true"
              >
                lock_clock
              </Box>
              <Heading as="h3" fontSize="sm" color="red.700" fontWeight="700" mb={1}>
                Quest Locked
              </Heading>
              <Text fontSize="2xs" color="fg.muted" maxW="200px" mb={3}>
                You reached the strike limit. Cooldown system activated to prevent spoofing.
              </Text>
              <Badge
                colorPalette="red"
                variant="solid"
                fontSize="md"
                px={3}
                py={1}
                borderRadius="full"
              >
                {formatTime(lockoutTimeLeft)}
              </Badge>
            </motion.div>
          ) : currentProfile ? (
            <motion.div
              key={currentProfile?.id}
              style={{
                position: "absolute",
                width: "90%",
                height: "90%",
                x,
                rotate,
                cursor: "grab",
                touchAction: "none",
                zIndex: 10,
              }}
              drag={true}
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              onDragEnd={async (_, info) => {
                if (isSwipingRef.current) return;
                const swipeThreshold = 80;
                if (info.offset.x > swipeThreshold) {
                  await handleSwipeAction("right");
                } else if (info.offset.x < -swipeThreshold) {
                  await handleSwipeAction("left");
                } else {
                  animate(x, 0, { type: "spring", stiffness: 200, damping: 20 });
                }
              }}
              whileDrag={{ scale: 1.02 }}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{
                opacity: 0,
                scale: 0.9,
                transition: { duration: 0.2 },
              }}
            >
              {/* Overlay labels */}
              <motion.div
                style={{
                  position: "absolute",
                  top: 20,
                  right: 20,
                  opacity: collectOpacity,
                  zIndex: 20,
                  rotate: 15,
                }}
              >
                <Badge
                  colorPalette="green"
                  variant="solid"
                  fontSize="md"
                  borderRadius="lg"
                  px={3}
                  py={1}
                >
                  COLLECT
                </Badge>
              </motion.div>

              <motion.div
                style={{
                  position: "absolute",
                  top: 20,
                  left: 20,
                  opacity: skipOpacity,
                  zIndex: 20,
                  rotate: -15,
                }}
              >
                <Badge
                  colorPalette="red"
                  variant="solid"
                  fontSize="md"
                  borderRadius="lg"
                  px={3}
                  py={1}
                >
                  SKIP
                </Badge>
              </motion.div>

              {/* Card Container */}
              <ProfileCardView profile={currentProfile} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </Flex>

      {/* 4. Action Buttons overlay */}
      {currentMission && currentProfile && !lockoutUntil && (
        <HStack justify="center" gap={8} mt={6}>
          <Button
            onClick={() => handleSwipeAction("left")}
            bg="white"
            color="red.500"
            border="1.5px solid"
            borderColor="red.100"
            h="56px"
            w="56px"
            borderRadius="full"
            boxShadow="var(--shadow-card)"
            _hover={{ scale: 1.05, bg: "red.50" }}
            cursor="pointer"
            aria-label="Skip / Swipe Left"
            title="Skip / Swipe Left"
          >
            <Box
              as="span"
              className="material-symbols-outlined"
              fontSize="24px"
              aria-hidden="true"
            >
              close
            </Box>
          </Button>

          <Button
            onClick={() => handleSwipeAction("right")}
            bg="accent.solid"
            color="white"
            h="64px"
            w="64px"
            borderRadius="full"
            boxShadow="var(--shadow-card)"
            _hover={{ scale: 1.05, bg: "chocolate.600" }}
            cursor="pointer"
            aria-label="Collect / Swipe Right"
            title="Collect / Swipe Right"
          >
            <Box
              as="span"
              className="material-symbols-outlined"
              fontSize="28px"
              aria-hidden="true"
            >
              favorite
            </Box>
          </Button>
        </HStack>
      )}

      {/* 5. Warning / Warning Strikes Indicator */}
      {!lockoutUntil && currentMission && (
        <Flex justify="center" mt={6}>
          <HStack gap={1.5} align="center">
            <Text fontSize="2xs" color="fg.muted" fontWeight="600">
              STRIKE WARNINGS:
            </Text>
            {Array.from({ length: maxStrikesConfig }).map((_, idx) => {
              const active = idx < strikeCount;
              return (
                <Box
                  key={idx}
                  w="10px"
                  h="10px"
                  borderRadius="full"
                  bg={active ? "red.500" : "border.subtle"}
                  border="1px solid"
                  borderColor={active ? "red.600" : "transparent"}
                  transition="background-color 0.2s"
                />
              );
            })}
          </HStack>
        </Flex>
      )}
      </Box>

      {/* 6. Sticker Book Drawer Overlay */}
      <StickerBookModal
        isOpen={isStickerOpen}
        onClose={() => setIsStickerOpen(false)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        groupedStaffData={groupedStaffData}
        collectedIds={collectedIds}
        setSelectedStaffDetail={setSelectedStaffDetail}
      />

      {/* 6. Selected Staff Profile Details Modal Dialog */}
      {selectedStaffDetail && (
        <Dialog.Root
          open={!!selectedStaffDetail}
          onOpenChange={() => setSelectedStaffDetail(null)}
          placement={{ base: "bottom", md: "center" }}
        >
          <Portal>
            <Dialog.Backdrop bg="color-mix(in srgb, var(--c-ink) 70%, transparent)" backdropFilter="blur(4px)" />
            <Dialog.Positioner zIndex={2200} px={4}>
              <Dialog.Content
                bg="var(--c-ivory)"
                border={{ base: "none", md: "2px solid var(--c-chocolate)" }}
                color="var(--c-ink)"
                borderRadius={{ base: "t-3xl", md: "2xl" }}
                width={{ base: "100%", md: "460px" }}
                p={6}
                boxShadow={{ base: "none", md: "var(--shadow-card)" }}
                position="relative"
              >
                <Dialog.Header p={0} mb={4}>
                  <Dialog.Title fontSize="sm" color="var(--c-chocolate)" fontWeight="800" textTransform="uppercase">
                    Sticker Collected Profile
                  </Dialog.Title>
                </Dialog.Header>

                <Dialog.Body p={0}>
                  <VStack align="stretch" gap={5}>
                    <Flex align="center" gap={4}>
                      <UserAvatar
                        src={selectedStaffDetail?.profile_pic_url}
                        name={selectedStaffDetail?.nickname || "Staff"}
                        avatarColor={selectedStaffDetail?.avatar_color || "accent.solid"}
                        size="56px"
                        fontSize="md"
                        border="2px solid var(--c-chocolate)"
                      />
                      <VStack align="start" gap={0.5}>
                        <Heading as="h3" fontSize="sm" fontWeight="800" color="var(--c-ink)">
                          {selectedStaffDetail?.nickname}
                        </Heading>
                        <Text fontSize="2xs" color="fg.muted">
                          {selectedStaffDetail?.major} ({selectedStaffDetail?.faculty})
                        </Text>
                        {selectedStaffDetail?.ig && (
                          <Text fontSize="2xs" color="var(--c-lagoon)" fontWeight="600">
                            IG: @{selectedStaffDetail?.ig}
                          </Text>
                        )}
                      </VStack>
                    </Flex>

                    <Box>
                      <Text fontSize="2xs" fontWeight="700" color="var(--c-muted)" mb={1.5} textTransform="uppercase">
                        Biography
                      </Text>
                      <Text fontSize="xs" bg="white" p={3} borderRadius="lg" border="1px solid" borderColor="border.subtle" color="fg.muted">
                        {selectedStaffDetail?.bio || "No bio entered."}
                      </Text>
                    </Box>

                    {selectedStaffDetail?.images &&
                      selectedStaffDetail.images.length > 0 && (
                        <VStack align="stretch" gap={2.5}>
                          <Text fontSize="2xs" fontWeight="700" color="var(--c-muted)" textTransform="uppercase">
                            Activity Photos
                          </Text>
                          <HStack gap={2} overflowX="auto" pb={1}>
                            {selectedStaffDetail?.images?.map(
                              (imgUrl: string, idx: number) => (
                                <Image
                                  key={idx}
                                  src={imgUrl}
                                  alt={`Orientation activity photo ${idx + 1} uploaded by ${selectedStaffDetail?.nickname || "Staff"}`}
                                  w="90px"
                                  h="120px"
                                  objectFit="cover"
                                  borderRadius="lg"
                                  border="1px solid"
                                  borderColor="border.subtle"
                                  flexShrink={0}
                                  loading="lazy"
                                />
                              )
                            )}
                          </HStack>
                        </VStack>
                      )}
                  </VStack>
                </Dialog.Body>

                <Dialog.CloseTrigger position="absolute" top={4} right={4} asChild>
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
                    onClick={() => setSelectedStaffDetail(null)}
                  >
                    <Box
                      as="span"
                      className="material-symbols-outlined"
                      fontSize="20px"
                      aria-hidden="true"
                    >
                      close
                    </Box>
                  </Button>
                </Dialog.CloseTrigger>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        </Dialog.Root>
      )}

      {/* 7. Mission Cleared Full Screen Celebration Modal */}
      {celebrationOpen && (
        <Portal>
          <Box
            position="fixed"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="color-mix(in srgb, var(--c-ink) 95%, transparent)"
            zIndex="9999"
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            p={6}
            textAlign="center"
          >
            <VStack gap={5} maxW="320px">
              <Box
                color="accent.solid"
              >
                <Box
                  as="span"
                  className="material-symbols-outlined"
                  fontSize="48px"
                  aria-hidden="true"
                >
                  military_tech
                </Box>
              </Box>
              <Heading as="h2" fontSize="2xl" color="white" fontWeight="800">
                Quest Complete!
              </Heading>
              <Text fontSize="xs" color="whiteAlpha.800" lineHeight="1.6">
                Excellent! You successfully collected enough staff matching the target mission. You have unlocked the next mission.
              </Text>
              <Box
                border="1.5px dashed"
                borderColor="accent.solid"
                borderRadius="xl"
                px={4}
                py={2.5}
                bg="whiteAlpha.100"
              >
                <Text
                  fontSize="2xs"
                  color="accent.solid"
                  textTransform="uppercase"
                  letterSpacing="0.08em"
                >
                  Stamps Earned
                </Text>
                <Text fontSize="sm" fontWeight="bold" color="white">
                  {clearedMissionTarget} Quest Badge
                </Text>
              </Box>
              <Button
                size="md"
                bg="accent.solid"
                color="white"
                borderRadius="xl"
                h="48px"
                w="100%"
                onClick={() => setCelebrationOpen(false)}
                _hover={{ bg: "chocolate.600" }}
                cursor="pointer"
              >
                Start Next Quest
              </Button>
            </VStack>
          </Box>
        </Portal>
      )}
    </Box>
  );
}
