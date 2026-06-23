import {
  Box,
  Flex,
  Heading,
  HStack,
  Text,
  VStack,
  Button,
  Textarea,
  Spinner,
  Badge,
  Input,
  Image,
  Dialog,
  Skeleton,
  Switch,
} from "@chakra-ui/react";
import { useState, useEffect, useRef, memo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useUser, type User } from "../context/UserContext";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  useBoardRealtime,
  type DBPost,
  type BoardTab,
} from "../hooks/useBoardRealtime";
import { useLiveChat, type ChatMessage } from "../hooks/useLiveChat";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { supabase } from "../lib/supabase";
import { toaster } from "../components/ui/toaster";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { compressImage } from "../utils/image";

// ─── Static sidebar data ──────────────────────────────────────────────────────

const categories = [
  { label: "All", value: "all" },
  { label: "#Hype", value: "#Hype" },
  { label: "#Question", value: "#Question" },
  { label: "#Memory", value: "#Memory" },
  { label: "#Ween2026", value: "#Ween2026" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getRelativeTime = (isoString: string) => {
  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// ─── Live Presence Badge ──────────────────────────────────────────────────────

function LivePresenceBadge({ count }: { count: number }) {
  const shouldReduceMotion = useReducedMotion() ?? false;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{
        display: "inline-flex",
        width: "100%",
        justifyContent: "center",
      }}
    >
      <Flex
        align="center"
        gap={2}
        px={4}
        py={2}
        borderRadius="full"
        bg="accent.subtle"
        border="1px solid"
        borderColor="accent.muted"
        display="inline-flex"
        w="100%"
        justifyContent="center"
      >
        {/* Pulsing dot */}
        <Box position="relative" w={2} h={2}>
          <Box
            w={2}
            h={2}
            borderRadius="full"
            bg="accent.solid"
            position="absolute"
          />
          {!shouldReduceMotion && (
            <motion.div
              animate={{ scale: [1, 2], opacity: [0.6, 0] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: "var(--chakra-colors-accent-solid)",
              }}
            />
          )}
        </Box>
        <Text fontSize="xs" fontWeight="700" color="accent.solid">
          {count} people jamming on the board right now
        </Text>
      </Flex>
    </motion.div>
  );
}

// ─── Live Chat Bubble ─────────────────────────────────────────────────────────────

function formatChatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

const ROLE_BADGE_MAP: Record<
  string,
  {
    label: string;
    color: string;
    bg: string;
    borderColor: string;
    icon: string;
  }
> = {
  moderator: {
    label: "MOD",
    color: "red.600",
    bg: "red.50",
    borderColor: "red.200",
    icon: "gavel",
  },
  media_admin: {
    label: "MEDIA_ADMIN",
    color: "teal.600",
    bg: "teal.50",
    borderColor: "teal.200",
    icon: "photo_camera",
  },
  staff: {
    label: "STAFF",
    color: "orange.600",
    bg: "orange.50",
    borderColor: "orange.200",
    icon: "shield_person",
  },
};

const LiveChatBubble = memo(function LiveChatBubble({
  message,
  isStaff,
  isMe,
  onDelete,
  onInspectUser,
}: {
  message: ChatMessage;
  isStaff: boolean;
  isMe: boolean;
  onDelete: (id: string) => Promise<void>;
  onInspectUser: (userId: string) => void;
}) {
  const badge = ROLE_BADGE_MAP[message.sender_role];
  const isSenderStaff = message.sender_role !== "student";
  const prefix = isSenderStaff ? "P' " : "";

  return (
    <Box
      className="chat-message-enter"
      role="group"
      px={{ base: 3, md: 5 }}
      py={2}
      _hover={{ bg: "bg.hero" }}
      transition="background 0.15s"
      w="100%"
    >
      <Flex
        gap={3}
        align="start"
        flexDirection={isMe ? "row-reverse" : "row"}
        w="100%"
      >
        {/* Avatar */}
        <Box
          as="button"
          w={7}
          h={7}
          borderRadius="full"
          bg={message.sender_avatar_color}
          color="white"
          display="flex"
          alignItems="center"
          justifyContent="center"
          fontWeight="700"
          fontSize="2xs"
          flexShrink={0}
          mt="2px"
          cursor="pointer"
          onClick={() => onInspectUser(message.sender_id)}
          overflow="hidden"
        >
          {message.sender_profile_pic_url ? (
            <Image
              src={message.sender_profile_pic_url}
              alt={message.sender_nickname}
              w="100%"
              h="100%"
              objectFit="cover"
              loading="lazy"
            />
          ) : (
            getInitials(message.sender_nickname)
          )}
        </Box>

        {/* Content Wrapper */}
        <VStack align={isMe ? "end" : "start"} gap={1} flex={1} minW={0}>
          {/* Meta Info */}
          <Flex
            align="center"
            gap={1.5}
            flexWrap="wrap"
            flexDirection={isMe ? "row-reverse" : "row"}
          >
            <Text
              as="button"
              fontSize={{ base: "xs", md: "sm" }}
              fontWeight="700"
              color={
                isMe
                  ? "accent.solid"
                  : isSenderStaff
                    ? "accent.solid"
                    : "fg.default"
              }
              cursor="pointer"
              onClick={() => onInspectUser(message.sender_id)}
              textAlign={isMe ? "right" : "left"}
              _hover={{ textDecoration: "underline" }}
            >
              {prefix}
              {message.sender_nickname}
            </Text>
            {badge && (
              <Badge
                fontSize="2xs"
                px={1.5}
                py={0.5}
                borderRadius="full"
                bg={badge.bg}
                color={badge.color}
                borderWidth="1px"
                borderColor={badge.borderColor}
                fontWeight="extrabold"
                letterSpacing="wider"
                textTransform="uppercase"
                lineHeight={1}
                display="inline-flex"
                alignItems="center"
                gap={0.5}
              >
                <Box
                  className="material-symbols-outlined"
                  fontSize="3xs"
                  style={{ display: "inline-block", verticalAlign: "middle" }}
                >
                  {badge.icon}
                </Box>
                {badge.label}
              </Badge>
            )}
            <Text
              fontSize={{ base: "xs", md: "sm" }}
              color="fg.subtle"
              flexShrink={0}
            >
              {formatChatTime(message.timestamp)}
            </Text>
            {isStaff && (
              <Button
                type="button"
                variant="ghost"
                size="2xs"
                p={0}
                h={4}
                w={4}
                minW={4}
                borderRadius="full"
                color="fg.subtle"
                opacity={0}
                _groupHover={{ opacity: 1 }}
                _hover={{ color: "red.500", bg: "red.50" }}
                cursor="pointer"
                onClick={() => {
                  if (window.confirm("Delete this message?")) {
                    onDelete(message.id);
                  }
                }}
                aria-label="Delete message"
              >
                <Box className="material-symbols-outlined" fontSize="3xs">
                  close
                </Box>
              </Button>
            )}
          </Flex>

          {/* Chat Bubble Wrapper */}
          <Box
            bg={
              isMe
                ? "var(--c-chocolate, #7c563f)"
                : isSenderStaff
                  ? "color-mix(in srgb, var(--c-chocolate) 6%, var(--c-white))"
                  : "bg.muted"
            }
            color={isMe ? "white" : "fg.default"}
            border={isMe ? "none" : "1px solid"}
            borderColor={
              isMe
                ? undefined
                : isSenderStaff
                  ? "color-mix(in srgb, var(--c-chocolate) 20%, transparent)"
                  : "border.subtle"
            }
            px={{ base: 3.5, md: 4 }}
            py={{ base: 2, md: 2.5 }}
            borderRadius="xl"
            borderBottomRightRadius={isMe ? "none" : "xl"}
            borderBottomLeftRadius={isMe ? "xl" : "none"}
            boxShadow="sm"
            maxW={{ base: "85%", md: "70%" }}
            alignSelf={isMe ? "flex-end" : "flex-start"}
          >
            <Text
              fontSize={{ base: "md", md: "15px" }}
              lineHeight="1.5"
              whiteSpace="pre-wrap"
              wordBreak="break-word"
            >
              {message.content}
            </Text>
          </Box>
        </VStack>
      </Flex>
    </Box>
  );
});

// ─── Main Page ────────────────────────────────────────────────────────────────

export function BoardPage() {
  const { user, loading } = useUser();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<BoardTab>("hype");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [newPostText, setNewPostText] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(6);
  const [prevVisibleCount, setPrevVisibleCount] = useState(6);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1);
  const [inspectedUser, setInspectedUser] = useState<User | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isInspectorLoading, setIsInspectorLoading] = useState(false);
  const [memoryImage, setMemoryImage] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isMobileComposerOpen, setIsMobileComposerOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion() ?? false;
  const [chatInput, setChatInput] = useState("");
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  // Realtime System Configuration Sync states
  const [hypeBoardMode, setHypeBoardMode] = useState<
    "active" | "slow_3s" | "read_only"
  >("active");
  const [globalMuteActive, setGlobalMuteActive] = useState(false);
  const [isMemoryBoardActive, setIsMemoryBoardActive] = useState(true);

  // Cooldown timer states
  const [lastChatSent, setLastChatSent] = useState<number | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  // 1. Fetch initial configuration & subscribe to updates
  useEffect(() => {
    let active = true;
    const fetchInitialConfig = async () => {
      try {
        const { data, error } = await supabase
          .from("system_config")
          .select("*");
        if (error) throw error;
        if (active && data) {
          const hypeMode = data.find((c) => c.key === "hype_board_mode");
          const globalMute = data.find((c) => c.key === "global_mute_active");
          if (hypeMode?.text_value) {
            setHypeBoardMode(
              hypeMode.text_value as "active" | "slow_3s" | "read_only",
            );
          }
          if (globalMute) {
            setGlobalMuteActive(Boolean(globalMute.value));
          }
        }
      } catch (err) {
        console.error(
          "Failed to fetch initial system config in BoardPage:",
          err,
        );
      }
    };

    fetchInitialConfig();

    const syncChannel = supabase.channel("live_chat:system_config_sync");
    syncChannel
      .on("broadcast", { event: "hype_mode_change" }, (payload) => {
        if (active && payload.payload?.mode) {
          setHypeBoardMode(payload.payload.mode);
        }
      })
      .on("broadcast", { event: "global_mute_change" }, (payload) => {
        if (active && payload.payload?.active !== undefined) {
          setGlobalMuteActive(payload.payload.active);
        }
      })
      .on("broadcast", { event: "config_change" }, (payload) => {
        if (active && payload.payload) {
          if (
            payload.payload.key === "enable_memory_board" &&
            payload.payload.value !== undefined
          ) {
            setIsMemoryBoardActive(payload.payload.value);
          }
        }
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(syncChannel);
    };
  }, []);

  // 2. Load last sent timestamp from LocalStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("ween_last_chat_sent");
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed)) {
        Promise.resolve().then(() => {
          setLastChatSent(parsed);
        });
      }
    }
  }, []);

  // 3. Track active countdown clock for slow mode cooldown
  useEffect(() => {
    if (hypeBoardMode !== "slow_3s" || lastChatSent === null) {
      Promise.resolve().then(() => {
        setCooldownRemaining(0);
      });
      return;
    }

    const checkCooldown = () => {
      const elapsed = Date.now() - lastChatSent;
      const remaining = Math.max(0, 3000 - elapsed);
      Promise.resolve().then(() => {
        setCooldownRemaining(remaining);
      });
      return remaining;
    };

    const remaining = checkCooldown();
    if (remaining <= 0) return;

    const interval = setInterval(() => {
      const rem = checkCooldown();
      if (rem <= 0) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [lastChatSent, hypeBoardMode]);

  // Memory board — existing hook (only active when on memory tab)
  const {
    posts,
    loading: memoryLoading,
    submitting,
    hypeActive,
    memoryActive,
    handleCreatePost,
    handleLikePost,
  } = useBoardRealtime(activeTab, user);

  // Live chat — new hook (only active when on hype tab)
  const {
    messages: chatMessages,
    loading: chatLoading,
    sending: chatSending,
    onlineCount: chatOnlineCount,
    sendMessage,
    deleteMessage,
  } = useLiveChat(activeTab, user);

  // Auto-scroll snapping for inbound messages
  useEffect(() => {
    if (chatMessages.length > 0 && virtuosoRef.current) {
      const timer = setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({
          index: chatMessages.length - 1,
          behavior: "smooth",
        });
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [chatMessages.length]);

  useEffect(() => {
    const presenceChannel: RealtimeChannel = supabase.channel(
      "board:global:presence",
      {
        config: { private: true },
      },
    );

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        setOnlineCount(Object.keys(state).length);
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        setOnlineCount((prev) => prev + newPresences.length);
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        setOnlineCount((prev) => Math.max(1, prev - leftPresences.length));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && user) {
          await presenceChannel.track({
            user_id: user.student_id,
            nickname: user.nickname,
            online_at: new Date().toISOString(),
            session_token: localStorage.getItem("baan7_session_token"),
          });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [user]);

  // Redirect guest users to login page
  useEffect(() => {
    if (!loading && !user) {
      toaster.create({
        title:
          "กรุณาล็อกอินเข้าสู่ระบบก่อน เพื่อใช้งานฟีเจอร์แชตและกระดานข้อความ",
        type: "warning",
      });
      navigate("/login");
    }
  }, [loading, user, navigate]);

  const isStaff =
    user?.role === "staff" ||
    user?.role === "moderator" ||
    user?.role === "media_admin";
  const isCooldownActive =
    !isStaff && hypeBoardMode === "slow_3s" && cooldownRemaining > 0;
  const effectiveHypeActive = hypeActive || isStaff;
  const effectiveMemoryActive = memoryActive || isStaff;
  const isMemoryAccessible = true;

  useEffect(() => {
    Promise.resolve().then(() => {
      setIsMemoryBoardActive(memoryActive);
    });
  }, [memoryActive]);

  const handleToggleMemoryBoard = async (newVal: boolean) => {
    setIsMemoryBoardActive(newVal);
    try {
      const { error } = await supabase
        .from("system_config")
        .update({ value: newVal })
        .eq("key", "enable_memory_board");
      if (error) throw error;

      // Broadcast changes to keep all clients in sync
      const syncChannel = supabase.channel("live_chat:system_config_sync");
      syncChannel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          syncChannel
            .send({
              type: "broadcast",
              event: "config_change",
              payload: { key: "enable_memory_board", value: newVal },
            })
            .then(() => {
              supabase.removeChannel(syncChannel);
            });
        }
      });

      toaster.create({
        title: "Memory Board Visibility Updated",
        description: `The Memory Board is now ${newVal ? "OPEN" : "CLOSED"} for students.`,
        type: "success",
      });
    } catch (err) {
      console.error("Failed to update enable_memory_board config:", err);
      toaster.create({
        title: "Local State Updated",
        description: `Failed to sync to database, updated client-side visibility to ${newVal ? "OPEN" : "CLOSED"}.`,
        type: "info",
      });
    }
  };

  const handleInspectUser = useCallback(async (userId: string) => {
    setIsInspectorOpen(true);
    setIsInspectorLoading(true);
    setInspectedUser(null);
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("student_id", userId)
        .single();
      if (!error && data) {
        setInspectedUser(data as User);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsInspectorLoading(false);
    }
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setMemoryImage(e.target.files[0]);
    }
  };

  const handleSubmitPost = async () => {
    if (!newPostText.trim() || !selectedTag) return;
    let imageUrl = null;

    if (memoryImage && activeTab === "memory") {
      setIsUploadingImage(true);
      try {
        const compressedBlob = await compressImage(memoryImage);
        const fileName = `${user?.student_id}-${Math.random()}-${Date.now()}.jpg`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("board_media")
          .upload(filePath, compressedBlob, {
            contentType: "image/jpeg",
            cacheControl: "3600",
            upsert: true,
          });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from("board_media")
            .getPublicUrl(filePath);
          imageUrl = publicUrlData.publicUrl;
        } else {
          console.error("Upload Error", uploadError);
          toaster.create({ title: "Image upload failed", type: "error" });
        }
      } catch (err) {
        console.error("Compression/Upload Error", err);
        toaster.create({ title: "Image upload failed", type: "error" });
      } finally {
        setIsUploadingImage(false);
      }
    }

    await handleCreatePost(
      newPostText.trim(),
      [selectedTag],
      isAnonymous,
      imageUrl,
    );
    setNewPostText("");
    setIsAnonymous(false);
    setSelectedTag(null);
    setMemoryImage(null);
  };

  const handleSwitchTab = (tab: BoardTab) => {
    setActiveTab(tab);
    setVisibleCount(6);
    setPrevVisibleCount(6);
  };

  const handleLoadMore = () => {
    setIsFetchingMore(true);
    setTimeout(() => {
      setPrevVisibleCount(visibleCount);
      setVisibleCount((prev) => prev + 6);
      setIsFetchingMore(false);
    }, 1200);
  };

  const filteredPosts = posts.filter((p) =>
    activeCategory === "all" ? true : p.tags && p.tags.includes(activeCategory),
  );

  const visiblePosts = filteredPosts.slice(0, visibleCount);
  const hasMore = filteredPosts.length > visibleCount;
  // Loading state / guest state flash prevention
  if (loading || !user) {
    return (
      <Flex justify="center" align="center" minH="100vh" bg="bg.canvas">
        <Spinner size="xl" color="var(--c-lagoon)" />
      </Flex>
    );
  }

  return (
    <Box
      position="relative"
      zIndex={10}
      maxW="var(--container-max)"
      mx="auto"
      px={{ base: 4, md: 16 }}
      pt={{ base: 2, md: 28 }}
      pb={{ base: 4, md: 20 }}
      minH="100vh"
    >
      {/* Page Header */}
      <VStack
        gap={2}
        mb={{ base: 3, md: 6 }}
        animation="fade-in-up 0.6s var(--ease-out-expo) both"
      >
        <Heading
          as="h1"
          fontFamily="'Playfair Display', serif"
          fontSize={{ base: "2rem", md: "3.5rem" }}
          fontWeight={700}
          lineHeight={1.1}
          letterSpacing="-0.02em"
          color="accent.solid"
          textAlign="center"
        >
          {(!effectiveHypeActive && activeTab === "hype") ||
          (!effectiveMemoryActive && activeTab === "memory")
            ? "Offline"
            : `The ${activeTab === "hype" ? "Hype" : "Memory"} Board`}
        </Heading>
        <Text
          color="fg.muted"
          fontSize={{ base: "sm", md: "lg" }}
          textAlign="center"
          maxW="lg"
        >
          {(!effectiveHypeActive && activeTab === "hype") ||
          (!effectiveMemoryActive && activeTab === "memory")
            ? "Orientation boards are currently closed by staff. Check back soon!"
            : "Share the excitement, cheer on your peers, and build the Baan 7 community spirit!"}
        </Text>

        {/* Live Presence Badge */}
        {(effectiveHypeActive || isMemoryAccessible) && (
          <Box
            display="flex"
            gap={2}
            mx="auto"
            justifyContent="center"
            w={{ base: "90%", md: "auto" }}
          >
            <LivePresenceBadge count={onlineCount} />
          </Box>
        )}
      </VStack>

      {/* Tab Toggle */}
      {effectiveHypeActive && isMemoryAccessible && (
        <Flex justify="center" mb={6} position="relative" zIndex={2}>
          <HStack
            role="tablist"
            aria-label="Board selection"
            bg="bg.surface"
            border="1px solid"
            borderColor="border.subtle"
            borderRadius="full"
            p={1}
            gap={0}
          >
            <TabButton
              active={activeTab === "hype"}
              onClick={() => handleSwitchTab("hype")}
              icon="campaign"
              label="Hype Board"
            />
            <TabButton
              active={activeTab === "memory"}
              onClick={() => handleSwitchTab("memory")}
              icon="push_pin"
              label="Memory Board"
            />
          </HStack>
        </Flex>
      )}

      {/* Global Board Kill-Switch Ribbon */}
      {(!effectiveHypeActive && activeTab === "hype") ||
      (!effectiveMemoryActive && activeTab === "memory") ? (
        <Flex
          justify="center"
          align="center"
          minH="200px"
          bg="bg.surface"
          borderRadius="xl"
          border="1px solid"
          borderColor="border.subtle"
          p={6}
        >
          <Text
            fontSize="md"
            fontWeight="600"
            color="fg.subtle"
            textAlign="center"
          >
            บอร์ดสนทนาปิดปรับปรุงชั่วคราวตามลำดับกิจกรรมโปรดรอสัญญาณจากพี่สตาฟ
          </Text>
        </Flex>
      ) : activeTab === "hype" ? (
        /* ═══ LIVE CHAT (Hype Tab) ═══════════════════════════════════════ */
        <Box
          maxW="3xl"
          mx="auto"
          w="100%"
          bg="bg.surface"
          border="1px solid"
          borderColor="border.subtle"
          borderRadius="2xl"
          overflow="hidden"
          display="flex"
          flexDirection="column"
          h={{ base: "calc(100vh - 200px)", md: "calc(100vh - 280px)" }}
          minH="400px"
          animation="fade-in-up 0.5s var(--ease-out-expo) both"
        >
          {/* Chat Header */}
          <Flex
            align="center"
            justify="space-between"
            px={{ base: 4, md: 6 }}
            py={3}
            borderBottom="1px solid"
            borderColor="border.subtle"
            bg="bg.hero"
            flexShrink={0}
          >
            <HStack gap={3}>
              <Box
                className="material-symbols-outlined"
                fontSize="xl"
                color="accent.solid"
              >
                chat
              </Box>
              <Heading
                as="h2"
                fontSize={{ base: "md", md: "lg" }}
                fontWeight={700}
                fontFamily="heading"
                color="fg.default"
              >
                Live Chat
              </Heading>
            </HStack>
            <HStack gap={2}>
              <Box position="relative" w={2} h={2}>
                <Box
                  w={2}
                  h={2}
                  borderRadius="full"
                  bg="green.500"
                  position="absolute"
                />
                {!shouldReduceMotion && (
                  <motion.div
                    animate={{ scale: [1, 2], opacity: [0.6, 0] }}
                    transition={{
                      repeat: Infinity,
                      duration: 1.5,
                      ease: "easeOut",
                    }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "50%",
                      background: "var(--chakra-colors-green-500, #38a169)",
                    }}
                  />
                )}
              </Box>
              <Text fontSize="xs" fontWeight="600" color="fg.muted">
                {chatOnlineCount} {chatOnlineCount === 1 ? "viewer" : "viewers"}
              </Text>
            </HStack>
          </Flex>

          {/* Chat Message List — Virtualized */}
          <Box flex={1} overflow="hidden">
            {chatLoading ? (
              <Flex justify="center" align="center" h="100%">
                <Spinner size="lg" color="var(--c-lagoon)" />
              </Flex>
            ) : chatMessages.length === 0 ? (
              <Flex justify="center" align="center" h="100%" p={6}>
                <VStack gap={2}>
                  <Box
                    className="material-symbols-outlined"
                    fontSize="4xl"
                    color="fg.subtle"
                  >
                    forum
                  </Box>
                  <Text color="fg.subtle" fontSize="sm" textAlign="center">
                    No messages yet. Be the first to chat!
                  </Text>
                </VStack>
              </Flex>
            ) : (
              <Virtuoso
                ref={virtuosoRef}
                data={chatMessages}
                className="live-chat-scroll"
                followOutput={(isAtBottom) =>
                  isAtBottom ? "smooth" : "smooth"
                }
                initialTopMostItemIndex={Math.max(0, chatMessages.length - 1)}
                itemContent={(_index, msg) => (
                  <LiveChatBubble
                    key={msg.id}
                    message={msg}
                    isStaff={
                      user?.role !== "student" && user?.role !== undefined
                    }
                    isMe={msg.sender_id === user?.student_id}
                    onDelete={deleteMessage}
                    onInspectUser={handleInspectUser}
                  />
                )}
              />
            )}
          </Box>

          {/* Chat Composer */}
          {hypeBoardMode === "read_only" && !isStaff ? (
            <Box
              px={{ base: 3, md: 5 }}
              py={4}
              borderTop="1px solid"
              borderColor="border.subtle"
              bg="var(--c-ivory)"
              flexShrink={0}
              textAlign="center"
            >
              <Text color="fg.subtle" fontSize="sm" fontWeight="600">
                ระบบบอร์ดคุยสดถูกปรับเป็นโหมดอ่านอย่างเดียว (Read Only Mode)
              </Text>
            </Box>
          ) : (
            <Box
              px={{ base: 3, md: 5 }}
              py={3}
              borderTop="1px solid"
              borderColor="border.subtle"
              bg="bg.surface"
              flexShrink={0}
              position="relative"
            >
              {/* Panic Mute Overlay */}
              {globalMuteActive && !isStaff && (
                <Flex
                  position="absolute"
                  inset={0}
                  bg="rgba(252, 249, 248, 0.85)"
                  backdropFilter="blur(2px)"
                  align="center"
                  justify="center"
                  zIndex={10}
                  px={4}
                >
                  <Text
                    color="var(--c-error)"
                    fontWeight="bold"
                    fontSize="sm"
                    display="flex"
                    alignItems="center"
                    gap={2}
                  >
                    <Box className="material-symbols-outlined" fontSize="md">
                      block
                    </Box>
                    ช่องแชทถูกปิดเสียงชั่วคราวโดยผู้ดูแลระบบ
                  </Text>
                </Flex>
              )}

              <Flex gap={3} align="center">
                {user ? (
                  <Box
                    w={8}
                    h={8}
                    borderRadius="full"
                    bg={user.avatar_color}
                    color="white"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    fontWeight="700"
                    fontSize="xs"
                    flexShrink={0}
                  >
                    {getInitials(user.nickname || user.student_id)}
                  </Box>
                ) : (
                  <Box
                    w={8}
                    h={8}
                    borderRadius="full"
                    bg="brand.muted"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    flexShrink={0}
                  >
                    <Box
                      className="material-symbols-outlined"
                      fontSize="md"
                      color="brand.fg"
                    >
                      person
                    </Box>
                  </Box>
                )}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (
                      !chatInput.trim() ||
                      chatSending ||
                      isCooldownActive ||
                      (globalMuteActive && !isStaff)
                    )
                      return;
                    const textToSend = chatInput.trim();
                    const success = await sendMessage(textToSend);
                    if (success) {
                      setChatInput("");
                      if (hypeBoardMode === "slow_3s" && !isStaff) {
                        const now = Date.now();
                        localStorage.setItem(
                          "ween_last_chat_sent",
                          String(now),
                        );
                        setLastChatSent(now);
                      }
                    }
                  }}
                  style={{
                    flex: 1,
                    display: "flex",
                    gap: "8px",
                    alignItems: "center",
                  }}
                >
                  <Box
                    position="relative"
                    flex={1}
                    display="flex"
                    alignItems="center"
                  >
                    <Input
                      placeholder={
                        isCooldownActive
                          ? "Slow mode: Cooldown active"
                          : user
                            ? "Type a message..."
                            : "Sign in to chat..."
                      }
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={
                        !user ||
                        chatSending ||
                        isCooldownActive ||
                        (globalMuteActive && !isStaff)
                      }
                      maxLength={200}
                      h="40px"
                      borderRadius="xl"
                      border="1px solid"
                      borderColor="border.subtle"
                      bg="bg.hero"
                      fontSize="sm"
                      _focus={{ borderColor: "accent.solid", bg: "bg.surface" }}
                      aria-label="Chat message input"
                      pr={isCooldownActive ? "70px" : "12px"}
                    />
                    {isCooldownActive && (
                      <Box
                        position="absolute"
                        right="12px"
                        bg="var(--c-lagoon-light)"
                        color="var(--c-lagoon)"
                        px={2}
                        py={0.5}
                        borderRadius="md"
                        fontSize="xs"
                        fontWeight="bold"
                        pointerEvents="none"
                      >
                        {(cooldownRemaining / 1000).toFixed(1)}s
                      </Box>
                    )}
                  </Box>
                  <Button
                    type="submit"
                    bg="accent.solid"
                    color="white"
                    h="40px"
                    w="40px"
                    minW="40px"
                    p={0}
                    borderRadius="xl"
                    cursor="pointer"
                    disabled={
                      !user ||
                      !chatInput.trim() ||
                      chatSending ||
                      isCooldownActive ||
                      (globalMuteActive && !isStaff)
                    }
                    loading={chatSending}
                    _hover={{
                      boxShadow:
                        "0 4px 14px color-mix(in srgb, var(--c-chocolate) 25%, transparent)",
                    }}
                    aria-label="Send message"
                  >
                    <Box className="material-symbols-outlined" fontSize="md">
                      send
                    </Box>
                  </Button>
                </form>
                {user && chatInput.length > 0 && (
                  <Text
                    fontSize="2xs"
                    color="fg.subtle"
                    fontWeight="600"
                    flexShrink={0}
                  >
                    {chatInput.length}/200
                  </Text>
                )}
              </Flex>
            </Box>
          )}
        </Box>
      ) : (
        /* ═══ MEMORY BOARD (Memory Tab) ═══════════════════════════════════ */
        <Box maxW="4xl" mx="auto" w="100%">
          {/* 1. Governance Configuration Panel for Moderator / Admin */}
          {(user?.role === "moderator" ||
            (user?.role as string) === "superadmin" ||
            (user?.role as string) === "admin") && (
            <Box
              bg="bg.surface"
              border="1px solid"
              borderColor="border.subtle"
              borderRadius="2xl"
              p={5}
              mb={6}
              boxShadow="sm"
            >
              <Flex
                align="center"
                justify="space-between"
                flexWrap="wrap"
                gap={4}
              >
                <Box>
                  <Heading
                    as="h3"
                    fontSize="md"
                    fontWeight="700"
                    color="accent.solid"
                    mb={1}
                  >
                    Memory Board Governance Panel
                  </Heading>
                  <Text fontSize="xs" color="fg.subtle">
                    Control public visibility of the Memory Board for general
                    students.
                  </Text>
                </Box>
                <HStack gap={3}>
                  <Text
                    fontSize="sm"
                    fontWeight="600"
                    color={isMemoryBoardActive ? "green.600" : "red.600"}
                  >
                    {isMemoryBoardActive ? "Publicly Open" : "Publicly Closed"}
                  </Text>
                  <Switch.Root
                    checked={isMemoryBoardActive}
                    onCheckedChange={(details: { checked: boolean }) =>
                      handleToggleMemoryBoard(details.checked)
                    }
                    colorPalette="teal"
                  >
                    <Switch.HiddenInput />
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Root>
                </HStack>
              </Flex>
            </Box>
          )}

          {/* 2. Access Gate Check */}
          {!isMemoryBoardActive && user?.role === "student" ? (
            /* Student Locked Placeholder Card */
            <Flex
              direction="column"
              align="center"
              justify="center"
              minH="300px"
              bg="bg.surface"
              border="1px solid"
              borderColor="border.subtle"
              borderRadius="2xl"
              p={8}
              textAlign="center"
              boxShadow="sm"
            >
              <Box
                className="material-symbols-outlined"
                fontSize="5xl"
                color="accent.solid"
                mb={4}
              >
                lock
              </Box>
              <Heading
                as="h3"
                fontSize="xl"
                fontWeight="700"
                color="fg.default"
                mb={2}
              >
                Memory Board Locked
              </Heading>
              <Text fontSize="md" color="fg.muted" maxW="md">
                Memory Board will be unlocked during the final session. Stay
                tuned!
              </Text>
            </Flex>
          ) : (
            /* Accessible Flow (Board is open, or board is closed but accessed by Staff / Media Admin / Moderator) */
            <>
              {/* Subtle staff-only indicator banner */}
              {!isMemoryBoardActive &&
                (user?.role === "staff" || user?.role === "media_admin") && (
                  <Box
                    bg="orange.50"
                    border="1px solid"
                    borderColor="orange.200"
                    borderRadius="xl"
                    p={3}
                    mb={6}
                    textAlign="center"
                  >
                    <Text fontSize="sm" fontWeight="600" color="orange.700">
                      [Staff Only View: Board is currently hidden from Students]
                    </Text>
                  </Box>
                )}

              {/* Category Filters */}
              <Box
                bg="bg.hero"
                border="1px solid"
                borderColor="border.subtle"
                borderRadius="xl"
                px={{ base: 3, md: 5 }}
                py={3}
                mb={{ base: 4, md: 6 }}
                animation="fade-in-up 0.6s var(--ease-out-expo) 0.1s both"
              >
                <Flex align="center" gap={{ base: 2, md: 3 }} flexWrap="wrap">
                  <Text
                    fontSize="xs"
                    fontWeight="600"
                    letterSpacing="0.05em"
                    color="fg.subtle"
                    display={{ base: "none", md: "block" }}
                  >
                    Filter by:
                  </Text>
                  <HStack
                    gap={2}
                    overflowX="auto"
                    whiteSpace="nowrap"
                    w="100%"
                    css={{
                      "&::-webkit-scrollbar": { display: "none" },
                      "-ms-overflow-style": "none",
                      "scrollbar-width": "none",
                    }}
                  >
                    {categories.map((cat) => (
                      <Button
                        key={cat.value}
                        type="button"
                        aria-pressed={activeCategory === cat.value}
                        onClick={() => {
                          setActiveCategory(cat.value);
                          setVisibleCount(6);
                          setPrevVisibleCount(6);
                        }}
                        px={4}
                        py={2}
                        h={{ base: "40px", md: "44px" }}
                        minH={{ base: "40px", md: "44px" }}
                        borderRadius="full"
                        fontSize="xs"
                        fontWeight="600"
                        letterSpacing="0.03em"
                        cursor="pointer"
                        transition="all 0.2s"
                        bg={
                          activeCategory === cat.value
                            ? "accent.solid"
                            : "bg.surface"
                        }
                        color={
                          activeCategory === cat.value ? "white" : "fg.default"
                        }
                        border="1px solid"
                        borderColor={
                          activeCategory === cat.value
                            ? "accent.solid"
                            : "border.subtle"
                        }
                        _hover={{
                          bg:
                            activeCategory === cat.value
                              ? "accent.solid"
                              : "bg.hero",
                        }}
                      >
                        {cat.label}
                      </Button>
                    ))}
                  </HStack>
                </Flex>
              </Box>

              {/* Main Column */}
              <Box maxW="4xl" mx="auto" w="100%">
                {/* Posts Column */}
                <VStack align="stretch" gap={{ base: 4, md: 6 }}>
                  {/* Composer */}
                  <Box
                    display={{ base: "none", md: "block" }}
                    bg="bg.surface"
                    border="1px solid"
                    borderColor="border.subtle"
                    borderRadius="2xl"
                    p={{ base: 4, md: 6 }}
                    animation="fade-in-up 0.6s var(--ease-out-expo) 0.15s both"
                  >
                    <Flex gap={{ base: 3, md: 4 }} align="start">
                      {user ? (
                        <Box
                          w={{ base: 10, md: 12 }}
                          h={{ base: 10, md: 12 }}
                          borderRadius="full"
                          bg={user.avatar_color}
                          color="white"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          fontWeight="700"
                          fontSize="sm"
                          flexShrink={0}
                        >
                          {getInitials(user.nickname || user.student_id)}
                        </Box>
                      ) : (
                        <Box
                          w={{ base: 10, md: 12 }}
                          h={{ base: 10, md: 12 }}
                          borderRadius="full"
                          bg="brand.muted"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          flexShrink={0}
                        >
                          <Box
                            className="material-symbols-outlined"
                            fontSize="xl"
                            color="brand.fg"
                          >
                            person
                          </Box>
                        </Box>
                      )}
                      <Box flex={1}>
                        <label htmlFor="board-composer" className="sr-only">
                          Pin something new
                        </label>
                        <Textarea
                          id="board-composer"
                          placeholder={
                            !user
                              ? "Sign in to post orientation hype..."
                              : "Pin something new to the board..."
                          }
                          value={newPostText}
                          onChange={(e) => setNewPostText(e.target.value)}
                          disabled={!user || submitting}
                          maxLength={150}
                          variant="flushed"
                          resize="none"
                          fontSize="md"
                          color="var(--c-ink)"
                          _focus={{ borderColor: "var(--c-lagoon)" }}
                          minH="60px"
                          p={0}
                          mb={2}
                        />

                        {user && (
                          <VStack align="start" gap={2} my={3} w="100%">
                            <Text
                              fontSize="xs"
                              fontWeight="700"
                              color="fg.muted"
                            >
                              Select a Tag (Required):
                            </Text>
                            <HStack
                              gap={2}
                              overflowX="auto"
                              whiteSpace="nowrap"
                              w="100%"
                              css={{
                                "&::-webkit-scrollbar": { display: "none" },
                                "-ms-overflow-style": "none",
                                "scrollbar-width": "none",
                              }}
                            >
                              {[
                                "#Hype",
                                "#Question",
                                "#Memory",
                                "#Ween2026",
                              ].map((tag) => {
                                const isSelected = selectedTag === tag;
                                return (
                                  <Button
                                    key={tag}
                                    type="button"
                                    onClick={() => setSelectedTag(tag)}
                                    size="xs"
                                    borderRadius="full"
                                    bg={
                                      isSelected ? "accent.solid" : "bg.surface"
                                    }
                                    color={isSelected ? "white" : "fg.default"}
                                    border="1px solid"
                                    borderColor={
                                      isSelected
                                        ? "accent.solid"
                                        : "border.subtle"
                                    }
                                    h={{ base: "40px", md: "32px" }}
                                    px={3}
                                    cursor="pointer"
                                    _hover={{
                                      bg: isSelected
                                        ? "accent.solid"
                                        : "bg.hero",
                                    }}
                                  >
                                    {tag}
                                  </Button>
                                );
                              })}
                            </HStack>
                          </VStack>
                        )}

                        <Flex
                          justify="space-between"
                          align="center"
                          mt={2}
                          flexWrap="wrap"
                          gap={3}
                        >
                          <HStack gap={3}>
                            {user && (
                              <HStack gap={2}>
                                <input
                                  type="file"
                                  accept="image/*"
                                  id="memory-image-upload"
                                  onChange={handleImageChange}
                                  style={{ display: "none" }}
                                />
                                <label
                                  htmlFor="memory-image-upload"
                                  style={{
                                    cursor: "pointer",
                                    fontSize: "0.875rem",
                                    color: "var(--c-chocolate)",
                                    fontWeight: 600,
                                  }}
                                >
                                  <Box
                                    as="span"
                                    className="material-symbols-outlined"
                                    fontSize="md"
                                    verticalAlign="middle"
                                    mr={1}
                                  >
                                    image
                                  </Box>
                                  {memoryImage
                                    ? memoryImage.name
                                    : "Attach Image (Max 1)"}
                                </label>
                              </HStack>
                            )}
                          </HStack>
                          <HStack gap={4} align="center">
                            {user && (
                              <Text
                                fontSize="xs"
                                color="fg.subtle"
                                fontWeight="600"
                              >
                                {newPostText.length} / 150
                              </Text>
                            )}
                            <Button
                              bg="accent.solid"
                              color="white"
                              px={6}
                              py={2}
                              borderRadius="xl"
                              fontSize="sm"
                              fontWeight="600"
                              cursor="pointer"
                              onClick={handleSubmitPost}
                              loading={submitting || isUploadingImage}
                              disabled={
                                !user || !newPostText.trim() || !selectedTag
                              }
                              _hover={{
                                boxShadow:
                                  "0 4px 14px color-mix(in srgb, var(--c-chocolate) 25%, transparent)",
                              }}
                              minH="44px"
                            >
                              Pin it!
                            </Button>
                          </HStack>
                        </Flex>
                      </Box>
                    </Flex>
                  </Box>

                  {/* Posts Grid */}
                  {memoryLoading ? (
                    <Flex justify="center" py={12}>
                      <JellyScrollLoader />
                    </Flex>
                  ) : filteredPosts.length === 0 ? (
                    <Flex
                      justify="center"
                      py={12}
                      bg="bg.surface"
                      border="1px dashed"
                      borderColor="border.subtle"
                      borderRadius="2xl"
                    >
                      <Text color="fg.subtle">
                        No posts in this category yet. Be the first to post!
                      </Text>
                    </Flex>
                  ) : (
                    <Box
                      position="relative"
                      css={{
                        columnCount: { base: 1, sm: 2, md: 3 },
                        columnGap: "24px",
                        "& > div": {
                          breakInside: "avoid",
                          marginBottom: "24px",
                        },
                      }}
                    >
                      <AnimatePresence mode="popLayout">
                        {visiblePosts.map((post, i) =>
                          i >= prevVisibleCount ? (
                            <motion.div
                              key={post.id}
                              layout
                              initial={
                                shouldReduceMotion
                                  ? { opacity: 0 }
                                  : { y: 20, opacity: 0 }
                              }
                              animate={{ y: 0, opacity: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              transition={
                                shouldReduceMotion
                                  ? { duration: 0.2 }
                                  : {
                                      type: "spring",
                                      stiffness: 300,
                                      damping: 20,
                                      delay: (i - prevVisibleCount) * 0.05,
                                    }
                              }
                              style={{ height: "100%" }}
                            >
                              <MemoryCard
                                post={post}
                                index={i}
                                onLike={handleLikePost}
                                currentUserRole={user?.role}
                                onInspectUser={handleInspectUser}
                              />
                            </motion.div>
                          ) : (
                            <motion.div
                              key={post.id}
                              layout
                              style={{ height: "100%" }}
                            >
                              <MemoryCard
                                post={post}
                                index={i}
                                onLike={handleLikePost}
                                currentUserRole={user?.role}
                                onInspectUser={handleInspectUser}
                              />
                            </motion.div>
                          ),
                        )}
                      </AnimatePresence>
                    </Box>
                  )}
                </VStack>
              </Box>

              {/* Load More */}
              {(hasMore || isFetchingMore) && (
                <Flex
                  justify="center"
                  py={12}
                  position="relative"
                  zIndex={1}
                  minH="60px"
                >
                  <AnimatePresence mode="wait">
                    {isFetchingMore ? (
                      <motion.div
                        key="loader"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <JellyScrollLoader />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="button"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Button
                          type="button"
                          onClick={handleLoadMore}
                          display="inline-flex"
                          alignItems="center"
                          gap={2}
                          bg="bg.surface"
                          border="1px solid"
                          borderColor="border.subtle"
                          px={{ base: 6, md: 8 }}
                          py={3}
                          borderRadius="full"
                          fontSize="sm"
                          fontWeight="600"
                          color="fg.default"
                          cursor="pointer"
                          transition="all 0.2s"
                          _hover={{
                            bg: "bg.hero",
                            boxShadow: "var(--shadow-card-hover)",
                          }}
                          minH="44px"
                        >
                          Load More Memories
                          <Box
                            className="material-symbols-outlined"
                            fontSize="md"
                          >
                            expand_more
                          </Box>
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Flex>
              )}
            </>
          )}
        </Box>
      )}

      {/* Profile Inspector Dialog Layer */}
      <Dialog.Root
        open={isInspectorOpen}
        onOpenChange={(e) => setIsInspectorOpen(e.open)}
        placement={{ base: "bottom", md: "center" }}
      >
        <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <Dialog.Positioner zIndex={2200} px={4}>
          <Dialog.Content
            width={{ base: "100%", md: "520px" }}
            bg="var(--c-white)"
            borderRadius="24px"
            boxShadow="xl"
            p={6}
          >
            {isInspectorLoading ? (
              <VStack gap={4} align="center" py={6}>
                <Skeleton boxSize="100px" borderRadius="full" />
                <Skeleton height="24px" width="150px" />
                <Skeleton height="16px" width="100px" />
              </VStack>
            ) : inspectedUser ? (
              <VStack gap={4} align="center" pt={4} pb={2}>
                <Box
                  w="100px"
                  h="100px"
                  borderRadius="full"
                  overflow="hidden"
                  bg={
                    inspectedUser.profile_pic_url
                      ? "transparent"
                      : inspectedUser.avatar_color || "var(--c-muted-brown)"
                  }
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  mb={2}
                  boxShadow="md"
                >
                  {inspectedUser.profile_pic_url ? (
                    <Image
                      src={inspectedUser.profile_pic_url}
                      alt={`${inspectedUser.nickname || "User"}'s profile picture`}
                      w="100%"
                      h="100%"
                      objectFit="cover"
                      loading="lazy"
                    />
                  ) : (
                    <Text fontSize="2xl" fontWeight="700" color="white">
                      {getInitials(
                        inspectedUser.nickname || inspectedUser.student_id,
                      )}
                    </Text>
                  )}
                </Box>
                <VStack gap={1} align="center">
                  <Text
                    fontSize="2xl"
                    fontWeight="700"
                    color="var(--c-chocolate)"
                    fontFamily="heading"
                  >
                    {inspectedUser.nickname
                      ? inspectedUser.nickname.replace(
                          /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
                          "",
                        )
                      : "Guest"}
                  </Text>
                  {inspectedUser.full_name && (
                    <Text fontSize="md" color="fg.muted" fontWeight="500">
                      {inspectedUser.full_name.replace(
                        /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
                        "",
                      )}
                    </Text>
                  )}
                </VStack>

                <Flex gap={2} mt={3} flexWrap="wrap" justify="center">
                  {inspectedUser.house_position && (
                    <Badge
                      colorPalette="orange"
                      size="md"
                      borderRadius="full"
                      px={3}
                    >
                      {inspectedUser.house_position.replace(
                        /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
                        "",
                      )}
                    </Badge>
                  )}
                  {inspectedUser.faculty && (
                    <Badge
                      colorPalette="gray"
                      size="md"
                      borderRadius="full"
                      px={3}
                    >
                      {inspectedUser.faculty.replace(
                        /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
                        "",
                      )}
                    </Badge>
                  )}
                </Flex>
              </VStack>
            ) : (
              <Text textAlign="center" py={4} color="fg.subtle">
                User not found
              </Text>
            )}

            <Dialog.CloseTrigger position="absolute" top={4} right={4} asChild>
              <Button
                type="button"
                variant="ghost"
                bg="transparent"
                borderRadius="full"
                w={{ base: "40px", md: "32px" }}
                h={{ base: "40px", md: "32px" }}
                minW={{ base: "40px", md: "32px" }}
                p={0}
                cursor="pointer"
              >
                <Box className="material-symbols-outlined" fontSize="md">
                  close
                </Box>
              </Button>
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* Mobile Composer FAB & Bottom Sheet */}
      {(effectiveHypeActive || isMemoryAccessible) && (
        <>
          <Box
            as="button"
            display={{ base: "flex", md: "none" }}
            position="fixed"
            bottom={{ base: "90px", md: "30px" }}
            left={{ base: "24px", md: "auto" }}
            right={{ base: "auto", md: "30px" }}
            w="56px"
            h="56px"
            borderRadius="full"
            bg="color-mix(in srgb, var(--c-chocolate) 100%, transparent)"
            color="white"
            alignItems="center"
            justifyContent="center"
            fontSize="3xl"
            fontWeight="bold"
            boxShadow="0 12px 40px rgba(73, 98, 104, 0.25)"
            zIndex="9999"
            onClick={() => setIsMobileComposerOpen(true)}
            transition="all 0.2s"
            _active={{ transform: "scale(0.95)" }}
            aria-label="Open Composer"
            aria-hidden={isMobileComposerOpen}
          >
            <Box className="material-symbols-outlined">add</Box>
          </Box>

          <AnimatePresence>
            {isMobileComposerOpen && (
              <>
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.4)",
                    backdropFilter: "blur(4px)",
                    zIndex: 1400,
                  }}
                  onClick={() => setIsMobileComposerOpen(false)}
                />

                {/* Bottom Sheet Composer */}
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  style={{
                    position: "fixed",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 1401,
                    backgroundColor: "var(--c-surface, #ffffff)",
                    borderTopLeftRadius: "24px",
                    borderTopRightRadius: "24px",
                    padding: "24px",
                    boxShadow: "0 -4px 20px rgba(0,0,0,0.1)",
                  }}
                >
                  <Flex justify="space-between" align="center" mb={4}>
                    <Heading size="md" fontFamily="heading" color="fg.default">
                      {activeTab === "hype"
                        ? "Share the hype"
                        : "Pin something"}
                    </Heading>
                    <Box
                      as="button"
                      className="material-symbols-outlined"
                      onClick={() => setIsMobileComposerOpen(false)}
                      color="fg.subtle"
                      _hover={{ color: "fg.default" }}
                    >
                      close
                    </Box>
                  </Flex>

                  <Flex gap={{ base: 3, md: 4 }} align="start">
                    {user ? (
                      <Box
                        w={{ base: 10, md: 12 }}
                        h={{ base: 10, md: 12 }}
                        borderRadius="full"
                        bg={user.avatar_color}
                        color="white"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        fontWeight="700"
                        fontSize="sm"
                        flexShrink={0}
                      >
                        {getInitials(user.nickname || user.student_id)}
                      </Box>
                    ) : (
                      <Box
                        w={{ base: 10, md: 12 }}
                        h={{ base: 10, md: 12 }}
                        borderRadius="full"
                        bg="brand.muted"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        flexShrink={0}
                      >
                        <Box
                          className="material-symbols-outlined"
                          fontSize="xl"
                          color="brand.fg"
                        >
                          person
                        </Box>
                      </Box>
                    )}
                    <Box flex={1}>
                      <label
                        htmlFor="mobile-board-composer"
                        className="sr-only"
                      >
                        {activeTab === "hype"
                          ? "Share the hype"
                          : "Pin something memorable"}
                      </label>
                      <Textarea
                        id="mobile-board-composer"
                        name="content"
                        placeholder={
                          activeTab === "hype"
                            ? "Share the hype..."
                            : "Pin something memorable..."
                        }
                        size="lg"
                        minH={{ base: "100px", md: "120px" }}
                        p={4}
                        border="none"
                        borderRadius="xl"
                        bg="bg.muted"
                        color="fg.default"
                        _focus={{
                          bg: "bg.surface",
                          boxShadow: "0 0 0 2px var(--c-orange)",
                          outline: "none",
                        }}
                        required
                        disabled={submitting || isUploadingImage}
                        fontFamily="body"
                      />

                      {activeTab === "memory" && (
                        <Box mt={3}>
                          {memoryImage ? (
                            <Flex
                              align="center"
                              gap={3}
                              bg="bg.muted"
                              p={2}
                              borderRadius="md"
                              position="relative"
                            >
                              <Box
                                w="40px"
                                h="40px"
                                borderRadius="sm"
                                overflow="hidden"
                              >
                                <Image
                                  src={URL.createObjectURL(memoryImage)}
                                  alt={`Selected image preview: ${memoryImage.name}`}
                                  w="100%"
                                  h="100%"
                                  objectFit="cover"
                                />
                              </Box>
                              <Text
                                fontSize="xs"
                                color="fg.subtle"
                                lineClamp={1}
                                flex={1}
                              >
                                {memoryImage.name}
                              </Text>
                              <Button
                                type="button"
                                variant="ghost"
                                bg="transparent"
                                onClick={() => setMemoryImage(null)}
                                w={{ base: "40px", md: "32px" }}
                                h={{ base: "40px", md: "32px" }}
                                minW={{ base: "40px", md: "32px" }}
                                p={0}
                                cursor="pointer"
                              >
                                <Box
                                  className="material-symbols-outlined"
                                  fontSize="sm"
                                >
                                  close
                                </Box>
                              </Button>
                            </Flex>
                          ) : (
                            <label
                              htmlFor="mobile-image-upload"
                              style={{ cursor: "pointer" }}
                            >
                              <Button
                                as="span"
                                variant="outline"
                                size="sm"
                                borderRadius="full"
                                gap={2}
                                borderColor="border.subtle"
                                _hover={{ bg: "bg.muted" }}
                              >
                                <Box
                                  className="material-symbols-outlined"
                                  fontSize="sm"
                                >
                                  image
                                </Box>
                                Attach Image
                                <input
                                  id="mobile-image-upload"
                                  type="file"
                                  accept="image/*"
                                  style={{ display: "none" }}
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      setMemoryImage(e.target.files[0]);
                                    }
                                  }}
                                />
                              </Button>
                            </label>
                          )}
                        </Box>
                      )}

                      <Flex justify="flex-end" mt={3} gap={3}>
                        <Button
                          type="button"
                          onClick={async (e) => {
                            const textarea =
                              e.currentTarget.parentElement?.parentElement?.querySelector(
                                "textarea",
                              );
                            if (textarea && textarea.value.trim()) {
                              let imageUrl = null;
                              if (memoryImage && activeTab === "memory") {
                                setIsUploadingImage(true);
                                try {
                                  const compressedBlob =
                                    await compressImage(memoryImage);
                                  const fileName = `${user?.student_id}-${Math.random()}-${Date.now()}.jpg`;
                                  const filePath = `${fileName}`;

                                  const { error: uploadError } =
                                    await supabase.storage
                                      .from("board_media")
                                      .upload(filePath, compressedBlob, {
                                        contentType: "image/jpeg",
                                        cacheControl: "3600",
                                        upsert: true,
                                      });

                                  if (!uploadError) {
                                    const { data: publicUrlData } =
                                      supabase.storage
                                        .from("board_media")
                                        .getPublicUrl(filePath);
                                    imageUrl = publicUrlData.publicUrl;
                                  } else {
                                    console.error("Upload Error", uploadError);
                                  }
                                } catch (err) {
                                  console.error(
                                    "Compression/Upload Error",
                                    err,
                                  );
                                } finally {
                                  setIsUploadingImage(false);
                                }
                              }

                              await handleCreatePost(
                                textarea.value.trim(),
                                [],
                                false,
                                imageUrl,
                              );
                              textarea.value = "";
                              setMemoryImage(null);
                              setIsMobileComposerOpen(false);
                            }
                          }}
                          disabled={submitting || isUploadingImage}
                          bg="var(--c-chocolate)"
                          color="white"
                          borderRadius="full"
                          px={6}
                          _hover={{
                            bg: "var(--c-chocolate-dark)",
                            transform: "translateY(-1px)",
                          }}
                          _active={{
                            bg: "var(--c-chocolate-dark)",
                            transform: "scale(0.98)",
                          }}
                          _disabled={{ opacity: 0.6, cursor: "not-allowed" }}
                        >
                          {submitting || isUploadingImage ? (
                            <Spinner size="sm" color="white" />
                          ) : (
                            <Text fontWeight="600" fontFamily="heading">
                              Post
                            </Text>
                          )}
                        </Button>
                      </Flex>
                    </Box>
                  </Flex>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}
    </Box>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function JellyScrollLoader() {
  const shouldReduceMotion = useReducedMotion() ?? false;
  return (
    <VStack gap={3} align="center" py={4}>
      <motion.div
        animate={shouldReduceMotion ? {} : { scale: [0.95, 1.05, 0.95] }}
        transition={
          shouldReduceMotion
            ? {}
            : { repeat: Infinity, duration: 1.5, ease: "easeInOut" }
        }
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Box
          w="36px"
          h="36px"
          borderRadius="full"
          border="4px solid rgba(197, 224, 230, 0.3)"
          borderTopColor="var(--c-chocolate)"
          className="spin-loader"
        />
      </motion.div>
      <motion.div
        animate={shouldReduceMotion ? {} : { opacity: [0.4, 1, 0.4] }}
        transition={
          shouldReduceMotion
            ? {}
            : { repeat: Infinity, duration: 1.5, ease: "easeInOut" }
        }
      >
        <Text
          fontSize="xs"
          fontWeight="600"
          color="var(--c-chocolate)"
          fontFamily="body"
        >
          Fetching more vibes...
        </Text>
      </motion.div>
    </VStack>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <Button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      display="inline-flex"
      alignItems="center"
      gap={2}
      px={{ base: 4, md: 6 }}
      py={2.5}
      borderRadius="full"
      fontSize="sm"
      fontWeight="600"
      letterSpacing="0.03em"
      cursor="pointer"
      transition="all 0.3s var(--ease-out-quart)"
      bg={active ? "accent.solid" : "transparent"}
      color={active ? "white" : "fg.subtle"}
      _hover={{ bg: active ? "accent.solid" : "bg.hero" }}
      minH="44px"
    >
      <Box className="material-symbols-outlined" fontSize="lg">
        {icon}
      </Box>
      <Text display={{ base: "none", sm: "block" }}>{label}</Text>
    </Button>
  );
}

