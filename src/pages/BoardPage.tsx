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
  Portal,
} from "@chakra-ui/react";
import React, { useState, useEffect, useRef, memo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useUser, type User } from "../context/UserContext";
import { motion, useReducedMotion } from "framer-motion";
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
import { UserAvatar } from "../components/UserAvatar";

import { RoughNotation } from "react-rough-notation";

// ─── Sentinel for Infinite Scroll ──────────────────────────────────────────

interface SentinelProps {
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
}

const Sentinel = memo(function Sentinel({
  onLoadMore,
  hasMore,
  isLoading,
}: SentinelProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: "300px" },
    );

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
      observer.disconnect();
    };
  }, [onLoadMore, hasMore, isLoading]);

  return (
    <Box ref={sentinelRef} h="1px" w="100%" pointerEvents="none" opacity={0} />
  );
});

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

interface ParsedElement {
  type: string; // 'text', 'h', 'u', 'c', 's'
  color?: string; // 'yellow', 'pink', 'blue', 'green'
  content: string | ParsedElement[];
}

const parseAccents = (text: string): ParsedElement[] => {
  const parseNested = (txt: string): ParsedElement[] => {
    if (!txt) return [];

    // Match any opening tag: [h], [h-color], [u], [u-color], [c], [c-color], [s], [s-color]
    const openTagRegex = /\[(h|u|c|s)(?:-(yellow|pink|blue|green))?\]/;
    const match = openTagRegex.exec(txt);

    if (!match) {
      return [{ type: "text", content: txt }];
    }

    const startIdx = match.index;
    const fullOpenTag = match[0];
    const tagType = match[1];
    const tagColor = match[2];

    // Find matching close tag
    const closeTagRegex = new RegExp(
      `\\[\\/(?:${tagType}|${tagType}-${tagColor || "yellow|pink|blue|green"})\\]`,
      "g",
    );
    closeTagRegex.lastIndex = startIdx + fullOpenTag.length;

    const closeMatch = closeTagRegex.exec(txt);
    if (!closeMatch) {
      const plainPart = txt.substring(0, startIdx + fullOpenTag.length);
      return [
        { type: "text", content: plainPart },
        ...parseNested(txt.substring(startIdx + fullOpenTag.length)),
      ];
    }

    const closeIdx = closeMatch.index;
    const fullCloseTag = closeMatch[0];

    const innerText = txt.substring(startIdx + fullOpenTag.length, closeIdx);
    const beforeText = txt.substring(0, startIdx);
    const afterText = txt.substring(closeIdx + fullCloseTag.length);

    const result: ParsedElement[] = [];
    if (beforeText) {
      result.push(...parseNested(beforeText));
    }

    result.push({
      type: tagType,
      color: tagColor,
      content: parseNested(innerText),
    });

    if (afterText) {
      result.push(...parseNested(afterText));
    }

    return result;
  };

  return parseNested(text);
};
const renderParsedAccents = (elements: ParsedElement[]): React.ReactNode => {
  return elements.map((part, index) => {
    const key = `${part.type}-${index}`;
    if (part.type === "text") {
      return <span key={key}>{part.content as string}</span>;
    }

    let notationType: "highlight" | "underline" | "circle" | "strike-through" =
      "highlight";
    let color = "rgba(251, 211, 141, 0.5)"; // default yellow

    const resolvedColor = part.color || "yellow"; // default to yellow if not specified

    if (part.type === "h") {
      notationType = "highlight";
      if (resolvedColor === "yellow") color = "rgba(251, 211, 141, 0.5)";
      else if (resolvedColor === "pink") color = "rgba(255, 182, 193, 0.5)";
      else if (resolvedColor === "blue") color = "rgba(173, 216, 230, 0.5)";
      else if (resolvedColor === "green") color = "rgba(152, 251, 152, 0.5)";
    } else if (part.type === "u") {
      notationType = "underline";
      if (resolvedColor === "yellow") color = "rgba(251, 211, 141, 0.85)";
      else if (resolvedColor === "pink") color = "rgba(255, 182, 193, 0.85)";
      else if (resolvedColor === "blue") color = "rgba(173, 216, 230, 0.85)";
      else if (resolvedColor === "green") color = "rgba(152, 251, 152, 0.85)";
    } else if (part.type === "c") {
      notationType = "circle";
      if (resolvedColor === "yellow") color = "rgba(251, 211, 141, 0.8)";
      else if (resolvedColor === "pink") color = "rgba(255, 182, 193, 0.8)";
      else if (resolvedColor === "blue") color = "rgba(173, 216, 230, 0.8)";
      else if (resolvedColor === "green") color = "rgba(152, 251, 152, 0.8)";
    } else if (part.type === "s") {
      notationType = "strike-through";
      if (resolvedColor === "yellow") color = "rgba(251, 211, 141, 0.7)";
      else if (resolvedColor === "pink") color = "rgba(255, 182, 193, 0.7)";
      else if (resolvedColor === "blue") color = "rgba(173, 216, 230, 0.7)";
      else if (resolvedColor === "green") color = "rgba(152, 251, 152, 0.7)";
    }

    return (
      <span
        key={key}
        style={{
          display: "inline",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        <RoughNotation
          type={notationType}
          color={color}
          show={true}
          strokeWidth={2.5}
          animationDuration={800}
        >
          <span
            style={{
              fontWeight: 600,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {renderParsedAccents(part.content as ParsedElement[])}
          </span>
        </RoughNotation>
      </span>
    );
  });
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
        <UserAvatar
          src={message.sender_profile_pic_url}
          name={message.sender_nickname}
          avatarColor={message.sender_avatar_color}
          size="28px"
          fontSize="2xs"
          onClick={() => onInspectUser(message.sender_id)}
          cursor="pointer"
        />

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
                ? "accent.solid"
                : isSenderStaff
                  ? "color-mix(in srgb, var(--chakra-colors-accent-solid) 6%, var(--chakra-colors-white))"
                  : "bg.muted"
            }
            color={isMe ? "white" : "fg.default"}
            border={isMe ? "none" : "1px solid"}
            borderColor={
              isMe
                ? undefined
                : isSenderStaff
                  ? "color-mix(in srgb, var(--chakra-colors-accent-solid) 20%, transparent)"
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
  const shouldReduceMotion = useReducedMotion() ?? false;
  const [chatInput, setChatInput] = useState("");
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [activeColor, setActiveColor] = useState<
    "yellow" | "pink" | "blue" | "green"
  >("yellow");

  const insertMarkupTag = (tagType: "h" | "u" | "c" | "s") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    const startTag =
      activeColor === "yellow" ? `[${tagType}]` : `[${tagType}-${activeColor}]`;
    const endTag =
      activeColor === "yellow"
        ? `[/${tagType}]`
        : `[/${tagType}-${activeColor}]`;

    const selectedText = text.substring(start, end);

    // Check if selectedText is already wrapped by this tag (any color)
    const openTagPattern = new RegExp(
      `^\\[${tagType}(?:-(yellow|pink|blue|green))?\\]`,
    );
    const closeTagPattern = new RegExp(
      `\\[\\/${tagType}(?:-(yellow|pink|blue|green))?\\]$`,
    );

    if (
      openTagPattern.test(selectedText) &&
      closeTagPattern.test(selectedText)
    ) {
      const strippedText = selectedText
        .replace(openTagPattern, "")
        .replace(closeTagPattern, "");
      const newText =
        text.substring(0, start) + strippedText + text.substring(end);
      setNewPostText(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start + strippedText.length);
      }, 50);
      return;
    }

    // Check if surrounding text contains the tags
    const beforeStr = text.substring(0, start);
    const afterStr = text.substring(end);

    const surroundingOpenPattern = new RegExp(
      `\\[${tagType}(?:-(yellow|pink|blue|green))?\\]$`,
    );
    const surroundingClosePattern = new RegExp(
      `^\\[\\/${tagType}(?:-(yellow|pink|blue|green))?\\]`,
    );

    const openMatch = beforeStr.match(surroundingOpenPattern);
    const closeMatch = afterStr.match(surroundingClosePattern);

    if (openMatch && closeMatch) {
      const newBefore = beforeStr.substring(
        0,
        beforeStr.length - openMatch[0].length,
      );
      const newAfter = afterStr.substring(closeMatch[0].length);
      const newText = newBefore + selectedText + newAfter;
      setNewPostText(newText);
      const newStart = start - openMatch[0].length;
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newStart, newStart + selectedText.length);
      }, 50);
      return;
    }

    // Wrap with new tag
    const replacement = startTag + selectedText + endTag;
    const newText =
      text.substring(0, start) + replacement + text.substring(end);
    setNewPostText(newText);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos =
        start + startTag.length + selectedText.length + endTag.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 50);
  };

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
    handleDeletePost,
  } = useBoardRealtime("memory", user);

  // Live chat — new hook (only active when on hype tab)
  const {
    messages: chatMessages,
    loading: chatLoading,
    sending: chatSending,
    onlineCount: chatOnlineCount,
    sendMessage,
    deleteMessage,
  } = useLiveChat("hype", user);

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
          const isBucketError =
            uploadError.message?.toLowerCase().includes("bucket not found") ||
            JSON.stringify(uploadError)
              .toLowerCase()
              .includes("bucket not found");
          toaster.create({
            title: "Image upload failed",
            description: isBucketError
              ? "Storage bucket 'board_media' not found. Please create it as a 'Public' bucket in your Supabase dashboard."
              : uploadError.message,
            type: "error",
          });
        }
      } catch (err: unknown) {
        console.error("Compression/Upload Error", err);
        const errorObject = err as Error;
        toaster.create({
          title: "Image upload failed",
          description:
            errorObject?.message || "Check your network or server status.",
          type: "error",
        });
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
        <Spinner size="xl" color="brand.solid" />
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
      minH={{ base: "auto", md: "100vh" }}
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
                <Spinner size="lg" color="brand.solid" />
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
              bg="bg.canvas"
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
                    color="red.500"
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
                        bg="var(--chakra-colors-brand-muted)"
                        color="brand.solid"
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
                        "0 4px 14px color-mix(in srgb, var(--chakra-colors-accent-solid) 25%, transparent)",
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
        <Box maxW="4xl" mx="auto" w="100%" h="auto" maxH="none" minH="auto">
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
                      msOverflowStyle: "none",
                      scrollbarWidth: "none",
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
                    display="block"
                    bg="bg.surface"
                    border="1px solid"
                    borderColor="border.subtle"
                    borderRadius="2xl"
                    p={{ base: 3.5, md: 6 }}
                    animation="fade-in-up 0.6s var(--ease-out-expo) 0.15s both"
                  >
                    <Flex gap={{ base: 3, md: 4 }} align="start">
                      {user ? (
                        <UserAvatar
                          src={user.profile_pic_url}
                          name={user.nickname || user.student_id}
                          avatarColor={user.avatar_color}
                          size={{ base: "40px", md: "48px" }}
                          fontSize="sm"
                        />
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
                        {user && (
                          <Flex align="center" gap={3} mb={2} flexWrap="wrap">
                            <Flex align="center" gap={1.5}>
                              <Text
                                fontSize="xs"
                                fontWeight="700"
                                color="fg.muted"
                                mr={1}
                              >
                                Handcraft Accents:
                              </Text>
                              <HStack gap={1.5} mr={1}>
                                {[
                                  {
                                    name: "yellow",
                                    value: "#FBD38D",
                                    label: "Yellow",
                                  },
                                  {
                                    name: "pink",
                                    value: "#FFB6C1",
                                    label: "Pink",
                                  },
                                  {
                                    name: "blue",
                                    value: "#ADD8E6",
                                    label: "Blue",
                                  },
                                  {
                                    name: "green",
                                    value: "#98FB98",
                                    label: "Green",
                                  },
                                ].map((c) => {
                                  const isSelected = activeColor === c.name;
                                  return (
                                    <Button
                                      key={c.name}
                                      type="button"
                                      variant="ghost"
                                      p={0}
                                      minW="16px"
                                      w="16px"
                                      h="16px"
                                      borderRadius="full"
                                      bg={c.value}
                                      border={
                                        isSelected ? "2px solid" : "1px solid"
                                      }
                                      borderColor={
                                        isSelected
                                          ? "accent.solid"
                                          : "rgba(0,0,0,0.15)"
                                      }
                                      cursor="pointer"
                                      onClick={() =>
                                        setActiveColor(
                                          c.name as
                                            | "yellow"
                                            | "pink"
                                            | "blue"
                                            | "green",
                                        )
                                      }
                                      title={c.label}
                                      aria-label={`Select active color ${c.label}`}
                                      transform={
                                        isSelected ? "scale(1.2)" : "none"
                                      }
                                      transition="all 0.2s"
                                    />
                                  );
                                })}
                              </HStack>
                            </Flex>
                            <HStack gap={1.5}>
                              <Button
                                type="button"
                                size="2xs"
                                variant="ghost"
                                border="1px dashed"
                                borderColor="border.subtle"
                                borderRadius="md"
                                bg="rgba(251, 211, 141, 0.15)"
                                color="fg.default"
                                fontSize="2xs"
                                fontWeight="600"
                                px={2}
                                h="24px"
                                cursor="pointer"
                                onClick={() => insertMarkupTag("h")}
                                _hover={{
                                  bg: "rgba(251, 211, 141, 0.35)",
                                  borderColor: "accent.solid",
                                }}
                              >
                                Highlight
                              </Button>
                              <Button
                                type="button"
                                size="2xs"
                                variant="ghost"
                                border="1px dashed"
                                borderColor="border.subtle"
                                borderRadius="md"
                                bg="rgba(173, 216, 230, 0.15)"
                                color="fg.default"
                                fontSize="2xs"
                                fontWeight="600"
                                px={2}
                                h="24px"
                                cursor="pointer"
                                onClick={() => insertMarkupTag("u")}
                                _hover={{
                                  bg: "rgba(173, 216, 230, 0.35)",
                                  borderColor: "accent.solid",
                                }}
                              >
                                Underline
                              </Button>
                              <Button
                                type="button"
                                size="2xs"
                                variant="ghost"
                                border="1px dashed"
                                borderColor="border.subtle"
                                borderRadius="md"
                                bg="rgba(255, 182, 193, 0.15)"
                                color="fg.default"
                                fontSize="2xs"
                                fontWeight="600"
                                px={2}
                                h="24px"
                                cursor="pointer"
                                onClick={() => insertMarkupTag("c")}
                                _hover={{
                                  bg: "rgba(255, 182, 193, 0.35)",
                                  borderColor: "accent.solid",
                                }}
                              >
                                Circle
                              </Button>
                              <Button
                                type="button"
                                size="2xs"
                                variant="ghost"
                                border="1px dashed"
                                borderColor="border.subtle"
                                borderRadius="md"
                                bg="rgba(152, 251, 152, 0.15)"
                                color="fg.default"
                                fontSize="2xs"
                                fontWeight="600"
                                px={2}
                                h="24px"
                                cursor="pointer"
                                onClick={() => insertMarkupTag("s")}
                                _hover={{
                                  bg: "rgba(152, 251, 152, 0.35)",
                                  borderColor: "accent.solid",
                                }}
                              >
                                Cross-out
                              </Button>
                            </HStack>
                          </Flex>
                        )}
                        <label htmlFor="board-composer" className="sr-only">
                          Pin something new
                        </label>
                        <Textarea
                          ref={textareaRef}
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
                          resize="none"
                          fontSize={{ base: "sm", md: "md" }}
                          color="fg.default"
                          fontFamily="'Mali', sans-serif"
                          bg="bg.surface"
                          border="1px dashed"
                          borderColor="border.subtle"
                          borderRadius="lg"
                          p={3}
                          _focus={{
                            borderColor: "accent.solid",
                            boxShadow: "sm",
                          }}
                          minH="80px"
                          mb={2}
                        />

                        {/* Live Handcrafted Preview Block */}
                        {user && (
                          <Box mt={2} mb={3}>
                            <Text
                              fontSize="2xs"
                              fontWeight="700"
                              color="fg.muted"
                              mb={1}
                              textTransform="uppercase"
                              letterSpacing="0.05em"
                            >
                              Handcrafted Preview:
                            </Text>
                            <Box
                              p={4}
                              bg="#FFFDF6" // Cozy warm cream notebook color
                              border="1px dashed"
                              borderColor="rgba(124, 86, 63, 0.25)"
                              borderRadius="lg"
                              fontFamily="'Mali', sans-serif"
                              fontSize="sm"
                              minH="60px"
                              position="relative"
                              boxShadow="inner"
                              pl="36px"
                              _before={{
                                content: '""',
                                position: "absolute",
                                top: 0,
                                left: "20px",
                                bottom: 0,
                                width: "1px",
                                borderLeft:
                                  "1px solid rgba(220, 100, 100, 0.35)", // Red notebook line margin
                              }}
                            >
                              {newPostText.trim() === "" ? (
                                <Text
                                  color="fg.subtle"
                                  fontStyle="italic"
                                  fontSize="xs"
                                >
                                  Your cozy handwritten post preview will render
                                  here...
                                </Text>
                              ) : (
                                <Box
                                  style={{
                                    display: "inline",
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                  }}
                                >
                                  {renderParsedAccents(
                                    parseAccents(newPostText),
                                  )}
                                </Box>
                              )}
                            </Box>
                          </Box>
                        )}

                        {user && (
                          <VStack align="start" gap={2} my={3} w="100%">
                            <Text
                              fontSize="xs"
                              fontWeight="700"
                              color="fg.muted"
                            >
                              <RoughNotation
                                type="highlight"
                                color="#FBD38D"
                                show={true}
                                padding={2}
                                iterations={1}
                              >
                                Select a Tag (Required):
                              </RoughNotation>
                            </Text>
                            <HStack
                              gap={2}
                              overflowX="auto"
                              whiteSpace="nowrap"
                              w="100%"
                              css={{
                                "&::-webkit-scrollbar": { display: "none" },
                                msOverflowStyle: "none",
                                scrollbarWidth: "none",
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
                                    h="32px"
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
                                    color: "accent.solid",
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
                              bg="bg.surface"
                              color="#2D3748"
                              border="1px solid"
                              borderColor="border.subtle"
                              px={{ base: 4, md: 6 }}
                              py={{ base: 1.5, md: 2 }}
                              borderRadius="xl"
                              fontSize={{ base: "xs", md: "sm" }}
                              fontWeight="700"
                              cursor="pointer"
                              onClick={handleSubmitPost}
                              loading={submitting || isUploadingImage}
                              disabled={
                                !user || !newPostText.trim() || !selectedTag
                              }
                              _hover={{
                                bg: "bg.hero",
                                boxShadow: "sm",
                              }}
                              minH={{ base: "36px", md: "44px" }}
                            >
                              <RoughNotation
                                type="highlight"
                                color="#FBD38D"
                                show={true}
                                padding={4}
                              >
                                Pin it!
                              </RoughNotation>
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
                    <VStack align="stretch" w="100%" gap={6}>
                      <Box
                        display="grid"
                        gridTemplateColumns={{
                          base: "repeat(1, 1fr)",
                          sm: "repeat(2, 1fr)",
                          md: "repeat(3, 1fr)",
                        }}
                        gridAutoRows="minmax(250px, auto)"
                        gridAutoFlow="dense"
                        gap={{ base: 4, md: 6 }}
                        w="100%"
                        mx="auto"
                      >
                        {visiblePosts.map((post: DBPost, index: number) => {
                          const textLength = post.content.length;
                          const hasImage = !!post.image_url;
                          const isPinned = !!post.is_pinned;
                          const isNewest = index === 0;

                          let isWide = false;
                          let isTall = false;

                          if (isPinned) {
                            isWide = true;
                          } else if (isNewest && hasImage) {
                            isWide = true;
                            isTall = true;
                          } else if (textLength > 220) {
                            isWide = true;
                          } else if (hasImage && textLength > 100) {
                            isTall = true;
                          } else {
                            const timeHash = new Date(post.createdAt).getTime();
                            if (timeHash % 5 === 0 && hasImage) {
                              isWide = true;
                            } else if (timeHash % 7 === 0 && hasImage) {
                              isTall = true;
                            }
                          }

                          const gridColumn = isWide
                            ? { base: "span 1", md: "span 2" }
                            : undefined;
                          const gridRow = isTall
                            ? { base: "span 1", md: "span 2" }
                            : undefined;

                          return (
                            <Box
                              key={post.id}
                              gridColumn={gridColumn}
                              gridRow={gridRow}
                              w="100%"
                              h="100%"
                              display="flex"
                            >
                              <motion.div
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
                                        delay: Math.min(
                                          Math.max(
                                            0,
                                            index - prevVisibleCount,
                                          ) * 0.05,
                                          0.3,
                                        ),
                                      }
                                }
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  display: "flex",
                                  flexDirection: "column",
                                }}
                              >
                                <MemoryCard
                                  post={post}
                                  index={index}
                                  onLike={handleLikePost}
                                  onDelete={handleDeletePost}
                                  currentUserRole={user?.role}
                                  onInspectUser={handleInspectUser}
                                  isWide={isWide}
                                  isTall={isTall}
                                />
                              </motion.div>
                            </Box>
                          );
                        })}
                      </Box>
                      <Sentinel
                        onLoadMore={handleLoadMore}
                        hasMore={hasMore}
                        isLoading={isFetchingMore}
                      />
                    </VStack>
                  )}
                </VStack>
              </Box>

              {/* Load More Spinner (Infinite scroll triggers fetching) */}
              {isFetchingMore && (
                <Flex
                  justify="center"
                  py={12}
                  position="relative"
                  zIndex={1}
                  minH="60px"
                >
                  <JellyScrollLoader />
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
        <Portal>
          <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
          <Dialog.Positioner zIndex={2200} px={4}>
            <Dialog.Content
            width={{ base: "100%", md: "520px" }}
            bg="white"
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
                <UserAvatar
                  src={inspectedUser.profile_pic_url}
                  name={inspectedUser.nickname || inspectedUser.student_id}
                  avatarColor={inspectedUser.avatar_color || "accent.muted"}
                  size="100px"
                  fontSize="2xl"
                  boxShadow="md"
                />
                <VStack gap={1} align="center">
                  <Text
                    fontSize="2xl"
                    fontWeight="700"
                    color="accent.solid"
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
        </Portal>
      </Dialog.Root>
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
          borderTopColor="accent.solid"
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
          color="accent.solid"
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
          <Spinner size="xs" color="brand.solid" />
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
                <UserAvatar
                  src={comment.author?.profile_pic_url}
                  name={comment.author?.nickname || comment.student_id}
                  avatarColor={comment.author?.avatar_color || "accent.muted"}
                  size={avatarSize}
                  fontSize={avatarFontSize}
                />
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
                    color="red.500"
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
            _focus={{ borderColor: "brand.solid" }}
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
      ? "accent.muted"
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
                outline: "2px solid var(--chakra-colors-orange-500)",
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
  isWide?: boolean;
  isTall?: boolean;
}

const MemoryCard = memo(function MemoryCard({
  post,
  index,
  onLike,
  currentUserRole,
  onInspectUser,
  onPin,
  onDelete,
  isWide = false,
  isTall = false,
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

  const rotations = [-1, 1, -1.2, 0.8, -0.7, 1.1];
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
      ? "accent.muted"
      : post.author.avatar_color;

  return (
    <Box
      role="group"
      w="100%"
      minW="100%"
      h="100%"
      display="flex"
      flexDirection="column"
      overflow="hidden"
      bg={
        isStaff
          ? "linear-gradient(to bottom right, #f4fcfa, #eefaf7)"
          : "linear-gradient(to bottom right, #fdfbf7, #f7f3eb)"
      }
      border="1px solid"
      borderColor={
        isStaff ? "rgba(13, 148, 136, 0.2)" : "rgba(124, 86, 63, 0.15)"
      }
      borderRadius="2xl"
      px={{ base: 4.5, md: 6 }}
      py={{ base: 4, md: 5 }}
      pb={5}
      position="relative"
      transform={{
        base: `rotate(${rotation * 0.6}deg)`,
        md: `rotate(${rotation}deg)`,
      }}
      transition="all 0.4s cubic-bezier(0.16, 1, 0.3, 1)"
      animation={`fade-in-up 0.5s var(--ease-out-expo) ${Math.min(0.1 + index * 0.05, 0.5)}s both`}
      boxShadow="0 10px 25px -5px rgba(124, 86, 63, 0.05), 0 4px 10px -2px rgba(124, 86, 63, 0.02)"
      _hover={{
        transform: "rotate(0deg) translateY(-6px)",
        boxShadow:
          "0 22px 35px -8px rgba(124, 86, 63, 0.12), 0 8px 18px -4px rgba(124, 86, 63, 0.06)",
        zIndex: 10,
      }}
    >
      <Box
        position="absolute"
        top={0}
        left="50%"
        transform="translateX(-50%) rotate(-3deg) translateY(-10px)"
        w="60px"
        h="20px"
        bg="rgba(255, 223, 137, 0.45)"
        backdropFilter="blur(1px)"
        borderLeft="1px dashed rgba(124, 86, 63, 0.15)"
        borderRight="1px dashed rgba(124, 86, 63, 0.15)"
        boxShadow="0 1px 3px rgba(0, 0, 0, 0.03)"
        zIndex={2}
        transition="all 0.3s ease"
        _groupHover={{
          transform: "translateX(-50%) rotate(0deg) translateY(-8px)",
          bg: "rgba(255, 223, 137, 0.65)",
        }}
      />
      {isWide && post.image_url ? (
        <Flex
          flexDirection={{ base: "column", md: "row" }}
          gap={4}
          flex={1}
          h="100%"
          align="stretch"
        >
          <Flex flexDirection="column" justify="space-between" flex={1.2}>
            <Box>
              <Flex
                align="center"
                gap={2}
                mb={3}
                as={!isAnon && onInspectUser ? "button" : "div"}
                role={!isAnon && onInspectUser ? "button" : undefined}
                tabIndex={!isAnon && onInspectUser ? 0 : undefined}
                onClick={() => {
                  if (!isAnon && onInspectUser)
                    onInspectUser(post.author.student_id);
                }}
                cursor={!isAnon && onInspectUser ? "pointer" : "default"}
                textAlign="left"
                _focusVisible={
                  !isAnon && onInspectUser
                    ? {
                        outline: "2px solid var(--chakra-colors-orange-500)",
                        outlineOffset: "2px",
                        borderRadius: "md",
                      }
                    : undefined
                }
              >
                <UserAvatar
                  src={
                    !isAnon || currentUserRole === "moderator"
                      ? post.author.profile_pic_url
                      : null
                  }
                  name={displayAuthorName}
                  avatarColor={displayAvatarColor}
                  size="32px"
                  fontSize="xs"
                  fallback={displayAuthorInitials}
                />
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
                      <Badge
                        colorPalette="orange"
                        fontSize="3xs"
                        alignSelf="center"
                      >
                        Anonymous (ID: {post.student_id})
                      </Badge>
                    )}
                    {!isAnon && isStaff && (
                      <Badge
                        colorPalette="teal"
                        fontSize="3xs"
                        alignSelf="center"
                      >
                        {post.author.role}
                      </Badge>
                    )}
                  </Text>
                  <Text fontSize="2xs" color="fg.subtle">
                    {getRelativeTime(post.createdAt)}
                  </Text>
                </VStack>
                {post.tags && post.tags.length > 0 && (
                  <Box
                    px={2.5}
                    py={0.5}
                    borderRadius="md"
                    fontSize="2xs"
                    fontWeight="700"
                    fontFamily="'Mali', sans-serif"
                    bg="rgba(124, 86, 63, 0.08)"
                    color="var(--c-chocolate)"
                    border="1px dashed rgba(124, 86, 63, 0.25)"
                    transform="rotate(-2deg)"
                    alignSelf="center"
                  >
                    {post.tags.join(", ")}
                  </Box>
                )}
              </Flex>
              <Text
                fontSize="sm"
                color="fg.default"
                lineHeight={1.6}
                mb={3}
                fontStyle={index % 3 === 0 ? "italic" : "normal"}
                fontFamily="'Mali', sans-serif"
                wordBreak="break-word"
                whiteSpace="pre-wrap"
                overflowWrap="anywhere"
                display="block"
                w="100%"
              >
                <Box
                  as="span"
                  display="block"
                  w="100%"
                  whiteSpace="pre-wrap"
                  wordBreak="break-word"
                  overflowWrap="anywhere"
                >
                  {renderParsedAccents(parseAccents(post.content))}
                </Box>
              </Text>
            </Box>
            <Flex gap={3} align="center" mt="auto">
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
                aria-label={
                  showComments ? "Collapse comments" : "Expand comments"
                }
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
          </Flex>
          <Box
            borderRadius="lg"
            overflow="hidden"
            boxShadow="sm"
            w={{ base: "100%", md: "45%" }}
            minH="180px"
            alignSelf="stretch"
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
        </Flex>
      ) : (
        /* Standard layout (for tall or normal cards) */
        <Flex flexDirection="column" justify="space-between" flex={1} h="100%">
          <Box flex={1} display="flex" flexDirection="column">
            <Flex
              align="center"
              gap={2}
              mb={3}
              as={!isAnon && onInspectUser ? "button" : "div"}
              role={!isAnon && onInspectUser ? "button" : undefined}
              tabIndex={!isAnon && onInspectUser ? 0 : undefined}
              onClick={() => {
                if (!isAnon && onInspectUser)
                  onInspectUser(post.author.student_id);
              }}
              cursor={!isAnon && onInspectUser ? "pointer" : "default"}
              textAlign="left"
              _focusVisible={
                !isAnon && onInspectUser
                  ? {
                      outline: "2px solid var(--chakra-colors-orange-500)",
                      outlineOffset: "2px",
                      borderRadius: "md",
                    }
                  : undefined
              }
            >
              <UserAvatar
                src={
                  !isAnon || currentUserRole === "moderator"
                    ? post.author.profile_pic_url
                    : null
                }
                name={displayAuthorName}
                avatarColor={displayAvatarColor}
                size="32px"
                fontSize="xs"
                fallback={displayAuthorInitials}
              />
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
                    <Badge
                      colorPalette="orange"
                      fontSize="3xs"
                      alignSelf="center"
                    >
                      Anonymous (ID: {post.student_id})
                    </Badge>
                  )}
                  {!isAnon && isStaff && (
                    <Badge
                      colorPalette="teal"
                      fontSize="3xs"
                      alignSelf="center"
                    >
                      {post.author.role}
                    </Badge>
                  )}
                </Text>
                <Text fontSize="2xs" color="fg.subtle">
                  {getRelativeTime(post.createdAt)}
                </Text>
              </VStack>
              {post.tags && post.tags.length > 0 && (
                <Box
                  px={2.5}
                  py={0.5}
                  borderRadius="md"
                  fontSize="2xs"
                  fontWeight="700"
                  fontFamily="'Mali', sans-serif"
                  bg="rgba(124, 86, 63, 0.08)"
                  color="var(--c-chocolate)"
                  border="1px dashed rgba(124, 86, 63, 0.25)"
                  transform="rotate(-2deg)"
                  alignSelf="center"
                >
                  {post.tags.join(", ")}
                </Box>
              )}
            </Flex>
            <Text
              fontSize="sm"
              color="fg.default"
              lineHeight={1.6}
              mb={3}
              fontStyle={index % 3 === 0 ? "italic" : "normal"}
              fontFamily="'Mali', sans-serif"
              wordBreak="break-word"
              whiteSpace="pre-wrap"
              overflowWrap="anywhere"
              display="block"
              w="100%"
            >
              <Box
                as="span"
                display="block"
                w="100%"
                whiteSpace="pre-wrap"
                wordBreak="break-word"
                overflowWrap="anywhere"
              >
                {renderParsedAccents(parseAccents(post.content))}
              </Box>
            </Text>
            {post.image_url && (
              <Box
                mb={3}
                borderRadius="lg"
                overflow="hidden"
                boxShadow="sm"
                maxH={isTall ? "none" : "240px"}
                flex={isTall ? 1 : undefined}
                display={isTall ? "flex" : "block"}
                minH={isTall ? "180px" : undefined}
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
          </Box>
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
              aria-label={
                showComments ? "Collapse comments" : "Expand comments"
              }
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
        </Flex>
      )}

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

      {/* Decorative Modern Quote for Text-only Cards */}
      {!post.image_url && (
        <Box
          position="absolute"
          bottom={showComments ? "auto" : 4}
          top={showComments ? 12 : "auto"}
          right={6}
          fontSize="9xl"
          fontWeight="900"
          fontFamily="Georgia, serif"
          color="rgba(124, 86, 63, 0.04)"
          lineHeight={0.6}
          pointerEvents="none"
          userSelect="none"
          zIndex={1}
        >
          ”
        </Box>
      )}

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
