import React, { useState, useRef, useEffect } from "react";
import {
  Box,
  Flex,
  Heading,
  Text,
  VStack,
  HStack,
  Button,
  Spinner,
  Badge,
  Textarea,
  Image,
  SimpleGrid,
  Portal,
  Dialog,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { UserAvatar } from "../UserAvatar";
import { downloadElementAsPng, uploadElementToSupabaseStorage } from "../../utils/posterExport";
import { toaster } from "../ui/toaster";
import {
  FiDownload,
  FiUpload,
  FiRefreshCw,
  FiGrid,
  FiLayers,
  FiCheck,
  FiHeart,
  FiSmartphone,
  FiMonitor,
  FiChevronLeft,
  FiChevronRight,
  FiTv,
  FiZoomIn,
  FiZoomOut,
  FiMaximize2,
  FiFilter,
  FiAlertCircle,
} from "react-icons/fi";

interface MemoryPostItem {
  id: number;
  content: string;
  image_url: string | null;
  likes: number;
  created_at: string;
  is_anonymous: boolean;
  type?: string;
  author: {
    student_id: string;
    nickname: string | null;
    avatar_color: string;
    role: string;
    profile_pic_url: string | null;
    faculty?: string | null;
  };
}

interface MemoryBoardPosterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PosterTheme = "baan7_classic" | "midnight_lagoon" | "vintage_scrapbook" | "golden_gala";
type AvatarMode = "compact" | "hidden" | "full";
type CanvasPreset = "widescreen_16_9" | "mega_wall_2400" | "desktop_1920" | "ig_story" | "hd_poster";
type TextSizeScale = "medium" | "large" | "extra_large";
type PageSizeOption = "all" | 8 | 9 | 12 | 16 | 18 | 20 | 24;
type PostTypeFilter = "all" | "memory" | "board";

/**
 * Parser for custom highlight tags like [h-blue]text[/h-blue], [h-gold], [h-pink], [h-green], [b], [i]
 */
function parseFormattedContent(text: string): React.ReactNode {
  if (!text) return "";

  const pattern = /\[(h-blue|h-gold|h-yellow|h-pink|h-red|h-green|h-purple|b|i)\](.*?)\[\/\1\]/gi;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.substring(lastIndex, match.index));
    }

    const tagType = match[1].toLowerCase();
    const tagText = match[2];

    if (tagType === "b") {
      elements.push(
        <Box as="span" key={match.index} fontWeight="bold">
          {tagText}
        </Box>
      );
    } else if (tagType === "i") {
      elements.push(
        <Box as="span" key={match.index} fontStyle="italic">
          {tagText}
        </Box>
      );
    } else {
      const highlightStyles: Record<string, { bg: string; color: string; border: string }> = {
        "h-blue": { bg: "rgba(56, 189, 248, 0.32)", color: "#38bdf8", border: "rgba(56, 189, 248, 0.6)" },
        "h-gold": { bg: "rgba(245, 158, 11, 0.32)", color: "#fbbf24", border: "rgba(245, 158, 11, 0.6)" },
        "h-yellow": { bg: "rgba(245, 158, 11, 0.32)", color: "#fbbf24", border: "rgba(245, 158, 11, 0.6)" },
        "h-pink": { bg: "rgba(244, 63, 94, 0.32)", color: "#fda4af", border: "rgba(244, 63, 94, 0.6)" },
        "h-red": { bg: "rgba(239, 68, 68, 0.32)", color: "#fca5a5", border: "rgba(239, 68, 68, 0.6)" },
        "h-green": { bg: "rgba(34, 197, 94, 0.32)", color: "#86efac", border: "rgba(34, 197, 94, 0.6)" },
        "h-purple": { bg: "rgba(168, 85, 247, 0.32)", color: "#c084fc", border: "rgba(168, 85, 247, 0.6)" },
      };

      const style = highlightStyles[tagType] || highlightStyles["h-blue"];

      elements.push(
        <Box
          as="span"
          key={match.index}
          px={2.5}
          py={1}
          mx={0.5}
          borderRadius="md"
          fontWeight="700"
          display="inline-block"
          style={{
            background: style.bg,
            color: style.color,
            border: `1.5px solid ${style.border}`,
          }}
        >
          {tagText}
        </Box>
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  return elements;
}

export function MemoryBoardPosterModal({ isOpen, onClose }: MemoryBoardPosterModalProps) {
  const posterRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1300);

  const [theme, setTheme] = useState<PosterTheme>("baan7_classic");
  const [preset, setPreset] = useState<CanvasPreset>("widescreen_16_9");
  const [textSizeScale, setTextSizeScale] = useState<TextSizeScale>("extra_large");
  const [pageSize, setPageSize] = useState<PageSizeOption>(12);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [typeFilter, setTypeFilter] = useState<PostTypeFilter>("all");
  const [customNote, setCustomNote] = useState<string>(
    "Thank you everyone for contributing your heartwarming memories to Baan 7. Here is a complete recap of all memory cards captured together."
  );
  const [enablePolaroidTilt, setEnablePolaroidTilt] = useState<boolean>(false);
  const [highlightTopLiked, setHighlightTopLiked] = useState<boolean>(true);
  const [avatarMode, setAvatarMode] = useState<AvatarMode>("full");
  const [gridColumns, setGridColumns] = useState<number>(4);
  const [sortBy, setSortBy] = useState<"likes" | "newest">("likes");
  const [exportDpi, setExportDpi] = useState<2 | 3 | 4>(3);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Measure container width for auto-fit responsive scaling
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width - 32); // 32px padding
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isOpen]);

  // Fetch ALL cards from Supabase with robust multi-type & fallback queries
  const { data: posts = [], isLoading, error: fetchError, refetch } = useQuery<MemoryPostItem[]>({
    queryKey: ["all_memory_posts_poster", sortBy, typeFilter],
    queryFn: async () => {
      let query = supabase
        .from("posts")
        .select(
          "id, content, image_url, likes, created_at, is_anonymous, type, author:users(student_id, nickname, avatar_color, role, profile_pic_url, faculty)"
        )
        .eq("is_hidden", false);

      if (typeFilter === "memory") {
        query = query.eq("type", "memory");
      } else if (typeFilter === "board") {
        query = query.eq("type", "board");
      } else {
        query = query.or("type.eq.memory,type.eq.board,type.eq.quote,type.is.null");
      }

      if (sortBy === "likes") {
        query = query.order("likes", { ascending: false }).order("created_at", { ascending: false });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      query = query.limit(1000);

      const { data, error } = await query;

      if (error || !data) {
        console.warn("[PosterFetch] Primary join query failed/empty, running fallback query...", error);
        let fallbackQuery = supabase.from("posts").select("*").eq("is_hidden", false);
        if (typeFilter !== "all") {
          fallbackQuery = fallbackQuery.eq("type", typeFilter);
        }
        fallbackQuery = fallbackQuery.order(sortBy === "likes" ? "likes" : "created_at", { ascending: false }).limit(1000);

        const { data: rawPosts, error: postErr } = await fallbackQuery;
        if (postErr) throw postErr;

        const { data: rawUsers } = await supabase.from("users").select("student_id, nickname, avatar_color, role, profile_pic_url, faculty");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userMap = new Map<string, any>((rawUsers ?? []).map((u: any) => [u.student_id, u]));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (rawPosts ?? []).map((p: any) => {
          const u = userMap.get(p.student_id) || {};
          return {
            id: p.id,
            content: p.content,
            image_url: p.image_url,
            likes: p.likes ?? 0,
            created_at: p.created_at,
            is_anonymous: p.is_anonymous ?? false,
            type: p.type ?? "memory",
            author: {
              student_id: p.student_id ?? "",
              nickname: u.nickname ?? "Guest",
              avatar_color: u.avatar_color ?? "#496268",
              role: u.role ?? "student",
              profile_pic_url: u.profile_pic_url ?? null,
              faculty: u.faculty ?? null,
            },
          };
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []).map((p: any) => ({
        id: p.id,
        content: p.content,
        image_url: p.image_url,
        likes: p.likes ?? 0,
        created_at: p.created_at,
        is_anonymous: p.is_anonymous ?? false,
        type: p.type ?? "memory",
        author: {
          student_id: p.author?.student_id ?? "",
          nickname: p.author?.nickname ?? "Guest",
          avatar_color: p.author?.avatar_color ?? "#496268",
          role: p.author?.role ?? "student",
          profile_pic_url: p.author?.profile_pic_url ?? null,
          faculty: p.author?.faculty ?? null,
        },
      }));
    },
    enabled: isOpen,
    staleTime: 15000,
  });

  const totalLikes = posts.reduce((sum, item) => sum + (item.likes || 0), 0);

  // Pagination calculation
  const isPaginated = pageSize !== "all";
  const numPageSize = typeof pageSize === "number" ? pageSize : posts.length;
  const totalPages = isPaginated ? Math.ceil(posts.length / numPageSize) || 1 : 1;
  const activePage = Math.min(currentPage, totalPages);

  // Slice displayed posts
  const displayedPosts = isPaginated
    ? posts.slice((activePage - 1) * numPageSize, activePage * numPageSize)
    : posts;

  // Handle Preset Selection
  const handlePresetSelect = (selectedPreset: CanvasPreset) => {
    setPreset(selectedPreset);
    if (selectedPreset === "widescreen_16_9") {
      setGridColumns(4);
      setTextSizeScale("extra_large");
      setAvatarMode("full");
      setPageSize(12);
      setCurrentPage(1);
      setExportDpi(3);
    } else if (selectedPreset === "desktop_1920") {
      setGridColumns(3);
      setTextSizeScale("extra_large");
      setAvatarMode("full");
      setPageSize(9);
      setCurrentPage(1);
      setExportDpi(3);
    } else if (selectedPreset === "ig_story") {
      setGridColumns(2);
      setTextSizeScale("extra_large");
      setAvatarMode("full");
      setPageSize(8);
      setCurrentPage(1);
      setExportDpi(3);
    } else if (selectedPreset === "mega_wall_2400") {
      setGridColumns(5);
      setTextSizeScale("large");
      setAvatarMode("compact");
      setPageSize("all");
      setExportDpi(4);
    } else if (selectedPreset === "hd_poster") {
      setGridColumns(3);
      setTextSizeScale("large");
      setAvatarMode("compact");
      setPageSize("all");
      setExportDpi(3);
    }
  };

  const handleDownload = async () => {
    if (!posterRef.current) return;
    setIsExporting(true);
    try {
      const pageSuffix = isPaginated ? `-slide-${activePage}` : "";
      await downloadElementAsPng(posterRef.current, {
        fileName: `baan7-memory-poster-${preset}${pageSuffix}-${Date.now()}.png`,
        pixelRatio: exportDpi,
        quality: 1.0,
      });
      toaster.create({
        title: "Export Successful",
        description: `Super Clear High-Res PNG (${exportDpi}x DPI, 100% Quality) saved (${displayedPosts.length} cards).`,
        type: "success",
      });
    } catch (err) {
      console.error("[PosterExport Error]", err);
      toaster.create({
        title: "Export Failed",
        description: err instanceof Error ? err.message : "Failed to capture poster image.",
        type: "error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleUploadSupabase = async () => {
    if (!posterRef.current) return;
    setIsExporting(true);
    try {
      const pageSuffix = isPaginated ? `-slide-${activePage}` : "";
      const res = await uploadElementToSupabaseStorage(posterRef.current, "memory-cards", {
        fileName: `poster-${preset}${pageSuffix}-${Date.now()}.png`,
        pixelRatio: exportDpi,
        quality: 1.0,
      });
      toaster.create({
        title: "Saved to Supabase Storage",
        description: `Poster URL: ${res.publicUrl ?? res.path}`,
        type: "success",
      });
    } catch (err) {
      console.error(err);
      toaster.create({
        title: "Upload Failed",
        description: err instanceof Error ? err.message : "Failed to upload to Supabase Storage.",
        type: "error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Preset Width & Height Numerical Constants
  const canvasWidthNum =
    preset === "widescreen_16_9"
      ? 2560
      : preset === "mega_wall_2400"
      ? 2400
      : preset === "desktop_1920"
      ? 1920
      : preset === "ig_story"
      ? 1080
      : 1500;

  const canvasHeightNum = preset === "widescreen_16_9" ? 1440 : undefined;

  const canvasWidth = `${canvasWidthNum}px`;
  const canvasHeight = canvasHeightNum ? `${canvasHeightNum}px` : "auto";

  // Calculate Auto-Fit Scale Ratio for Studio Preview (Zero Cropping!)
  const baseFitScale = containerWidth > 0 ? containerWidth / canvasWidthNum : 0.5;
  const effectiveScale = baseFitScale * (zoomLevel / 100);

  // Scaled Outer Box Dimensions for Pixel-Perfect Layout
  const scaledOuterWidth = `${canvasWidthNum * effectiveScale}px`;
  const scaledOuterHeight = canvasHeightNum ? `${canvasHeightNum * effectiveScale}px` : "auto";

  // BOOSTED READABLE FONT SIZES
  const fontSizes = {
    medium: { cardText: "19px", authorName: "19px", timestamp: "14px", headerTitle: "46px" },
    large: { cardText: "22px", authorName: "22px", timestamp: "16px", headerTitle: "54px" },
    extra_large: { cardText: "26px", authorName: "26px", timestamp: "18px", headerTitle: "64px" },
  }[textSizeScale];

  // Design Systems for Poster Canvas
  const themeSpecs = {
    baan7_classic: {
      name: "Baan 7 Warm Ivory & Chocolate",
      canvasBg: "linear-gradient(135deg, #2b1a13 0%, #1f120c 40%, #170d08 100%)",
      headerBg: "rgba(43, 26, 19, 0.92)",
      headerBorder: "1.5px solid rgba(253, 202, 173, 0.35)",
      titleColor: "#fdcaad",
      subtitleColor: "#e4e2e1",
      badgeBg: "#7c563f",
      badgeText: "#fcf9f8",
      cardBg: "rgba(43, 26, 19, 0.95)",
      cardBorder: "1.5px solid rgba(253, 202, 173, 0.3)",
      cardTextColor: "#fcf9f8",
      cardSubText: "#c5e0e6",
      accentBadgeBg: "rgba(73, 98, 104, 0.35)",
      accentBadgeText: "#c5e0e6",
      likesBadgeBg: "rgba(239, 68, 68, 0.3)",
      likesBadgeText: "#fca5a5",
      heroCardBg: "linear-gradient(135deg, rgba(124, 86, 63, 0.98), rgba(73, 98, 104, 0.95))",
      heroCardBorder: "2.5px solid #fdcaad",
      tapeColor: "rgba(253, 202, 173, 0.5)",
    },
    midnight_lagoon: {
      name: "Midnight Lagoon",
      canvasBg: "linear-gradient(135deg, #0b1329 0%, #111c38 50%, #080d1d 100%)",
      headerBg: "rgba(17, 28, 56, 0.92)",
      headerBorder: "1.5px solid rgba(73, 98, 104, 0.45)",
      titleColor: "#c5e0e6",
      subtitleColor: "#94a3b8",
      badgeBg: "#496268",
      badgeText: "#ffffff",
      cardBg: "rgba(17, 28, 56, 0.95)",
      cardBorder: "1.5px solid rgba(73, 98, 104, 0.3)",
      cardTextColor: "#f8fafc",
      cardSubText: "#94a3b8",
      accentBadgeBg: "rgba(56, 189, 248, 0.2)",
      accentBadgeText: "#38bdf8",
      likesBadgeBg: "rgba(244, 63, 94, 0.3)",
      likesBadgeText: "#fda4af",
      heroCardBg: "linear-gradient(135deg, rgba(73, 98, 104, 0.98), rgba(15, 23, 42, 0.95))",
      heroCardBorder: "2.5px solid #38bdf8",
      tapeColor: "rgba(56, 189, 248, 0.4)",
    },
    vintage_scrapbook: {
      name: "Vintage Scrapbook",
      canvasBg: "linear-gradient(135deg, #f7f3ee 0%, #eee6dc 50%, #e2d7c7 100%)",
      headerBg: "#ffffff",
      headerBorder: "1.5px solid rgba(124, 86, 63, 0.25)",
      titleColor: "#7c563f",
      subtitleColor: "#574235",
      badgeBg: "#7c563f",
      badgeText: "#ffffff",
      cardBg: "#ffffff",
      cardBorder: "1.5px solid rgba(124, 86, 63, 0.25)",
      cardTextColor: "#1b1c1c",
      cardSubText: "#72787a",
      accentBadgeBg: "rgba(73, 98, 104, 0.15)",
      accentBadgeText: "#496268",
      likesBadgeBg: "rgba(186, 26, 26, 0.15)",
      likesBadgeText: "#ba1a1a",
      heroCardBg: "linear-gradient(135deg, #ffffff 0%, #fffdfa 100%)",
      heroCardBorder: "2.5px solid #7c563f",
      tapeColor: "rgba(217, 119, 6, 0.4)",
    },
    golden_gala: {
      name: "Golden Gala",
      canvasBg: "linear-gradient(135deg, #181512 0%, #241f1a 50%, #12100e 100%)",
      headerBg: "rgba(36, 31, 26, 0.95)",
      headerBorder: "1.5px solid rgba(245, 158, 11, 0.4)",
      titleColor: "#fef3c7",
      subtitleColor: "#d97706",
      badgeBg: "#f59e0b",
      badgeText: "#181512",
      cardBg: "rgba(36, 31, 26, 0.95)",
      cardBorder: "1.5px solid rgba(245, 158, 11, 0.3)",
      cardTextColor: "#fffbeb",
      cardSubText: "#d97706",
      accentBadgeBg: "rgba(245, 158, 11, 0.2)",
      accentBadgeText: "#fbbf24",
      likesBadgeBg: "rgba(245, 158, 11, 0.3)",
      likesBadgeText: "#fef08a",
      heroCardBg: "linear-gradient(135deg, rgba(69, 52, 34, 0.98), rgba(36, 31, 26, 0.95))",
      heroCardBorder: "2.5px solid #fbbf24",
      tapeColor: "rgba(251, 191, 36, 0.4)",
    },
  }[theme];

  const getTiltAngle = (index: number) => {
    if (!enablePolaroidTilt) return "rotate(0deg)";
    const angles = ["rotate(-1deg)", "rotate(0.8deg)", "rotate(-0.6deg)", "rotate(1.2deg)"];
    return angles[index % angles.length];
  };

  return (
    <Portal>
      <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="xl">
        <Dialog.Backdrop bg="blackAlpha.850" backdropFilter="blur(10px)" />
        <Dialog.Positioner zIndex={2300}>
          <Dialog.Content maxW="1500px" bg="#170d08" border="1px solid rgba(253,202,173,0.2)" borderRadius="2xl">
            <Dialog.Header p={5} borderBottom="1px solid rgba(255,255,255,0.1)">
              <Flex justify="space-between" align="center" w="100%">
                <Box>
                  <Dialog.Title fontSize="xl" fontWeight="bold" color="#fdcaad" fontFamily="Georgia, serif">
                    Memory Board Studio (Auto-Fit & Zero Cropping)
                  </Dialog.Title>
                  <Text fontSize="xs" color="gray.400" mt={0.5}>
                    Studio preview automatically scales to fit your browser window with zero edge cropping.
                  </Text>
                </Box>

                {/* Studio Interactive Zoom & Data Controls */}
                <HStack gap={2}>
                  <Text fontSize="xs" fontWeight="bold" color="#fdcaad" mr={1}>
                    Zoom:
                  </Text>
                  <Button
                    size="xs"
                    variant="outline"
                    colorPalette="blue"
                    onClick={() => setZoomLevel((z) => Math.max(50, z - 25))}
                  >
                    <FiZoomOut /> {zoomLevel}%
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    colorPalette="blue"
                    onClick={() => setZoomLevel((z) => Math.min(175, z + 25))}
                  >
                    <FiZoomIn /> Zoom In
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    colorPalette="amber"
                    onClick={() => setZoomLevel(100)}
                  >
                    <FiMaximize2 /> Fit Screen
                  </Button>

                  <Button size="xs" variant="solid" colorPalette="teal" onClick={() => refetch()} ml={2}>
                    <FiRefreshCw /> Fetch & Refresh
                  </Button>
                  <Dialog.CloseTrigger color="gray.400" />
                </HStack>
              </Flex>
            </Dialog.Header>

            <Dialog.Body p={5} maxH="85vh" overflowY="auto">
              <VStack align="stretch" gap={5}>
                {/* Control Panel Bar */}
                <Box
                  p={4}
                  bg="rgba(43, 26, 19, 0.6)"
                  borderRadius="xl"
                  border="1px solid rgba(253, 202, 173, 0.15)"
                  data-export-ignore="true"
                >
                  <VStack align="stretch" gap={3}>
                    {/* Row 1: Post Type Filter & Format Presets */}
                    <Flex direction={{ base: "column", lg: "row" }} gap={3} justify="space-between" align="center">
                      <HStack gap={2} flexWrap="wrap">
                        <Text fontSize="xs" fontWeight="bold" color="#fdcaad" mr={1}>
                          Fetch Filter:
                        </Text>
                        <Button
                          size="xs"
                          variant={typeFilter === "all" ? "solid" : "outline"}
                          colorPalette="teal"
                          onClick={() => {
                            setTypeFilter("all");
                            setCurrentPage(1);
                          }}
                          borderRadius="lg"
                        >
                          <FiFilter style={{ marginRight: 3 }} />
                          All Card Types (Memory + Board)
                        </Button>
                        <Button
                          size="xs"
                          variant={typeFilter === "memory" ? "solid" : "outline"}
                          colorPalette="amber"
                          onClick={() => {
                            setTypeFilter("memory");
                            setCurrentPage(1);
                          }}
                          borderRadius="lg"
                        >
                          Memory Only
                        </Button>
                        <Button
                          size="xs"
                          variant={typeFilter === "board" ? "solid" : "outline"}
                          colorPalette="blue"
                          onClick={() => {
                            setTypeFilter("board");
                            setCurrentPage(1);
                          }}
                          borderRadius="lg"
                        >
                          Board Only
                        </Button>

                        <Text fontSize="xs" fontWeight="bold" color="#fdcaad" ml={3} mr={1}>
                          Preset:
                        </Text>
                        <Button
                          size="xs"
                          variant={preset === "widescreen_16_9" ? "solid" : "outline"}
                          colorPalette="amber"
                          onClick={() => handlePresetSelect("widescreen_16_9")}
                          borderRadius="lg"
                        >
                          <FiTv style={{ marginRight: 4 }} />
                          16:9 Widescreen
                        </Button>
                        <Button
                          size="xs"
                          variant={preset === "desktop_1920" ? "solid" : "outline"}
                          colorPalette="teal"
                          onClick={() => handlePresetSelect("desktop_1920")}
                          borderRadius="lg"
                        >
                          <FiMonitor style={{ marginRight: 4 }} />
                          Desktop 4K
                        </Button>
                        <Button
                          size="xs"
                          variant={preset === "ig_story" ? "solid" : "outline"}
                          colorPalette="purple"
                          onClick={() => handlePresetSelect("ig_story")}
                          borderRadius="lg"
                        >
                          <FiSmartphone style={{ marginRight: 4 }} />
                          IG Story
                        </Button>
                        <Button
                          size="xs"
                          variant={preset === "mega_wall_2400" ? "solid" : "outline"}
                          colorPalette="blue"
                          onClick={() => handlePresetSelect("mega_wall_2400")}
                          borderRadius="lg"
                        >
                          <FiGrid style={{ marginRight: 4 }} />
                          Mega Wall
                        </Button>
                      </HStack>

                      {/* Export Buttons */}
                      <HStack gap={2}>
                        <Button
                          colorPalette="amber"
                          size="sm"
                          onClick={handleDownload}
                          loading={isExporting}
                          disabled={isLoading || posts.length === 0}
                          borderRadius="lg"
                          px={5}
                        >
                          <FiDownload /> Export High-Res PNG
                        </Button>
                        <Button
                          colorPalette="teal"
                          variant="outline"
                          size="sm"
                          onClick={handleUploadSupabase}
                          loading={isExporting}
                          disabled={isLoading || posts.length === 0}
                          borderRadius="lg"
                        >
                          <FiUpload /> Save to Supabase Storage
                        </Button>
                      </HStack>
                    </Flex>

                    {/* Row 2: Sheet Pagination & Slicing */}
                    <Flex direction={{ base: "column", md: "row" }} gap={3} justify="space-between" align="center">
                      <HStack gap={2} flexWrap="wrap">
                        <Text fontSize="xs" fontWeight="bold" color="#fdcaad" mr={1}>
                          Cards Per Slide (Readability Boost):
                        </Text>
                        {(["all", 8, 9, 12, 16, 18, 20, 24] as const).map((opt) => (
                          <Button
                            key={String(opt)}
                            size="xs"
                            variant={pageSize === opt ? "solid" : "outline"}
                            colorPalette={opt === 8 || opt === 12 ? "amber" : "teal"}
                            onClick={() => {
                              setPageSize(opt);
                              setCurrentPage(1);
                            }}
                            borderRadius="md"
                          >
                            {opt === "all"
                              ? `All ${posts.length} Cards`
                              : opt === 8 || opt === 12
                              ? `${opt} Cards (Super Clear)`
                              : `${opt} Cards / Sheet`}
                          </Button>
                        ))}

                        {isPaginated && (
                          <HStack gap={2} ml={3}>
                            <Text fontSize="xs" fontWeight="bold" color="gray.300">
                              Sheet {activePage} of {totalPages}
                            </Text>
                            <Button
                              size="xs"
                              variant="outline"
                              disabled={activePage <= 1}
                              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            >
                              <FiChevronLeft /> Prev
                            </Button>
                            <Button
                              size="xs"
                              variant="outline"
                              disabled={activePage >= totalPages}
                              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            >
                              Next <FiChevronRight />
                            </Button>
                          </HStack>
                        )}
                      </HStack>

                      {/* Text Scaling & Density */}
                      <HStack gap={2}>
                        <Text fontSize="xs" fontWeight="bold" color="#fdcaad" mr={1}>
                          Text Size:
                        </Text>
                        {(["medium", "large", "extra_large"] as const).map((sz) => (
                          <Button
                            key={sz}
                            size="xs"
                            variant={textSizeScale === sz ? "solid" : "outline"}
                            colorPalette={sz === "extra_large" ? "amber" : "blue"}
                            onClick={() => setTextSizeScale(sz)}
                            borderRadius="md"
                            textTransform="capitalize"
                          >
                            {sz === "extra_large" ? "Jumbo 26px Text" : sz === "large" ? "Large 22px" : "Medium 19px"}
                          </Button>
                        ))}

                        <Text fontSize="xs" fontWeight="bold" color="gray.300" ml={2} mr={1}>
                          Cols:
                        </Text>
                        {([2, 3, 4, 5, 6] as const).map((cols) => (
                          <Button
                            key={cols}
                            size="xs"
                            variant={gridColumns === cols ? "solid" : "outline"}
                            colorPalette="purple"
                            onClick={() => setGridColumns(cols)}
                            borderRadius="md"
                          >
                            {cols}
                          </Button>
                        ))}
                      </HStack>
                    </Flex>

                    {/* Row 3: Avatars, DPI Quality, & Themes */}
                    <Flex direction={{ base: "column", md: "row" }} gap={3} justify="space-between" align="center">
                      <HStack gap={2} flexWrap="wrap">
                        <Text fontSize="xs" fontWeight="bold" color="gray.300" mr={1}>
                          Theme:
                        </Text>
                        {(
                          [
                            { id: "baan7_classic", label: "Chocolate" },
                            { id: "midnight_lagoon", label: "Lagoon" },
                            { id: "vintage_scrapbook", label: "Scrapbook" },
                            { id: "golden_gala", label: "Gala" },
                          ] as const
                        ).map((t) => (
                          <Button
                            key={t.id}
                            size="xs"
                            variant={theme === t.id ? "solid" : "outline"}
                            colorPalette={theme === t.id ? "amber" : "gray"}
                            onClick={() => setTheme(t.id)}
                            borderRadius="full"
                            px={2.5}
                          >
                            {theme === t.id && <FiCheck style={{ marginRight: 2 }} />}
                            {t.label}
                          </Button>
                        ))}
                      </HStack>

                      <HStack gap={2} flexWrap="wrap">
                        <Text fontSize="xs" fontWeight="bold" color="#fdcaad" mr={1}>
                          Export DPI Quality:
                        </Text>
                        {([2, 3, 4] as const).map((dpi) => (
                          <Button
                            key={dpi}
                            size="xs"
                            variant={exportDpi === dpi ? "solid" : "outline"}
                            colorPalette={dpi === 4 ? "amber" : "blue"}
                            onClick={() => setExportDpi(dpi)}
                            borderRadius="md"
                          >
                            {dpi === 4 ? "4K Max (4x)" : dpi === 3 ? "Ultra HD (3x)" : "Standard (2x)"}
                          </Button>
                        ))}

                        <Text fontSize="xs" fontWeight="bold" color="gray.300" ml={2} mr={1}>
                          Avatar Display:
                        </Text>
                        {(["full", "compact", "hidden"] as const).map((mode) => (
                          <Button
                            key={mode}
                            size="xs"
                            variant={avatarMode === mode ? "solid" : "outline"}
                            colorPalette="purple"
                            onClick={() => setAvatarMode(mode)}
                            borderRadius="md"
                            textTransform="capitalize"
                          >
                            {mode} Profile Pic
                          </Button>
                        ))}

                        <Button
                          size="xs"
                          variant={highlightTopLiked ? "solid" : "outline"}
                          colorPalette="teal"
                          onClick={() => setHighlightTopLiked(!highlightTopLiked)}
                          borderRadius="md"
                          ml={2}
                        >
                          <FiGrid style={{ marginRight: 3 }} />
                          {highlightTopLiked ? "Hero Highlights: ON" : "OFF"}
                        </Button>

                        <Button
                          size="xs"
                          variant={enablePolaroidTilt ? "solid" : "outline"}
                          colorPalette="gray"
                          onClick={() => setEnablePolaroidTilt(!enablePolaroidTilt)}
                          borderRadius="md"
                        >
                          <FiLayers style={{ marginRight: 3 }} />
                          {enablePolaroidTilt ? "Tilt: ON" : "OFF"}
                        </Button>

                        <Button
                          size="xs"
                          variant="outline"
                          colorPalette="gray"
                          onClick={() => setSortBy(sortBy === "likes" ? "newest" : "likes")}
                          borderRadius="md"
                        >
                          Sort: {sortBy === "likes" ? "Most Liked" : "Newest"}
                        </Button>
                      </HStack>
                    </Flex>

                    {/* Moderator Custom Note Input */}
                    <Box pt={1}>
                      <Textarea
                        value={customNote}
                        onChange={(e) => setCustomNote(e.target.value)}
                        rows={2}
                        bg="blackAlpha.500"
                        color="white"
                        borderColor="whiteAlpha.200"
                        fontSize="xs"
                        borderRadius="lg"
                        placeholder="Enter moderator header note..."
                      />
                    </Box>
                  </VStack>
                </Box>

                {isLoading ? (
                  <Flex justify="center" align="center" py={16}>
                    <Spinner size="xl" color="#fdcaad" />
                    <Text ml={4} color="gray.300" fontSize="sm">
                      Fetching all cards from database...
                    </Text>
                  </Flex>
                ) : fetchError ? (
                  /* Error Diagnostics Banner */
                  <Box p={6} bg="rgba(239, 68, 68, 0.15)" borderRadius="2xl" border="1px solid rgba(239, 68, 68, 0.4)">
                    <HStack gap={3} mb={3}>
                      <FiAlertCircle color="#fca5a5" size={24} />
                      <Heading fontSize="md" color="#fca5a5">
                        Database Fetch Error
                      </Heading>
                    </HStack>
                    <Text fontSize="sm" color="gray.300" mb={4}>
                      {fetchError instanceof Error ? fetchError.message : "Failed to load posts from Supabase."}
                    </Text>
                    <Button size="sm" colorPalette="amber" onClick={() => refetch()}>
                      <FiRefreshCw /> Retry Fetching Cards
                    </Button>
                  </Box>
                ) : posts.length === 0 ? (
                  /* Empty State Diagnostics Box */
                  <Box p={8} bg="rgba(43, 26, 19, 0.6)" borderRadius="2xl" border="1px solid rgba(253, 202, 173, 0.2)" textAlign="center">
                    <FiAlertCircle color="#fdcaad" size={32} style={{ margin: "0 auto 12px" }} />
                    <Heading fontSize="lg" color="#fdcaad" mb={2}>
                      No Cards Found for Filter: &quot;{typeFilter}&quot;
                    </Heading>
                    <Text fontSize="sm" color="gray.300" mb={6} maxW="600px" mx="auto">
                      There are currently 0 posts matching this post type. Click below to fetch all cards across all database types.
                    </Text>
                    <HStack justify="center" gap={3}>
                      <Button
                        colorPalette="teal"
                        size="sm"
                        onClick={() => {
                          setTypeFilter("all");
                          refetch();
                        }}
                      >
                        <FiFilter /> Switch to &quot;All Card Types&quot;
                      </Button>
                      <Button colorPalette="amber" variant="outline" size="sm" onClick={() => refetch()}>
                        <FiRefreshCw /> Refresh Data
                      </Button>
                    </HStack>
                  </Box>
                ) : (
                  /* ─── SCROLLABLE & RESPONSIVE AUTO-FIT PREVIEW CONTAINER ─── */
                  <Box
                    ref={containerRef}
                    w="100%"
                    overflow="auto"
                    borderRadius="2xl"
                    p={4}
                    bg="blackAlpha.700"
                    border="1px solid rgba(255,255,255,0.08)"
                    maxH="68vh"
                    display="flex"
                    justifyContent="center"
                    alignItems="flex-start"
                  >
                    {/* Responsive Scaler Wrapper (Zero Cropping!) */}
                    <Box
                      style={{
                        width: scaledOuterWidth,
                        height: scaledOuterHeight,
                        position: "relative",
                        flexShrink: 0,
                      }}
                    >
                      {/* ─── POSTER CANVAS DOM NODE TO CAPTURE ─── */}
                      <Box
                        ref={posterRef}
                        w={canvasWidth}
                        h={canvasHeight}
                        p={ preset === "widescreen_16_9" ? 12 : preset === "mega_wall_2400" ? 14 : 10 }
                        style={{
                          background: themeSpecs.canvasBg,
                          transform: `scale(${effectiveScale})`,
                          transformOrigin: "top left",
                          width: canvasWidth,
                          height: canvasHeight,
                        }}
                        borderRadius="2xl"
                        boxShadow="0 25px 50px -12px rgba(0, 0, 0, 0.7)"
                        fontFamily='"Plus Jakarta Sans", system-ui, sans-serif'
                        color={themeSpecs.cardTextColor}
                        position="absolute"
                        top={0}
                        left={0}
                        display="flex"
                        flexDirection="column"
                        justifyContent="space-between"
                      >
                        {/* Poster Header */}
                        <Box
                          p={preset === "widescreen_16_9" ? 8 : 7}
                          borderRadius="2xl"
                          style={{
                            background: themeSpecs.headerBg,
                            border: themeSpecs.headerBorder,
                            backdropFilter: "blur(16px)",
                          }}
                          mb={7}
                        >
                          <Flex justify="space-between" align="center">
                            <Box maxW={preset === "widescreen_16_9" ? "1800px" : "1000px"}>
                              <HStack gap={2.5} mb={3}>
                                <Badge
                                  px={4}
                                  py={1.5}
                                  borderRadius="full"
                                  fontSize="sm"
                                  fontWeight="bold"
                                  letterSpacing="0.05em"
                                  style={{ background: themeSpecs.badgeBg, color: themeSpecs.badgeText }}
                                >
                                  BAAN 7 OFFICIAL MEMORY WALL 2026
                                </Badge>
                                <Badge variant="outline" colorPalette="amber" px={3} py={1.5} borderRadius="full" fontSize="sm">
                                  {preset === "widescreen_16_9"
                                    ? `16:9 WIDESCREEN SLIDE ${activePage} OF ${totalPages} (${displayedPosts.length} CARDS)`
                                    : isPaginated
                                    ? `SHEET ${activePage} OF ${totalPages} (${displayedPosts.length} CARDS)`
                                    : `COMPLETE MEGA WALL (${posts.length} CARDS)`}
                                </Badge>
                              </HStack>

                              <Heading
                                fontSize={fontSizes.headerTitle}
                                fontWeight="800"
                                letterSpacing="-0.02em"
                                fontFamily='"Playfair Display", Georgia, serif'
                                style={{ color: themeSpecs.titleColor }}
                              >
                                Ween 2026 Memory Board Recap
                              </Heading>

                              <Text fontSize={preset === "widescreen_16_9" ? "lg" : "md"} mt={3} lineHeight="1.6" style={{ color: themeSpecs.subtitleColor }}>
                                {customNote}
                              </Text>
                            </Box>

                            {/* Event Stats Counter */}
                            <HStack gap={5}>
                              <Box
                                px={7}
                                py={4}
                                borderRadius="2xl"
                                textAlign="center"
                                style={{
                                  background: themeSpecs.cardBg,
                                  border: themeSpecs.cardBorder,
                                }}
                              >
                                <Text fontSize={preset === "widescreen_16_9" ? "4xl" : "3xl"} fontWeight="800" style={{ color: themeSpecs.titleColor }}>
                                  {posts.length}
                                </Text>
                                <Text fontSize="xs" fontWeight="bold" style={{ color: themeSpecs.cardSubText }}>
                                  TOTAL MEMORIES
                                </Text>
                              </Box>

                              <Box
                                px={7}
                                py={4}
                                borderRadius="2xl"
                                textAlign="center"
                                style={{
                                  background: themeSpecs.cardBg,
                                  border: themeSpecs.cardBorder,
                                }}
                              >
                                <Text fontSize={preset === "widescreen_16_9" ? "4xl" : "3xl"} fontWeight="800" style={{ color: themeSpecs.titleColor }}>
                                  {totalLikes}
                                </Text>
                                <Text fontSize="xs" fontWeight="bold" style={{ color: themeSpecs.cardSubText }}>
                                  TOTAL LIKES
                                </Text>
                              </Box>
                            </HStack>
                          </Flex>
                        </Box>

                        {/* Posts Grid Layout */}
                        <SimpleGrid columns={gridColumns} gap={ preset === "widescreen_16_9" ? 6 : 6 } flex={1}>
                          {displayedPosts.map((item, index) => {
                            const isHero = highlightTopLiked && index < 3 && item.likes > 0;
                            const tilt = getTiltAngle(index);

                            return (
                              <Box
                                key={item.id}
                                p={preset === "widescreen_16_9" ? 6 : 5}
                                borderRadius="2xl"
                                style={{
                                  background: isHero ? themeSpecs.heroCardBg : themeSpecs.cardBg,
                                  border: isHero ? themeSpecs.heroCardBorder : themeSpecs.cardBorder,
                                  transform: tilt,
                                  transition: "all 0.2s ease",
                                }}
                                boxShadow="md"
                                display="flex"
                                flexDirection="column"
                                justifyContent="space-between"
                                position="relative"
                              >
                                {/* Decorative Tape Top Center */}
                                {enablePolaroidTilt && (
                                  <Box
                                    position="absolute"
                                    top="-10px"
                                    left="50%"
                                    style={{ transform: "translateX(-50%)" }}
                                    w="60px"
                                    h="14px"
                                    borderRadius="2px"
                                    bg={themeSpecs.tapeColor}
                                  />
                                )}

                                <Box>
                                  {/* Author & Header Info */}
                                  <Flex justify="space-between" align="center" mb={3}>
                                    <HStack gap={3}>
                                      {avatarMode === "full" && (
                                        <UserAvatar
                                          src={item.author.profile_pic_url}
                                          name={item.is_anonymous ? "Anonymous" : item.author.nickname ?? "Student"}
                                          avatarColor={item.author.avatar_color}
                                          size="sm"
                                        />
                                      )}

                                      {avatarMode === "compact" && (
                                        <Box
                                          w="12px"
                                          h="12px"
                                          borderRadius="full"
                                          bg={item.author.avatar_color || "#496268"}
                                          flexShrink={0}
                                        />
                                      )}

                                      <Box>
                                        <HStack gap={1.5}>
                                          <Text fontSize={fontSizes.authorName} fontWeight="bold" lineHeight="1.2">
                                            {item.is_anonymous ? "Anonymous" : item.author.nickname || "Student"}
                                          </Text>
                                          {isHero && (
                                            <Badge colorPalette="amber" size="xs" fontSize="xs" borderRadius="xs">
                                              TOP
                                            </Badge>
                                          )}
                                        </HStack>

                                        {item.author.faculty && (
                                          <Text fontSize="xs" style={{ color: themeSpecs.cardSubText }}>
                                            {item.author.faculty}
                                          </Text>
                                        )}
                                      </Box>
                                    </HStack>

                                    <Badge
                                      px={3}
                                      py={1}
                                      borderRadius="full"
                                      fontSize="xs"
                                      fontWeight="bold"
                                      style={{
                                        background: themeSpecs.likesBadgeBg,
                                        color: themeSpecs.likesBadgeText,
                                      }}
                                    >
                                      <FiHeart style={{ display: "inline", marginRight: 4 }} />
                                      {item.likes}
                                    </Badge>
                                  </Flex>

                                  {/* Memory Content Text with Highlight Tag Parsing */}
                                  <Text
                                    fontSize={fontSizes.cardText}
                                    lineHeight="1.6"
                                    mb={3}
                                    whiteSpace="pre-wrap"
                                    fontWeight={isHero ? "700" : "500"}
                                  >
                                    {parseFormattedContent(item.content)}
                                  </Text>

                                  {/* Memory Attached Image (if any) */}
                                  {item.image_url && (
                                    <Box
                                      borderRadius="xl"
                                      overflow="hidden"
                                      mb={3}
                                      maxH="220px"
                                      border="1px solid rgba(255,255,255,0.1)"
                                    >
                                      <Image
                                        src={item.image_url}
                                        alt="Memory attachment"
                                        w="100%"
                                        h="100%"
                                        objectFit="cover"
                                        crossOrigin="anonymous"
                                      />
                                    </Box>
                                  )}
                                </Box>

                                {/* Card Footer Timestamp */}
                                <Text fontSize={fontSizes.timestamp} textAlign="right" style={{ color: themeSpecs.cardSubText }} mt={2}>
                                  {new Date(item.created_at).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </Text>
                              </Box>
                            );
                          })}
                        </SimpleGrid>

                        {/* Poster Footer Stamp */}
                        <Flex
                          justify="space-between"
                          align="center"
                          mt={8}
                          pt={5}
                          borderTop={themeSpecs.headerBorder}
                          fontSize="md"
                          fontWeight="600"
                          style={{ color: themeSpecs.subtitleColor }}
                        >
                          <Text>Curated by Baan 7 Moderator Team • Ween 2026</Text>
                          <Text>
                            {preset === "widescreen_16_9"
                              ? `16:9 Widescreen Slide ${activePage} of ${totalPages} • Captured on ${new Date().toLocaleDateString("en-US", { dateStyle: "medium" })}`
                              : isPaginated
                              ? `Sheet ${activePage} of ${totalPages} • Captured on ${new Date().toLocaleDateString("en-US", { dateStyle: "medium" })}`
                              : `Captured on ${new Date().toLocaleDateString("en-US", { dateStyle: "medium" })}`}
                          </Text>
                        </Flex>
                      </Box>
                    </Box>
                  </Box>
                )}
              </VStack>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Portal>
  );
}