interface HypeCardProps {
  post: DBPost;
  index: number;
  onLike: (id: number) => void;
  onPin?: (postId: number, currentStatus: boolean) => Promise<void>;
  onDelete?: (postId: number) => Promise<void>;
  currentUserRole?: string;
  onInspectUser?: (userId: string) => void;
}

interface Comment {
  id: number;
  post_id: number;
  student_id: string;
  content: string;
  created_at: string;
  author: {
    student_id: string;
    nickname: string | null;
    avatar_color: string;
    role: string;
    profile_pic_url: string | null;
  };
}

interface CommentSectionProps {
  post: DBPost;
  borderStyle?: string;
  avatarSize?: string;
  avatarFontSize?: string;
}

function CommentSection({
  post,
  borderStyle = "solid",
  avatarSize = "28px",
  avatarFontSize = "2xs",
}: CommentSectionProps) {
  const { user } = useUser();
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    let active = true;

    // 1. Fetch initial comments
    const loadComments = async () => {
      setCommentsLoading(true);
      try {
        const { data, error } = await supabase
          .from("post_comments")
          .select(
            "*, author:users(student_id, nickname, avatar_color, role, profile_pic_url)",
          )
          .eq("post_id", post.id)
          .order("created_at", { ascending: true });
        if (error) throw error;
        if (active && data) {
          setComments(data);
        }
      } catch (err) {
        console.error(`Error loading comments for post ${post.id}:`, err);
      } finally {
        if (active) setCommentsLoading(false);
      }
    };

    loadComments();

    // 2. Realtime channel setup
    const channelName = "comments-" + String(post.id);
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "post_comments",
          filter: "post_id=eq." + String(post.id),
        },
        async (payload) => {
          const { data, error } = await supabase
            .from("post_comments")
            .select(
              "*, author:users(student_id, nickname, avatar_color, role, profile_pic_url)",
            )
            .eq("id", payload.new.id)
            .single();

          if (!error && data && active) {
            setComments((prev) => {
              if (prev.some((c) => c.id === data.id)) return prev;
              return [...prev, data as unknown as Comment];
            });
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "post_comments",
          filter: "post_id=eq." + String(post.id),
        },
        (payload) => {
          if (active) {
            setComments((prev) => prev.filter((c) => c.id !== payload.old.id));
          }
        },
      );

    channel.subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [post.id]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !user) return;

    setSubmittingComment(true);
    try {
      const { data, error } = await supabase
        .from("post_comments")
        .insert({
          post_id: post.id,
          student_id: user.student_id,
          content: newCommentText.trim(),
        })
        .select(
          "*, author:users(student_id, nickname, avatar_color, role, profile_pic_url)",
        )
        .single();

      if (error) throw error;
      if (data) {
        setComments((prev) => {
          if (prev.some((c) => c.id === data.id)) return prev;
          return [...prev, data as unknown as Comment];
        });
        setNewCommentText("");
      }
    } catch (err) {
      console.error("Error adding comment:", err);
      toaster.create({ title: "Failed to add comment", type: "error" });
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!user) return;
    try {
      const { error } = await supabase.rpc("delete_comment_secure", {
        p_comment_id: commentId,
        p_student_id: user.student_id,
        p_pin_hash: user.pin_hash || "",
      });
      if (error) throw error;
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      toaster.create({ title: "Comment deleted", type: "success" });
    } catch (err) {
      console.error("Error deleting comment:", err);
      toaster.create({ title: "Failed to delete comment", type: "error" });
    }
  };

  return (
    <VStack
      align="stretch"
      gap={3}
      mt={4}
      pt={4}
      borderTop="1px"
      borderStyle={borderStyle}
      borderColor="border.subtle"
    >
      <Text
        fontSize="xs"
        fontWeight="700"
        color="fg.muted"
        textTransform="uppercase"
        letterSpacing="0.05em"
      >
        Comments ({post.comment_count})
      </Text>

      {commentsLoading ? (
        <Flex justify="center" py={2}>
          <Spinner size="xs" color="var(--c-lagoon)" />
        </Flex>
      ) : comments.length === 0 ? (
        <Text fontSize="xs" color="fg.subtle">
          No comments yet. Be the first to comment!
        </Text>
      ) : (
        <VStack align="stretch" gap={2}>
          {comments.map((comment) => {
            const isCommentStaff = comment.author?.role !== "student";
            const commentPrefix = isCommentStaff ? "P' " : "";
            const isCommentAuthor =
              user && user.student_id === comment.student_id;
            const isUserStaffOrAdmin = user && user.role !== "student";

            return (
              <Flex
                key={comment.id}
                gap={2}
                p={2.5}
                bg="bg.hero"
                borderRadius="xl"
                align="start"
              >
                <Box
                  w={avatarSize}
                  h={avatarSize}
                  borderRadius="full"
                  bg={
                    comment.author?.profile_pic_url
                      ? "transparent"
                      : comment.author?.avatar_color || "var(--c-muted-brown)"
                  }
                  color="white"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  fontSize={avatarFontSize}
                  fontWeight="700"
                  flexShrink={0}
                  overflow="hidden"
                >
                  {comment.author?.profile_pic_url ? (
                    <Image
                      src={comment.author.profile_pic_url}
                      alt={
                        comment.author.nickname
                          ? `${comment.author.nickname}'s profile picture`
                          : "User's profile picture"
                      }
                      w="100%"
                      h="100%"
                      objectFit="cover"
                      loading="lazy"
                    />
                  ) : (
                    getInitials(comment.author?.nickname || comment.student_id)
                  )}
                </Box>
                <VStack align="start" gap={0.5} flex={1}>
                  <HStack gap={1.5} flexWrap="wrap">
                    <Text fontSize="xs" fontWeight="700" color="fg.default">
                      {commentPrefix}
                      {comment.author?.nickname || "Student"}
                    </Text>
                    <Badge
                      colorPalette={
                        comment.author?.role === "moderator"
                          ? "red"
                          : comment.author?.role === "staff"
                            ? "orange"
                            : comment.author?.role === "media_admin"
                              ? "blue"
                              : "gray"
                      }
                      fontSize="3xs"
                    >
                      {comment.author?.role || "student"}
                    </Badge>
                    <Text fontSize="3xs" color="fg.subtle">
                      {getRelativeTime(comment.created_at)}
                    </Text>
                  </HStack>
                  <Text fontSize="xs" color="fg.default" lineHeight={1.4}>
                    {comment.content}
                  </Text>
                </VStack>

                {(isCommentAuthor || isUserStaffOrAdmin) && (
                  <Button
                    type="button"
                    onClick={() => handleDeleteComment(comment.id)}
                    variant="ghost"
                    bg="transparent"
                    color="var(--c-error)"
                    w={{ base: "40px", md: "32px" }}
                    h={{ base: "40px", md: "32px" }}
                    minW={{ base: "40px", md: "32px" }}
                    p={0}
                    cursor="pointer"
                  >
                    <Box className="material-symbols-outlined" fontSize="sm">
                      delete
                    </Box>
                  </Button>
                )}
              </Flex>
            );
          })}
        </VStack>
      )}

      {user ? (
        <Flex
          as="form"
          onSubmit={handleAddComment}
          gap={2}
          align="center"
          mt={2}
        >
          <Input
            placeholder="Write a comment..."
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            h="36px"
            borderRadius="lg"
            border="1px solid"
            borderColor="border.subtle"
            bg="bg.surface"
            fontSize="xs"
            _focus={{ borderColor: "var(--c-lagoon)" }}
            required
          />
          <Button
            type="submit"
            loading={submittingComment}
            bg="accent.solid"
            color="white"
            h="36px"
            px={4}
            borderRadius="lg"
            fontSize="xs"
            fontWeight="700"
            cursor="pointer"
          >
            Send
          </Button>
        </Flex>
      ) : (
        <Text fontSize="2xs" color="fg.subtle">
          Sign in to comment.
        </Text>
      )}
    </VStack>
  );
}

