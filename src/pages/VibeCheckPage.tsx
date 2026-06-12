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
} from "@chakra-ui/react";
import { useState, useCallback, useEffect } from "react";
import { Navigate } from "react-router-dom";

const getInitials = (name: string) => {
  return name.trim().slice(0, 2).toUpperCase();
};
import {
  motion,
  useMotionValue,
  useTransform,
  AnimatePresence,
  useReducedMotion,
} from "framer-motion";
import { useUser } from "../context/UserContext";
import { supabase } from "../lib/supabase";
import { toaster } from "../components/ui/toaster";

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

interface DBStaff {
  student_id: string;
  nickname: string | null;
  faculty: string | null;
  major: string | null;
  avatar_color: string;
  profile_pic_url: string | null;
  bio: string | null;
  ig: string | null;
  images: string[];
  tags: string[];
  role: string;
}

interface VibeMission {
  id: number;
  sequence_order: number;
  target_role: string;
  required_count: number;
}

export function VibeCheckPage() {
  const { user, loading: authLoading } = useUser();
  const shouldReduceMotion = useReducedMotion() ?? false;

  // Deck States
  const [deck, setDeck] = useState<StaffProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [animatingDir, setAnimatingDir] = useState<"left" | "right" | null>(null);

  // Game/Mission States
  const [currentMission, setCurrentMission] = useState<VibeMission | null>(null);
  const [collectedIds, setCollectedIds] = useState<Set<string>>(new Set());
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState(0);
  const [collectedCountForMission, setCollectedCountForMission] = useState(0);

  // Sticker Book Drawer States
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [allStaff, setAllStaff] = useState<DBStaff[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStaffDetail, setSelectedStaffDetail] = useState<DBStaff | null>(null);

  // Mission Clear Celebration State
  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const [clearedMissionTarget, setClearedMissionTarget] = useState("");

  // Swipe Gesture Motion Values
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const collectOpacity = useTransform(x, [0, 80], [0, 1]);
  const skipOpacity = useTransform(x, [-80, 0], [1, 0]);

  // Lockout Countdown Timer Effect
  useEffect(() => {
    if (!lockoutUntil) return;
    const interval = setInterval(() => {
      const diff = lockoutUntil - Date.now();
      if (diff <= 0) {
        setLockoutUntil(null);
        setLockoutTimeLeft(0);
        clearInterval(interval);
      } else {
        setLockoutTimeLeft(diff);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  // Fetch Game Setup and User status
  const fetchGameData = useCallback(async () => {
    if (!user) return;
    try {
      // 1. Fetch user game status
      const { data: statusData, error: statusErr } = await supabase
        .from("user_vibe_status")
        .select("*, vibe_missions(*)")
        .eq("student_id", user.student_id)
        .maybeSingle();

      if (statusErr) throw statusErr;

      let activeMission: VibeMission | null = null;

      if (statusData) {
        activeMission = statusData.vibe_missions as VibeMission;
        if (statusData.locked_until) {
          const lockedTime = new Date(statusData.locked_until).getTime();
          if (lockedTime > Date.now()) {
            setLockoutUntil(lockedTime);
          }
        }
      }

      // If no status or mission is set, resolve first mission
      if (!activeMission) {
        const { data: firstMission } = await supabase
          .from("vibe_missions")
          .select("*")
          .order("sequence_order", { ascending: true })
          .limit(1)
          .single();

        if (firstMission) {
          activeMission = firstMission as VibeMission;
          // Create user vibe status row
          await supabase.from("user_vibe_status").upsert({
            student_id: user.student_id,
            current_mission_id: firstMission.id,
          });
        }
      }
      setCurrentMission(activeMission);

      // 2. Fetch collected cards
      const { data: collectedData } = await supabase
        .from("collected_cards")
        .select("staff_id")
        .eq("student_id", user.student_id);

      const collectedSet = new Set((collectedData ?? []).map((c) => c.staff_id));
      setCollectedIds(collectedSet);

      // 3. Fetch all whitelisted staff (for the Collection Book)
      const { data: staffData } = await supabase
        .from("users")
        .select("student_id, nickname, faculty, major, avatar_color, profile_pic_url, bio, ig, images, tags, role")
        .in("role", ["staff", "media_admin", "moderator"]);

      if (staffData) {
        const sortedStaff = (staffData as DBStaff[]).sort((a, b) =>
          (a.nickname || "").localeCompare(b.nickname || "")
        );
        setAllStaff(sortedStaff);

        // Filter uncollected staff for the swipe deck
        const uncollected = (staffData as DBStaff[]).filter(
          (s) => !collectedSet.has(s.student_id)
        );

        // Shuffle deck locally to randomize
        const shuffled = [...uncollected].sort(() => Math.random() - 0.5);

        // SECURE DECK PAYLOAD: Omit 'role' and 'major' fields to block client-side network spoofing!
        const secureDeck: StaffProfile[] = shuffled.map((s) => ({
          id: s.student_id,
          name: s.nickname || "Staff Member",
          avatar_color: s.avatar_color || "#496268",
          profile_pic_url: s.profile_pic_url,
          bio: s.bio || "Orientation staff ready to answer all your questions!",
          ig: s.ig,
          images:
            s.images && s.images.length > 0
              ? s.images
              : [s.profile_pic_url || "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500&h=700&fit=crop"],
          tags: s.tags && s.tags.length > 0 ? s.tags : [s.faculty || "Baan 7", "Staff"],
        }));

        setDeck(secureDeck);
        setCurrentIndex(0);

        // Calculate progress for active mission
        if (activeMission) {
          const reqRole = activeMission.target_role;
          const collectedCount = (staffData as DBStaff[]).filter(
            (s) => collectedSet.has(s.student_id) && (s.major === reqRole || s.role === reqRole)
          ).length;
          setCollectedCountForMission(collectedCount);
        }
      }
    } catch (err) {
      console.error("Error setting up Vibe Check game data:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    const initGame = async () => {
      await Promise.resolve();
      if (active) {
        fetchGameData();
      }
    };
    initGame();
    return () => {
      active = false;
    };
  }, [fetchGameData]);

  // Safe Swipe Handler wired into Secure DB RPC
  const performSwipeSecure = useCallback(
    async (direction: "left" | "right") => {
      const profile = deck[currentIndex];
      if (!profile || !user) return;

      setAnimatingDir(direction);
      const targetX = direction === "right" ? 300 : -300;

      if (shouldReduceMotion) {
        x.set(targetX);
      }

      try {
        // Trigger secure server-side RPC validation
        const { data, error } = await supabase.rpc("swipe_card_secure", {
          p_student_id: user.student_id,
          p_staff_id: profile.id,
          p_direction: direction,
          p_pin_hash: user.pin_hash,
        });

        if (error) throw error;

        // Process response payload securely
        if (data.status === "collected") {
          toaster.create({
            title: "Card Unlocked! 🧡",
            description: `Successfully collected ${data.collected_staff_name}!`,
            type: "success",
          });
          setCollectedIds((prev) => {
            const next = new Set(prev);
            next.add(profile.id);
            return next;
          });
          setCollectedCountForMission(data.current_count);
        } else if (data.status === "mission_cleared") {
          setClearedMissionTarget(currentMission?.target_role || "");
          setCelebrationOpen(true);
          // Triggers full layout refresh
          await fetchGameData();
        } else if (data.status === "locked") {
          const lockedTime = new Date(data.locked_until).getTime();
          setLockoutUntil(lockedTime);
          toaster.create({
            title: "Lockout Penalty! 🔒",
            description: `Too many incorrect swipes. Cooldown active for ${data.cooldown_minutes} min.`,
            type: "error",
          });
        } else if (data.status === "strike") {
          // Hidden fail: proceeds silently to avoid cheat-spoiling.
          console.log(`Hidden Swipe Strike! (Strike count: ${data.strike_count}/${data.max_strikes})`);
        }

        setTimeout(
          () => {
            setCurrentIndex((prev) => prev + 1);
            x.set(0);
            setAnimatingDir(null);
          },
          shouldReduceMotion ? 100 : 250
        );
      } catch (err) {
        console.error("Secure swipe validation failed:", err);
        toaster.create({
          title: "Connection error",
          description: "Could not validate swipe swipe. Please try again.",
          type: "error",
        });
        x.set(0);
        setAnimatingDir(null);
      }
    },
    [deck, currentIndex, user, currentMission, shouldReduceMotion, x, fetchGameData]
  );

  const formatTime = (ms: number) => {
    const totalSecs = Math.ceil(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const currentProfile = currentIndex < deck.length ? deck[currentIndex] : null;

  // Collection Book Filtering
  const filteredStaff = allStaff.filter(
    (s) =>
      (s.nickname || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.faculty || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.major || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  if (loading) {
    return (
      <Flex minH="80vh" align="center" justify="center">
        <Spinner size="xl" color="accent.solid" />
      </Flex>
    );
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
          onClick={() => setIsBookOpen(true)}
          _hover={{ bg: "bg.hero" }}
          cursor="pointer"
          aria-label="Open Collection Book"
          title="Open Collection Book"
        >
          📖 Collection ({collectedIds.size}/{allStaff.length})
        </Button>
      </Flex>

      {/* 2. Active Mission Banner */}
      {currentMission ? (
        <Box
          bg="rgba(73, 98, 104, 0.08)"
          border="1.5px dashed"
          borderColor="accent.solid"
          borderRadius="2xl"
          p={4}
          mb={5}
          textAlign="center"
          boxShadow="inner"
        >
          <Text
            fontSize="2xs"
            fontWeight="700"
            color="accent.solid"
            textTransform="uppercase"
            letterSpacing="0.08em"
            mb={1}
          >
            🎯 Active Quest
          </Text>
          <Heading as="h2" fontSize="sm" color="fg.default" fontWeight="700" mb={1}>
            Collect {currentMission.required_count} {currentMission.target_role} Staff Members
          </Heading>
          <Text fontSize="2xs" color="fg.muted" fontWeight="600">
            Progress: {collectedCountForMission} / {currentMission.required_count}
          </Text>
        </Box>
      ) : (
        <Box
          bg="rgba(124, 86, 63, 0.08)"
          border="1.5px dashed"
          borderColor="chocolate.500"
          borderRadius="2xl"
          p={4}
          mb={5}
          textAlign="center"
        >
          <Text fontSize="sm" color="chocolate.800" fontWeight="bold">
            🏆 You collected all cards! Check back later.
          </Text>
        </Box>
      )}

      {/* 3. Swipe Deck viewport */}
      <Flex
        position="relative"
        justify="center"
        align="center"
        h="440px"
        w="100%"
        borderRadius="2xl"
        overflow="hidden"
        bg="bg.surface"
        border="1px solid"
        borderColor="border.subtle"
        boxShadow="var(--shadow-card)"
      >
        <AnimatePresence mode="wait">
          {currentProfile && !lockoutUntil ? (
            <motion.div
              key={currentProfile.id}
              style={{
                x,
                rotate,
                touchAction: "none",
                width: "100%",
                height: "100%",
                position: "absolute",
                cursor: animatingDir ? "auto" : "grab",
                userSelect: "none",
                WebkitUserSelect: "none",
              }}
              drag={animatingDir ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => {
                if (animatingDir) return;
                const threshold = 120;
                if (info.offset.x > threshold) {
                  performSwipeSecure("right");
                } else if (info.offset.x < -threshold) {
                  performSwipeSecure("left");
                } else {
                  x.set(0);
                }
              }}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ x: 0, opacity: 1, scale: 1, rotate: 0 }}
              exit={
                animatingDir === "left"
                  ? { x: -300, opacity: 0, rotate: -15 }
                  : animatingDir === "right"
                    ? { x: 300, opacity: 0, rotate: 15 }
                    : { opacity: 0 }
              }
              transition={
                shouldReduceMotion
                  ? { duration: 0.15 }
                  : { type: "spring", stiffness: 300, damping: 25 }
              }
            >
              {/* Card visual elements */}
              <Box position="relative" w="100%" h="100%" userSelect="none" pointerEvents="none">
                <Image
                  src={currentProfile.images[0]}
                  alt={currentProfile.name}
                  w="100%"
                  h="100%"
                  objectFit="cover"
                  draggable={false}
                />

                {/* Translucent Swipe Badges */}
                <motion.div
                  style={{
                    opacity: collectOpacity,
                    position: "absolute",
                    top: "20px",
                    right: "20px",
                    zIndex: 10,
                  }}
                >
                  <Box
                    bg="rgba(73, 98, 104, 0.9)"
                    color="white"
                    px={4}
                    py={1.5}
                    borderRadius="full"
                    border="1.5px solid white"
                    fontSize="sm"
                    fontWeight="700"
                    textTransform="uppercase"
                    letterSpacing="0.05em"
                  >
                    COLLECT
                  </Box>
                </motion.div>

                <motion.div
                  style={{
                    opacity: skipOpacity,
                    position: "absolute",
                    top: "20px",
                    left: "20px",
                    zIndex: 10,
                  }}
                >
                  <Box
                    bg="rgba(192, 57, 43, 0.9)"
                    color="white"
                    px={4}
                    py={1.5}
                    borderRadius="full"
                    border="1.5px solid white"
                    fontSize="sm"
                    fontWeight="700"
                    textTransform="uppercase"
                    letterSpacing="0.05em"
                  >
                    SKIP
                  </Box>
                </motion.div>

                {/* Profile Meta gradient strip */}
                <Box
                  position="absolute"
                  bottom={0}
                  left={0}
                  right={0}
                  bg="gradient.card"
                  p={5}
                  color="white"
                >
                  <VStack align="start" gap={1}>
                    <Heading as="h3" fontSize="lg" fontWeight="700" textShadow="sm">
                      {currentProfile.name}
                    </Heading>
                    <Text fontSize="xs" opacity={0.9} lineClamp={2}>
                      {currentProfile.bio}
                    </Text>
                    <HStack gap={2} mt={1} flexWrap="wrap">
                      {currentProfile.tags.map((t) => (
                        <Box
                          key={t}
                          bg="whiteAlpha.300"
                          px={2.5}
                          py={0.5}
                          borderRadius="full"
                          fontSize="3xs"
                          fontWeight="700"
                          textTransform="uppercase"
                          letterSpacing="0.05em"
                        >
                          {t}
                        </Box>
                      ))}
                    </HStack>
                  </VStack>
                </Box>
              </Box>
            </motion.div>
          ) : lockoutUntil ? (
            /* Lockout timer overlay overlay */
            <Box
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              bg="rgba(20, 16, 15, 0.85)"
              backdropFilter="blur(10px)"
              zIndex={20}
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              p={6}
              textAlign="center"
            >
              <Box className="material-symbols-outlined" fontSize="4xl" color="var(--c-chocolate)" mb={3}>
                lock
              </Box>
              <Heading as="h3" fontSize="md" color="white" fontWeight="700" mb={1}>
                Vibe Lock active!
              </Heading>
              <Text fontSize="xs" color="whiteAlpha.700" maxW="240px" mb={4}>
                Too many incorrect collections. Deck locked for:
              </Text>
              <Text
                fontSize="3xl"
                fontWeight="800"
                color="accent.solid"
                bg="bg.surface"
                px={6}
                py={2.5}
                borderRadius="xl"
                boxShadow="var(--shadow-card)"
              >
                {formatTime(lockoutTimeLeft)}
              </Text>
            </Box>
          ) : (
            /* Empty Deck state */
            <Flex direction="column" align="center" justify="center" p={6} textAlign="center">
              <Box className="material-symbols-outlined" fontSize="4xl" color="accent.solid" mb={2}>
                psychology_alt
              </Box>
              <Heading as="h3" fontSize="sm" color="fg.default" fontWeight="700" mb={1}>
                Out of cards!
              </Heading>
              <Text fontSize="xs" color="fg.muted" maxW="220px" mb={4}>
                You swiped through all available staff deck cards. Wait for more whitelist entries!
              </Text>
              <Button
                size="sm"
                bg="accent.solid"
                color="white"
                borderRadius="xl"
                onClick={fetchGameData}
                _hover={{ bg: "chocolate.600" }}
                cursor="pointer"
              >
                Refresh Deck
              </Button>
            </Flex>
          )}
        </AnimatePresence>
      </Flex>

      {/* 4. Action Buttons overlay */}
      {currentProfile && !lockoutUntil && (
        <HStack justify="center" gap={8} mt={6}>
          <Button
            onClick={() => performSwipeSecure("left")}
            bg="white"
            color="red.600"
            border="1px solid"
            borderColor="border.subtle"
            boxShadow="var(--shadow-card)"
            h="56px"
            w="56px"
            borderRadius="full"
            p={0}
            _hover={{ transform: "scale(1.1)", bg: "red.50" }}
            cursor="pointer"
            aria-label="Skip card"
            title="Skip card"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
              close
            </span>
          </Button>
          <Button
            onClick={() => performSwipeSecure("right")}
            bg="accent.solid"
            color="white"
            boxShadow="var(--shadow-card)"
            h="56px"
            w="56px"
            borderRadius="full"
            p={0}
            _hover={{ transform: "scale(1.1)", bg: "chocolate.600" }}
            cursor="pointer"
            aria-label="Collect card"
            title="Collect card"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "24px", fontVariationSettings: "'FILL' 1" }}>
              check
            </span>
          </Button>
        </HStack>
      )}

      {/* 5. Swipe Book Collection Slide-up Drawer */}
      {isBookOpen && (
        <Portal>
          <Box
            position="fixed"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="blackAlpha.700"
            backdropFilter="blur(4px)"
            zIndex="2000"
            onClick={() => setIsBookOpen(false)}
          />
          <Box
            position="fixed"
            bottom={0}
            left="50%"
            transform="translateX(-50%)"
            w="100%"
            maxW="md"
            h="80vh"
            bg="bg.surface"
            borderTopRadius="2xl"
            border="1px solid"
            borderColor="border.subtle"
            boxShadow="0 -10px 25px rgba(0,0,0,0.15)"
            zIndex="2001"
            display="flex"
            flexDirection="column"
            p={5}
            animation="slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards"
          >
            {/* Grab handle */}
            <Box
              w="40px"
              h="4px"
              bg="border.subtle"
              borderRadius="full"
              mx="auto"
              mb={4}
              onClick={() => setIsBookOpen(false)}
              cursor="pointer"
            />

            <Flex justify="space-between" align="center" mb={4}>
              <VStack align="start" gap={0}>
                <Heading as="h2" fontSize="md" color="accent.solid" fontWeight="700">
                  Sticker Collection Album
                </Heading>
                <Text fontSize="3xs" color="fg.muted">
                  Tap collected staff cards to view full bio details.
                </Text>
              </VStack>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setIsBookOpen(false)}
                cursor="pointer"
              >
                Close
              </Button>
            </Flex>

            {/* Filter Search Input */}
            <Input
              placeholder="Search whitelisted staff members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              mb={4}
              borderRadius="xl"
              border="1.5px solid var(--c-outline)"
              bg="bg.hero"
              h="40px"
              fontSize="xs"
              _focus={{ borderColor: "accent.solid" }}
              aria-label="Search staff members"
              title="Search staff members"
            />

            {/* Sticker grid view */}
            <Box flex={1} overflowY="auto" pb={4}>
              <Flex gap={3} flexWrap="wrap" justify="start">
                {filteredStaff.map((s) => {
                  const isCollected = collectedIds.has(s.student_id);
                  return (
                    <Box
                      key={s.student_id}
                      w="100px"
                      display="flex"
                      flexDirection="column"
                      alignItems="center"
                      onClick={() => {
                        if (isCollected) setSelectedStaffDetail(s);
                      }}
                      cursor={isCollected ? "pointer" : "default"}
                    >
                      <Box
                        position="relative"
                        w="80px"
                        h="80px"
                        borderRadius="full"
                        overflow="hidden"
                        border="2px solid"
                        borderColor={isCollected ? "accent.solid" : "border.subtle"}
                        bg={s.avatar_color}
                        mb={1.5}
                        style={{
                          filter: isCollected ? "none" : "grayscale(1) brightness(0.25)",
                        }}
                      >
                        {s.profile_pic_url ? (
                          <Image src={s.profile_pic_url} alt={s.nickname || "Staff"} w="100%" h="100%" objectFit="cover" />
                        ) : (
                          <Flex w="100%" h="100%" align="center" justify="center" color="white" fontWeight="700">
                            {getInitials(s.nickname || "?")}
                          </Flex>
                        )}
                        {!isCollected && (
                          <Flex
                            position="absolute"
                            top={0}
                            left={0}
                            right={0}
                            bottom={0}
                            align="center"
                            justify="center"
                            bg="blackAlpha.300"
                          >
                            <span className="material-symbols-outlined" style={{ color: "white", fontSize: "18px" }}>
                              lock
                            </span>
                          </Flex>
                        )}
                      </Box>
                      <Text
                        fontSize="2xs"
                        fontWeight="600"
                        color={isCollected ? "fg.default" : "fg.subtle"}
                        textAlign="center"
                        lineClamp={1}
                        w="100%"
                      >
                        {s.nickname || "Locked"}
                      </Text>
                      <Text fontSize="3xs" color="accent.solid" opacity={isCollected ? 1 : 0.5} lineClamp={1}>
                        {s.major || "Staff"}
                      </Text>
                    </Box>
                  );
                })}
              </Flex>
            </Box>
          </Box>
        </Portal>
      )}

      {/* 6. Collected Card Details Bottom Sheet */}
      {selectedStaffDetail && (
        <Portal>
          <Box
            position="fixed"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="blackAlpha.700"
            backdropFilter="blur(4px)"
            zIndex="2100"
            onClick={() => setSelectedStaffDetail(null)}
          />
          <Box
            position="fixed"
            bottom={0}
            left="50%"
            transform="translateX(-50%)"
            w="100%"
            maxW="md"
            bg="bg.surface"
            borderTopRadius="2xl"
            border="1px solid"
            borderColor="border.subtle"
            boxShadow="0 -10px 25px rgba(0,0,0,0.15)"
            zIndex="2101"
            p={5}
            animation="slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards"
          >
            <Flex justify="space-between" mb={4}>
              <Heading as="h3" fontSize="sm" color="accent.solid" fontWeight="700">
                Collector's Intel
              </Heading>
              <Button size="xs" variant="ghost" onClick={() => setSelectedStaffDetail(null)} cursor="pointer">
                Close
              </Button>
            </Flex>

            <VStack gap={4} align="stretch">
              <HStack gap={4}>
                <Image
                  src={selectedStaffDetail.profile_pic_url || "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=200&h=200&fit=crop"}
                  alt={selectedStaffDetail.nickname || "Staff"}
                  w="72px"
                  h="72px"
                  borderRadius="full"
                  objectFit="cover"
                  border="2px solid"
                  borderColor="accent.solid"
                />
                <VStack align="start" gap={0.5}>
                  <Heading as="h4" fontSize="md" color="fg.default" fontWeight="700">
                    {selectedStaffDetail.nickname}
                  </Heading>
                  <Text fontSize="2xs" color="accent.solid" fontWeight="700">
                    {selectedStaffDetail.major} ({selectedStaffDetail.faculty})
                  </Text>
                  {selectedStaffDetail.ig && (
                    <Text fontSize="2xs" color="var(--c-chocolate)" fontWeight="600">
                      IG: @{selectedStaffDetail.ig}
                    </Text>
                  )}
                </VStack>
              </HStack>

              <Box bg="bg.hero" p={3.5} borderRadius="xl" border="1px solid" borderColor="border.subtle">
                <Text fontSize="xs" fontWeight="700" color="accent.solid" mb={1} textTransform="uppercase" letterSpacing="0.05em">
                  Bio / คำโปรย
                </Text>
                <Text fontSize="xs" color="fg.default" lineHeight="1.6">
                  {selectedStaffDetail.bio || "No bio entered."}
                </Text>
              </Box>

              {selectedStaffDetail.images && selectedStaffDetail.images.length > 0 && (
                <VStack align="stretch" gap={1.5}>
                  <Text fontSize="2xs" fontWeight="700" color="accent.solid" textTransform="uppercase" letterSpacing="0.05em">
                    Staff Photo Pool
                  </Text>
                  <HStack gap={2} overflowX="auto" pb={1}>
                    {selectedStaffDetail.images.map((imgUrl: string, idx: number) => (
                      <Image
                        key={idx}
                        src={imgUrl}
                        alt={`Staff upload ${idx}`}
                        w="90px"
                        h="120px"
                        objectFit="cover"
                        borderRadius="lg"
                        border="1px solid"
                        borderColor="border.subtle"
                        flexShrink={0}
                      />
                    ))}
                  </HStack>
                </VStack>
              )}
            </VStack>
          </Box>
        </Portal>
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
            bg="rgba(20, 16, 15, 0.95)"
            zIndex="9999"
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            p={6}
            textAlign="center"
          >
            <VStack gap={5} maxW="320px">
              <Box fontSize="5xl" animation="scale-in 0.5s ease">
                🎉
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
                <Text fontSize="2xs" color="accent.solid" textTransform="uppercase" letterSpacing="0.08em">
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