export const HypeCard = memo(function HypeCard({
  post,
  index,
  onLike,
  currentUserRole,
  onInspectUser,
  onPin,
  onDelete,
}: HypeCardProps) {
  const { user } = useUser();
  const serverLiked = !!(user && post.liked_by?.includes(user.student_id));
  const [localLiked, setLocalLiked] = useState(serverLiked);
  const [localLikesCount, setLocalLikesCount] = useState(post.likes);
  const [showComments, setShowComments] = useState(false);
  const [prevServerLiked, setPrevServerLiked] = useState(serverLiked);
  const [prevPostLikes, setPrevPostLikes] = useState(post.likes);

  if (serverLiked !== prevServerLiked) {
    setLocalLiked(serverLiked);
    setPrevServerLiked(serverLiked);
  }
  if (post.likes !== prevPostLikes) {
    setLocalLikesCount(post.likes);
    setPrevPostLikes(post.likes);
  }

  const handleLike = () => {
    if (!user) return;
    setLocalLiked(!localLiked);
    setLocalLikesCount((prev) =>
      localLiked ? Math.max(0, prev - 1) : prev + 1,
    );
    onLike(post.id);
  };

  const isAnon = post.is_anonymous;
  const isStaff = post.author.role !== "student";
  const prefix = isStaff ? "P' " : "";

  const displayAuthorName =
    isAnon && currentUserRole !== "moderator"
      ? "Anonymous"
      : `${prefix}${post.author.nickname || "Guest Whitelist"}`;
  const displayAuthorInitials =
    isAnon && currentUserRole !== "moderator" ? (
      <Box
        as="span"
        className="material-symbols-outlined"
        fontSize="inherit"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        person
      </Box>
    ) : (
      getInitials(displayAuthorName)
    );
  const displayAvatarColor =
    isAnon && currentUserRole !== "moderator"
      ? "var(--c-muted-brown)"
      : post.author.avatar_color;

  return (
    <Box
      bg="bg.surface"
      border="1px solid"
      borderColor="border.subtle"
      borderRadius="2xl"
      p={{ base: 4, md: 5 }}
      mb="24px"
      transition="all 0.3s var(--ease-out-quart)"
      animation={`fade-in-up 0.5s var(--ease-out-expo) ${Math.min(0.1 + index * 0.05, 0.4)}s both`}
      _hover={{
        transform: "translateY(-2px)",
        boxShadow: "var(--shadow-card-hover)",
      }}
    >
      <Flex
        align="center"
        gap={3}
        mb={3}
        as={!isAnon && onInspectUser ? "button" : "div"}
        role={!isAnon && onInspectUser ? "button" : undefined}
        tabIndex={!isAnon && onInspectUser ? 0 : undefined}
        onClick={() => {
          if (!isAnon && onInspectUser) onInspectUser(post.author.student_id);
        }}
        cursor={!isAnon && onInspectUser ? "pointer" : "default"}
        textAlign="left"
        _focusVisible={
          !isAnon && onInspectUser
            ? {
                outline: "2px solid var(--c-orange)",
                outlineOffset: "2px",
                borderRadius: "md",
              }
            : undefined
        }
      >
        <Box
          w={{ base: 8, md: 10 }}
          h={{ base: 8, md: 10 }}
          borderRadius="full"
          bg={
            (!isAnon || currentUserRole === "moderator") &&
            post.author.profile_pic_url
              ? "transparent"
              : displayAvatarColor
          }
          display="flex"
          alignItems="center"
          justifyContent="center"
          fontSize="sm"
          fontWeight="700"
          color="white"
          overflow="hidden"
        >
          {(!isAnon || currentUserRole === "moderator") &&
          post.author.profile_pic_url ? (
            <Image
              src={post.author.profile_pic_url}
              alt={
                isAnon
                  ? "Anonymous user's profile picture"
                  : `${post.author.nickname || "User"}'s profile picture`
              }
              w="100%"
              h="100%"
              objectFit="cover"
              loading="lazy"
            />
          ) : (
            displayAuthorInitials
          )}
        </Box>
        <VStack align="start" gap={0} flex={1}>
          <Text
            fontSize="sm"
            fontWeight="700"
            color="fg.default"
            display="inline-flex"
            gap={1}
            flexWrap="wrap"
          >
            {displayAuthorName}
            {isAnon && currentUserRole === "moderator" && (
              <Badge colorPalette="orange" fontSize="3xs" alignSelf="center">
                Anonymous (ID: {post.student_id})
              </Badge>
            )}
            {!isAnon && isStaff && (
              <Badge colorPalette="teal" fontSize="3xs" alignSelf="center">
                {post.author.role}
              </Badge>
            )}
          </Text>
          <Text fontSize="2xs" color="fg.subtle">
            {getRelativeTime(post.createdAt)}
          </Text>
        </VStack>
        <Box
          px={2.5}
          py={0.5}
          borderRadius="full"
          fontSize="2xs"
          fontWeight="600"
          bg={
            post.tags && post.tags.includes("#Hype")
              ? "brand.muted"
              : post.tags && post.tags.includes("#Question")
                ? "bg.hero"
                : post.tags && post.tags.includes("#Memory")
                  ? "brand.subtle"
                  : "accent.subtle"
          }
          color={
            post.tags && post.tags.includes("#Hype") ? "brand.fg" : "fg.default"
          }
        >
          {post.tags && post.tags.length > 0
            ? post.tags.join(", ")
            : "orientation"}
        </Box>
      </Flex>
      <Text fontSize="sm" color="fg.default" lineHeight={1.6} mb={3}>
        {post.content}
      </Text>
      <Flex gap={4} align="center">
        <Button
          type="button"
          role="group"
          color={localLiked ? "accent.solid" : "fg.subtle"}
          bg={{
            base: "transparent",
            md: localLiked ? "bg.hero" : "transparent",
          }}
          border="1px solid"
          borderColor={localLiked ? "accent.solid" : "border.subtle"}
          h={{ base: "40px", md: "32px" }}
          w={{ base: "40px", md: "auto" }}
          minW={{ base: "40px", md: "auto" }}
          px={{ base: 0, md: 3 }}
          borderRadius="full"
          onClick={(e) => {
            e.stopPropagation();
            handleLike();
          }}
          disabled={!user}
          _hover={{
            bg: "bg.hero",
            color: "accent.solid",
            borderColor: "accent.solid",
          }}
        >
          <Box
            className={`material-symbols-outlined ${localLiked ? "fill" : ""}`}
            fontSize="sm"
            transition="transform 0.2s"
            _groupHover={{ transform: "scale(1.1)" }}
          >
            favorite
          </Box>
          <Text
            fontSize="xs"
            fontWeight="600"
            ml={1}
            display={{ base: "none", md: "block" }}
          >
            {localLikesCount > 0 ? localLikesCount : "Like"}
          </Text>
        </Button>
        <Button
          type="button"
          aria-label={showComments ? "Collapse comments" : "Expand comments"}
          aria-expanded={showComments}
          onClick={() => setShowComments(!showComments)}
          color="fg.subtle"
          bg="transparent"
          border="none"
          p={1}
          minH="44px"
          minW="44px"
          display="flex"
          alignItems="center"
          gap={1}
        >
          <Box className="material-symbols-outlined" fontSize="lg">
            chat_bubble
          </Box>
          <Text fontSize="xs" fontWeight="600">
            {post.comment_count}
          </Text>
        </Button>
      </Flex>

      {/* Admin Controls */}
      {currentUserRole && currentUserRole !== "student" ? (
        <HStack position="absolute" top={3} right={3} gap={1} zIndex={3}>
          <Button
            type="button"
            variant="ghost"
            bg="transparent"
            w={{ base: "40px", md: "32px" }}
            h={{ base: "40px", md: "32px" }}
            minW={{ base: "40px", md: "32px" }}
            p={0}
            borderRadius="full"
            onClick={(e) => {
              e.stopPropagation();
              if (onPin) onPin(post.id, post.is_pinned ?? false);
            }}
            color={post.is_pinned ? "accent.solid" : "fg.subtle"}
            _hover={{ bg: "bg.hero" }}
          >
            <Box className="material-symbols-outlined" fontSize="sm">
              push_pin
            </Box>
          </Button>
          <Button
            type="button"
            variant="ghost"
            bg="transparent"
            w={{ base: "40px", md: "32px" }}
            h={{ base: "40px", md: "32px" }}
            minW={{ base: "40px", md: "32px" }}
            p={0}
            borderRadius="full"
            color="red.500"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm("Confirm delete?")) {
                if (onDelete) onDelete(post.id);
              }
            }}
            _hover={{ bg: "red.50" }}
          >
            <Box className="material-symbols-outlined" fontSize="sm">
              delete
            </Box>
          </Button>
        </HStack>
      ) : null}

      {showComments && (
        <CommentSection
          post={post}
          borderStyle="solid"
          avatarSize="28px"
          avatarFontSize="2xs"
        />
      )}
    </Box>
  );
});

interface MemoryCardProps {
  post: DBPost;
  index: number;
  onLike: (id: number) => void;
  onPin?: (postId: number, currentStatus: boolean) => Promise<void>;
  onDelete?: (postId: number) => Promise<void>;
  currentUserRole?: string;
  onInspectUser?: (userId: string) => void;
}

const MemoryCard = memo(function MemoryCard({
  post,
  index,
  onLike,
  currentUserRole,
  onInspectUser,
  onPin,
  onDelete,
}: MemoryCardProps) {
  const { user } = useUser();
  const serverLiked = !!(user && post.liked_by?.includes(user.student_id));
  const [localLiked, setLocalLiked] = useState(serverLiked);
  const [localLikesCount, setLocalLikesCount] = useState(post.likes);
  const [showComments, setShowComments] = useState(false);
  const [prevServerLiked, setPrevServerLiked] = useState(serverLiked);
  const [prevPostLikes, setPrevPostLikes] = useState(post.likes);

  if (serverLiked !== prevServerLiked) {
    setLocalLiked(serverLiked);
    setPrevServerLiked(serverLiked);
  }
  if (post.likes !== prevPostLikes) {
    setLocalLikesCount(post.likes);
    setPrevPostLikes(post.likes);
  }

  const handleLike = () => {
    if (!user) return;
    setLocalLiked(!localLiked);
    setLocalLikesCount((prev) =>
      localLiked ? Math.max(0, prev - 1) : prev + 1,
    );
    onLike(post.id);
  };

  const rotations = [-2, 1.5, -1, 2, -0.5];
  const rotation = rotations[index % rotations.length];

  const isAnon = post.is_anonymous;
  const isStaff = post.author.role !== "student";
  const prefix = isStaff ? "P' " : "";

  const displayAuthorName =
    isAnon && currentUserRole !== "moderator"
      ? "Anonymous"
      : `${prefix}${post.author.nickname || "Guest Whitelist"}`;
  const displayAuthorInitials =
    isAnon && currentUserRole !== "moderator" ? (
      <Box
        as="span"
        className="material-symbols-outlined"
        fontSize="inherit"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        person
      </Box>
    ) : (
      getInitials(displayAuthorName)
    );
  const displayAvatarColor =
    isAnon && currentUserRole !== "moderator"
      ? "var(--c-muted-brown)"
      : post.author.avatar_color;

  return (
    <Box
      bg={
        isStaff
          ? "color-mix(in srgb, var(--c-chocolate) 4%, var(--c-white))"
          : "bg.surface"
      }
      border={
        isStaff
          ? "1px solid color-mix(in srgb, var(--c-chocolate) 20%, transparent)"
          : "1px dashed"
      }
      borderColor={isStaff ? undefined : "border.default"}
      borderRadius="xl"
      p={{ base: 4, md: 5 }}
      position="relative"
      mb="24px"
      transform={{ base: "none", md: `rotate(${rotation}deg)` }}
      transition="all 0.3s var(--ease-out-quart)"
      animation={`fade-in-up 0.5s var(--ease-out-expo) ${Math.min(0.1 + index * 0.05, 0.5)}s both`}
      _hover={{
        transform: "rotate(0deg) translateY(-4px)",
        boxShadow: "var(--shadow-card-hover)",
        zIndex: 10,
      }}
    >
      <Box
        position="absolute"
        top={-2}
        left="50%"
        transform="translateX(-50%)"
        w={4}
        h={4}
        borderRadius="full"
        bg={index % 2 === 0 ? "var(--c-state-pin-a)" : "var(--c-state-pin-b)"}
        boxShadow="0 2px 4px color-mix(in srgb, var(--c-ink) 20%, transparent)"
        zIndex={2}
      />
      <Flex
        align="center"
        gap={2}
        mb={3}
        as={!isAnon && onInspectUser ? "button" : "div"}
        role={!isAnon && onInspectUser ? "button" : undefined}
        tabIndex={!isAnon && onInspectUser ? 0 : undefined}
        onClick={() => {
          if (!isAnon && onInspectUser) onInspectUser(post.author.student_id);
        }}
        cursor={!isAnon && onInspectUser ? "pointer" : "default"}
        textAlign="left"
        _focusVisible={
          !isAnon && onInspectUser
            ? {
                outline: "2px solid var(--c-orange)",
                outlineOffset: "2px",
                borderRadius: "md",
              }
            : undefined
        }
      >
        <Box
          w={8}
          h={8}
          borderRadius="full"
          bg={
            (!isAnon || currentUserRole === "moderator") &&
            post.author.profile_pic_url
              ? "transparent"
              : displayAvatarColor
          }
          display="flex"
          alignItems="center"
          justifyContent="center"
          fontSize="xs"
          fontWeight="700"
          color="white"
          overflow="hidden"
        >
          {(!isAnon || currentUserRole === "moderator") &&
          post.author.profile_pic_url ? (
            <Image
              src={post.author.profile_pic_url}
              alt={
                isAnon
                  ? "Anonymous user's profile picture"
                  : `${post.author.nickname || "User"}'s profile picture`
              }
              w="100%"
              h="100%"
              objectFit="cover"
              loading="lazy"
            />
          ) : (
            displayAuthorInitials
          )}
        </Box>
        <VStack align="start" gap={0} flex={1}>
          <Text
            fontSize="xs"
            fontWeight="700"
            color="fg.default"
            display="inline-flex"
            gap={1}
            flexWrap="wrap"
          >
            {displayAuthorName}
            {isAnon && currentUserRole === "moderator" && (
              <Badge colorPalette="orange" fontSize="3xs" alignSelf="center">
                Anonymous (ID: {post.student_id})
              </Badge>
            )}
            {!isAnon && isStaff && (
              <Badge colorPalette="teal" fontSize="3xs" alignSelf="center">
                {post.author.role}
              </Badge>
            )}
          </Text>
          <Text fontSize="2xs" color="fg.subtle">
            {getRelativeTime(post.createdAt)}
          </Text>
        </VStack>
      </Flex>
      <Text
        fontSize="sm"
        color="fg.default"
        lineHeight={1.6}
        mb={3}
        fontStyle={index % 3 === 0 ? "italic" : "normal"}
        fontFamily={index % 3 === 0 ? "heading" : "body"}
      >
        {post.content}
      </Text>
      {post.image_url && (
        <Box
          mb={3}
          borderRadius="lg"
          overflow="hidden"
          boxShadow="sm"
          maxH="240px"
        >
          <Image
            src={post.image_url}
            alt={`Memory board photo shared by ${isAnon ? "Anonymous" : post.author.nickname || "User"}`}
            w="100%"
            h="100%"
            objectFit="cover"
            loading="lazy"
          />
        </Box>
      )}
      <Flex gap={3} align="center">
        <Button
          type="button"
          role="group"
          color={localLiked ? "accent.solid" : "fg.subtle"}
          bg={{
            base: "transparent",
            md: localLiked ? "bg.hero" : "transparent",
          }}
          border="1px solid"
          borderColor={localLiked ? "accent.solid" : "border.subtle"}
          h={{ base: "40px", md: "32px" }}
          w={{ base: "40px", md: "auto" }}
          minW={{ base: "40px", md: "auto" }}
          px={{ base: 0, md: 3 }}
          borderRadius="full"
          onClick={(e) => {
            e.stopPropagation();
            handleLike();
          }}
          disabled={!user}
          _hover={{
            bg: "bg.hero",
            color: "accent.solid",
            borderColor: "accent.solid",
          }}
        >
          <Box
            className={`material-symbols-outlined ${localLiked ? "fill" : ""}`}
            fontSize="sm"
            transition="transform 0.2s"
            _groupHover={{ transform: "scale(1.1)" }}
          >
            favorite
          </Box>
          <Text
            fontSize="xs"
            fontWeight="600"
            ml={1}
            display={{ base: "none", md: "block" }}
          >
            {localLikesCount > 0 ? localLikesCount : "Like"}
          </Text>
        </Button>
        <Button
          type="button"
          aria-label={showComments ? "Collapse comments" : "Expand comments"}
          aria-expanded={showComments}
          onClick={() => setShowComments(!showComments)}
          color="fg.subtle"
          bg="transparent"
          border="none"
          p={1}
          minH="44px"
          minW="44px"
          display="flex"
          alignItems="center"
          gap={1}
        >
          <Box className="material-symbols-outlined" fontSize="md">
            chat_bubble
          </Box>
          <Text fontSize="2xs" fontWeight="600">
            {post.comment_count}
          </Text>
        </Button>
      </Flex>

      {/* Admin Controls */}
      {currentUserRole && currentUserRole !== "student" ? (
        <HStack position="absolute" top={3} right={3} gap={1} zIndex={3}>
          <Button
            type="button"
            variant="ghost"
            bg="transparent"
            w={{ base: "40px", md: "32px" }}
            h={{ base: "40px", md: "32px" }}
            minW={{ base: "40px", md: "32px" }}
            p={0}
            borderRadius="full"
            onClick={(e) => {
              e.stopPropagation();
              if (onPin) onPin(post.id, post.is_pinned ?? false);
            }}
            color={post.is_pinned ? "accent.solid" : "fg.subtle"}
            _hover={{ bg: "bg.hero" }}
          >
            <Box className="material-symbols-outlined" fontSize="sm">
              push_pin
            </Box>
          </Button>
          <Button
            type="button"
            variant="ghost"
            bg="transparent"
            w={{ base: "40px", md: "32px" }}
            h={{ base: "40px", md: "32px" }}
            minW={{ base: "40px", md: "32px" }}
            p={0}
            borderRadius="full"
            color="red.500"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm("Confirm delete?")) {
                if (onDelete) onDelete(post.id);
              }
            }}
            _hover={{ bg: "red.50" }}
          >
            <Box className="material-symbols-outlined" fontSize="sm">
              delete
            </Box>
          </Button>
        </HStack>
      ) : null}

      {showComments && (
        <CommentSection
          post={post}
          borderStyle="dashed"
          avatarSize="24px"
          avatarFontSize="3xs"
        />
      )}
    </Box>
  );
});
