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
  FiMonitor,
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

type PosterTheme = "desktop_app" | "baan7_classic" | "midnight_lagoon" | "vintage_scrapbook" | "golden_gala";
type AvatarMode = "compact" | "hidden" | "full";
type CanvasPreset = "billboard_8k_7680" | "desktop_4k_3840" | "mega_wall_2400" | "widescreen_16_9" | "desktop_1920" | "ig_story" | "hd_poster";
type TextSizeScale = "medium" | "large" | "extra_large" | "ultra_jumbo";
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
        "h-blue": { bg: "rgba(56, 189, 248, 0.32)", color: "#0284c7", border: "rgba(56, 189, 248, 0.6)" },
        "h-gold": { bg: "rgba(245, 158, 11, 0.32)", color: "#d97706", border: "rgba(245, 158, 11, 0.6)" },
        "h-yellow": { bg: "rgba(245, 158, 11, 0.32)", color: "#d97706", border: "rgba(245, 158, 11, 0.6)" },
        "h-pink": { bg: "rgba(244, 63, 94, 0.32)", color: "#e11d48", border: "rgba(244, 63, 94, 0.6)" },
        "h-red": { bg: "rgba(239, 68, 68, 0.32)", color: "#dc2626", border: "rgba(239, 68, 68, 0.6)" },
        "h-green": { bg: "rgba(34, 197, 94, 0.32)", color: "#16a34a", border: "rgba(34, 197, 94, 0.6)" },
        "h-purple": { bg: "rgba(168, 85, 247, 0.32)", color: "#9333ea", border: "rgba(168, 85, 247, 0.6)" },
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
  const [posterHeight, setPosterHeight] = useState<number>(1440);

  const [theme, setTheme] = useState<PosterTheme>("desktop_app");
  const [preset, setPreset] = useState<CanvasPreset>("desktop_4k_3840"); // Default to 4K Super Wide Wall!
  const [textSizeScale, setTextSizeScale] = useState<TextSizeScale>("extra_large");
  const [pageSize, setPageSize] = useState<PageSizeOption>("all");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [typeFilter, setTypeFilter] = useState<PostTypeFilter>("all");
  const [customNote, setCustomNote] = useState<string>(
    "Thank you everyone for contributing your heartwarming memories to Baan 7. Here is a complete recap of all memory cards captured together."
  );
  const [enablePolaroidTilt, setEnablePolaroidTilt] = useState<boolean>(true);
  const [highlightTopLiked, setHighlightTopLiked] = useState<boolean>(true);
  const [avatarMode, setAvatarMode] = useState<AvatarMode>("hidden");
  const [gridColumns, setGridColumns] = useState<number>(6);
  const [sortBy, setSortBy] = useState<"likes" | "newest">("likes");
  const [exportDpi, setExportDpi] = useState<2 | 3 | 4 | 5>(4); // Default to 4x High-DPI 4K/8K resolution!
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Measure container width for auto-fit responsive scaling
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width - 32);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isOpen]);

  // Measure poster natural height dynamically for unclipped auto-height containers
  useEffect(() => {
    if (!posterRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.height > 0) {
          setPosterHeight(entry.contentRect.height);
        }
      }
    });
    observer.observe(posterRef.current);
    return () => observer.disconnect();
  }, [isOpen, preset, textSizeScale, gridColumns, pageSize, currentPage, typeFilter, theme]);

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
    if (selectedPreset === "billboard_8k_7680") {
      setGridColumns(8);
      setTextSizeScale("ultra_jumbo");
      setAvatarMode("hidden");
      setPageSize("all");
      setExportDpi(5); // 5x Ultra 8K DPI!
    } else if (selectedPreset === "desktop_4k_3840") {
      setGridColumns(6);
      setTextSizeScale("extra_large");
      setAvatarMode("hidden");
      setPageSize("all");
      setExportDpi(4);
    } else if (selectedPreset === "widescreen_16_9") {
      setGridColumns(4);
      setTextSizeScale("extra_large");
      setAvatarMode("hidden");
      setPageSize(12);
      setCurrentPage(1);
      setExportDpi(3);
    } else if (selectedPreset === "mega_wall_2400") {
      setGridColumns(5);
      setTextSizeScale("extra_large");
      setAvatarMode("hidden");
      setPageSize("all");
      setExportDpi(4);
    } else if (selectedPreset === "desktop_1920") {
      setGridColumns(4);
      setTextSizeScale("extra_large");
      setAvatarMode("hidden");
      setPageSize("all");
      setExportDpi(3);
    } else if (selectedPreset === "ig_story") {
      setGridColumns(2);
      setTextSizeScale("extra_large");
      setAvatarMode("hidden");
      setPageSize(8);
      setCurrentPage(1);
      setExportDpi(3);
    } else if (selectedPreset === "hd_poster") {
      setGridColumns(3);
      setTextSizeScale("large");
      setAvatarMode("hidden");
      setPageSize("all");
      setExportDpi(3);
    }
  };

  const handleDownload = async () => {
    if (!posterRef.current) return;
    setIsExporting(true);
    try {
      const pageSuffix = isPaginated ? `-slide-${activePage}` : "-full-poster";
      await downloadElementAsPng(posterRef.current, {
        fileName: `baan7-memory-poster-${preset}${pageSuffix}-${Date.now()}.png`,
        pixelRatio: exportDpi,
        quality: 1.0,
      });
      toaster.create({
        title: "Export Successful",
        description: `Ultra High-Res PNG (${exportDpi}x DPI, 100% Quality) saved (${displayedPosts.length} cards).`,
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
      const pageSuffix = isPaginated ? `-slide-${activePage}` : "-full-poster";
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
    preset === "billboard_8k_7680"
      ? 7680
      : preset === "desktop_4k_3840"
      ? 3840
      : preset === "widescreen_16_9"
      ? 2560
      : preset === "mega_wall_2400"
      ? 2400
      : preset === "desktop_1920"
      ? 1920
      : preset === "ig_story"
      ? 1080
      : 1500;

  // Fixed height ONLY when in 16:9 Paginated mode. For Full Poster mode, height is "auto" (unclipped)!
  const canvasHeightNum = preset === "widescreen_16_9" && isPaginated ? 1440 : undefined;

  const canvasWidth = `${canvasWidthNum}px`;
  const canvasHeight = canvasHeightNum ? `${canvasHeightNum}px` : "auto";

  // Calculate Auto-Fit Scale Ratio for Studio Preview
  const baseFitScale = containerWidth > 0 ? containerWidth / canvasWidthNum : 0.5;
  const effectiveScale = baseFitScale * (zoomLevel / 100);

  // Scaled Outer Box Dimensions for Pixel-Perfect Layout (Unclipped Vertically)
  const targetHeight = canvasHeightNum || posterHeight;
  const scaledOuterWidth = `${canvasWidthNum * effectiveScale}px`;
  const scaledOuterHeight = `${targetHeight * effectiveScale}px`;

  // BOOSTED READABLE FONT SIZES FOR 4K / 8K BILLBOARDS
  const fontSizes = {
    medium: { cardText: "20px", authorName: "20px", timestamp: "15px", headerTitle: "50px" },
    large: { cardText: "24px", authorName: "24px", timestamp: "17px", headerTitle: "60px" },
    extra_large: { cardText: "28px", authorName: "28px", timestamp: "19px", headerTitle: "72px" },
    ultra_jumbo: { cardText: "36px", authorName: "36px", timestamp: "24px", headerTitle: "88px" },
  }[textSizeScale];

  // Design Systems for Poster Canvas
  const themeSpecs = {
    desktop_app: {
      name: "Baan 7 Desktop Live App Slate",
      canvasBg: "linear-gradient(135deg, #10192d 0%, #1a2642 50%, #0d1424 100%)",
      headerBg: "rgba(26, 38, 66, 0.95)",
      headerBorder: "1.5px solid rgba(59, 106, 191, 0.35)",
      titleColor: "#ffffff",
      subtitleColor: "#a3b8dd",
      badgeBg: "#3b6abf",
      badgeText: "#ffffff",
      studentCardBg: "#E2EAFB",
      studentCardBorder: "1.5px solid rgba(59, 106, 191, 0.25)",
      studentCardTextColor: "#0D1A36",
      studentCardSubText: "rgba(13, 26, 54, 0.65)",
      staffCardBg: "#FFE5EC",
      staffCardBorder: "1.5px solid rgba(242, 100, 117, 0.35)",
      staffCardTextColor: "#0D1A36",
      staffCardSubText: "rgba(13, 26, 54, 0.65)",
      accentBadgeBg: "rgba(59, 106, 191, 0.15)",
      accentBadgeText: "#3b6abf",
      likesBadgeBg: "#F26475",
      likesBadgeText: "#ffffff",
      heroCardBg: "linear-gradient(135deg, #FFE5EC 0%, #FFF0F4 100%)",
      heroCardBorder: "2.5px solid #F26475",
      tapeColor: "rgba(255, 223, 137, 0.55)",
    },
    baan7_classic: {
      name: "Baan 7 Warm Ivory & Chocolate",
      canvasBg: "linear-gradient(135deg, #2b1a13 0%, #1f120c 40%, #170d08 100%)",
      headerBg: "rgba(43, 26, 19, 0.92)",
      headerBorder: "1.5px solid rgba(253, 202, 173, 0.35)",
      titleColor: "#fdcaad",
      subtitleColor: "#e4e2e1",
      badgeBg: "#7c563f",
      badgeText: "#fcf9f8",
      studentCardBg: "rgba(43, 26, 19, 0.95)",
      studentCardBorder: "1.5px solid rgba(253, 202, 173, 0.3)",
      studentCardTextColor: "#fcf9f8",
      studentCardSubText: "#c5e0e6",
      staffCardBg: "rgba(124, 86, 63, 0.95)",
      staffCardBorder: "1.5px solid #fdcaad",
      staffCardTextColor: "#fcf9f8",
      staffCardSubText: "#fdcaad",
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
      studentCardBg: "rgba(17, 28, 56, 0.95)",
      studentCardBorder: "1.5px solid rgba(73, 98, 104, 0.3)",
      studentCardTextColor: "#f8fafc",
      studentCardSubText: "#94a3b8",
      staffCardBg: "rgba(30, 48, 88, 0.95)",
      staffCardBorder: "1.5px solid #38bdf8",
      staffCardTextColor: "#f8fafc",
      staffCardSubText: "#38bdf8",
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
      studentCardBg: "#ffffff",
      studentCardBorder: "1.5px solid rgba(124, 86, 63, 0.25)",
      studentCardTextColor: "#1b1c1c",
      studentCardSubText: "#72787a",
      staffCardBg: "#fff5f5",
      staffCardBorder: "1.5px solid #ba1a1a",
      staffCardTextColor: "#1b1c1c",
      staffCardSubText: "#ba1a1a",
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
      studentCardBg: "rgba(36, 31, 26, 0.95)",
      studentCardBorder: "1.5px solid rgba(245, 158, 11, 0.3)",
      studentCardTextColor: "#fffbeb",
      studentCardSubText: "#d97706",
      staffCardBg: "rgba(69, 52, 34, 0.95)",
      staffCardBorder: "1.5px solid #fbbf24",
      staffCardTextColor: "#fffbeb",
      staffCardSubText: "#fbbf24",
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
          <Dialog.Content maxW="1600px" bg="#170d08" border="1px solid rgba(253,202,173,0.2)" borderRadius="2xl">
            <Dialog.Header p={5} borderBottom="1px solid rgba(255,255,255,0.1)">
              <Flex justify="space-between" align="center" w="100%">
                <Box>
                  <Dialog.Title fontSize="xl" fontWeight="bold" color="#fdcaad" fontFamily="Georgia, serif">
                    Ultra-High Resolution Memory Board Studio ({posts.length} Cards)
                  </Dialog.Title>
                  <Text fontSize="xs" color="gray.400" mt={0.5}>
                    Export print-ready 4K and 8K Ultra HD posters up to 7680px with 5x High-DPI quality.
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
                    onClick={() => setZoomLevel((z) => Math.max(25, z - 25))}
                  >
                    <FiZoomOut /> {zoomLevel}%
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    colorPalette="blue"
                    onClick={() => setZoomLevel((z) => Math.min(200, z + 25))}
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
                    {/* Row 1: Format Presets & Actions */}
                    <Flex direction={{ base: "column", lg: "row" }} gap={3} justify="space-between" align="center">
                      <HStack gap={2} flexWrap="wrap">
                        <Text fontSize="xs" fontWeight="bold" color="#fdcaad" mr={1}>
                          Resolution Preset:
                        </Text>
                        <Button
                          size="xs"
                          variant={preset === "billboard_8k_7680" ? "solid" : "outline"}
                          colorPalette="amber"
                          onClick={() => handlePresetSelect("billboard_8k_7680")}
                          borderRadius="lg"
                          px={3}
                        >
                          <FiMonitor style={{ marginRight: 4 }} />
                          8K Ultra Billboard (7680px • 8-10 Cols)
                        </Button>
                        <Button
                          size="xs"
                          variant={preset === "desktop_4k_3840" ? "solid" : "outline"}
                          colorPalette="teal"
                          onClick={() => handlePresetSelect("desktop_4k_3840")}
                          borderRadius="lg"
                          px={3}
                        >
                          <FiMonitor style={{ marginRight: 4 }} />
                          4K Super Wide Wall (3840px • 6-8 Cols)
                        </Button>
                        <Button
                          size="xs"
                          variant={preset === "mega_wall_2400" ? "solid" : "outline"}
                          colorPalette="blue"
                          onClick={() => handlePresetSelect("mega_wall_2400")}
                          borderRadius="lg"
                        >
                          <FiGrid style={{ marginRight: 4 }} />
                          Mega Wall (2400px)
                        </Button>
                        <Button
                          size="xs"
                          variant={preset === "widescreen_16_9" ? "solid" : "outline"}
                          colorPalette="purple"
                          onClick={() => handlePresetSelect("widescreen_16_9")}
                          borderRadius="lg"
                        >
                          <FiTv style={{ marginRight: 4 }} />
                          16:9 Widescreen
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
                          <FiDownload /> Export Ultra High-Res PNG ({exportDpi}x DPI)
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

                    {/* Row 2: Grid Columns & Text Sizes */}
                    <Flex direction={{ base: "column", md: "row" }} gap={3} justify="space-between" align="center">
                      <HStack gap={2} flexWrap="wrap">
                        <Text fontSize="xs" fontWeight="bold" color="#fdcaad" mr={1}>
                          Columns (More Columns = Wider Wall):
                        </Text>
                        {([2, 3, 4, 5, 6, 7, 8, 9, 10] as const).map((cols) => (
                          <Button
                            key={cols}
                            size="xs"
                            variant={gridColumns === cols ? "solid" : "outline"}
                            colorPalette={cols >= 8 ? "amber" : cols >= 6 ? "teal" : "blue"}
                            onClick={() => setGridColumns(cols)}
                            borderRadius="md"
                          >
                            {cols} Cols {cols >= 8 ? "(8K Wide)" : ""}
                          </Button>
                        ))}
                      </HStack>

                      <HStack gap={2}>
                        <Text fontSize="xs" fontWeight="bold" color="#fdcaad" mr={1}>
                          Text Size:
                        </Text>
                        {(["medium", "large", "extra_large", "ultra_jumbo"] as const).map((sz) => (
                          <Button
                            key={sz}
                            size="xs"
                            variant={textSizeScale === sz ? "solid" : "outline"}
                            colorPalette={sz === "ultra_jumbo" ? "amber" : sz === "extra_large" ? "teal" : "blue"}
                            onClick={() => setTextSizeScale(sz)}
                            borderRadius="md"
                            textTransform="capitalize"
                          >
                            {sz === "ultra_jumbo" ? "8K Jumbo 36px" : sz === "extra_large" ? "Extra 28px" : sz === "large" ? "Large 24px" : "20px"}
                          </Button>
                        ))}
                      </HStack>
                    </Flex>

                    {/* Row 3: Theme, Avatars, & Quality Controls */}
                    <Flex direction={{ base: "column", md: "row" }} gap={3} justify="space-between" align="center">
                      <HStack gap={2} flexWrap="wrap">
                        <Text fontSize="xs" fontWeight="bold" color="gray.300" mr={1}>
                          Theme Style:
                        </Text>
                        {(
                          [
                            { id: "desktop_app", label: "Live App Slate (#E2EAFB)" },
                            { id: "baan7_classic", label: "Chocolate Warm" },
                            { id: "midnight_lagoon", label: "Midnight Lagoon" },
                            { id: "vintage_scrapbook", label: "Vintage Scrapbook" },
                            { id: "golden_gala", label: "Golden Gala" },
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
                          Export DPI Quality Multiplier:
                        </Text>
                        {([2, 3, 4, 5] as const).map((dpi) => (
                          <Button
                            key={dpi}
                            size="xs"
                            variant={exportDpi === dpi ? "solid" : "outline"}
                            colorPalette={dpi === 5 ? "amber" : dpi === 4 ? "teal" : "blue"}
                            onClick={() => setExportDpi(dpi)}
                            borderRadius="md"
                          >
                            {dpi === 5 ? "8K Ultra Max (5x DPI)" : dpi === 4 ? "4K High (4x DPI)" : dpi === 3 ? "Ultra HD (3x)" : "Standard (2x)"}
                          </Button>
                        ))}

                        <Button
                          size="xs"
                          variant={enablePolaroidTilt ? "solid" : "outline"}
                          colorPalette="amber"
                          onClick={() => setEnablePolaroidTilt(!enablePolaroidTilt)}
                          borderRadius="md"
                          ml={2}
                        >
                          <FiLayers style={{ marginRight: 3 }} />
                          {enablePolaroidTilt ? "Live Card Tilt: ON" : "Flat Cards"}
                        </Button>

                        <Button
                          size="xs"
                          variant={highlightTopLiked ? "solid" : "outline"}
                          colorPalette="teal"
                          onClick={() => setHighlightTopLiked(!highlightTopLiked)}
                          borderRadius="md"
                        >
                          <FiGrid style={{ marginRight: 3 }} />
                          {highlightTopLiked ? "Hero Top Highlights: ON" : "OFF"}
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
                  /* ─── SCROLLABLE & RESPONSIVE UNCLIPPED PREVIEW CONTAINER ─── */
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
                    {/* Scaled Outer Bounding Box (Matching Natural Height!) */}
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
                        minH={canvasHeight}
                        p={ preset === "billboard_8k_7680" ? 18 : preset === "desktop_4k_3840" ? 14 : 10 }
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
                        color={themeSpecs.titleColor}
                        position="relative"
                        display="flex"
                        flexDirection="column"
                        justifyContent="space-between"
                      >
                        {/* Poster Header */}
                        <Box
                          p={preset === "billboard_8k_7680" ? 12 : preset === "desktop_4k_3840" ? 9 : 8}
                          borderRadius="2xl"
                          style={{
                            background: themeSpecs.headerBg,
                            border: themeSpecs.headerBorder,
                            backdropFilter: "blur(16px)",
                          }}
                          mb={7}
                        >
                          <Flex justify="space-between" align="center">
                            <Box maxW={preset === "billboard_8k_7680" ? "5200px" : preset === "desktop_4k_3840" ? "2600px" : "1800px"}>
                              <HStack gap={2.5} mb={3}>
                                <Badge
                                  px={4}
                                  py={1.5}
                                  borderRadius="full"
                                  fontSize={preset === "billboard_8k_7680" ? "xl" : "sm"}
                                  fontWeight="bold"
                                  letterSpacing="0.05em"
                                  style={{ background: themeSpecs.badgeBg, color: themeSpecs.badgeText }}
                                >
                                  BAAN 7 OFFICIAL MEMORY WALL 2026
                                </Badge>
                                <Badge variant="outline" colorPalette="amber" px={3} py={1.5} borderRadius="full" fontSize={preset === "billboard_8k_7680" ? "xl" : "sm"}>
                                  {preset === "billboard_8k_7680"
                                    ? `8K ULTRA BILLBOARD (7680px) • ${gridColumns} COLUMNS (${posts.length} CARDS • ${exportDpi}x DPI)`
                                    : preset === "desktop_4k_3840"
                                    ? `4K SUPER WIDE WALL (3840px) • ${gridColumns} COLUMNS (${posts.length} CARDS • ${exportDpi}x DPI)`
                                    : isPaginated
                                    ? `SLIDE ${activePage} OF ${totalPages} (${displayedPosts.length} CARDS)`
                                    : `FULL SIZE COMPLETE POSTER (${posts.length} CARDS)`}
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

                              <Text fontSize={preset === "billboard_8k_7680" ? "2xl" : preset === "desktop_4k_3840" ? "xl" : "lg"} mt={3} lineHeight="1.6" style={{ color: themeSpecs.subtitleColor }}>
                                {customNote}
                              </Text>
                            </Box>

                            {/* Event Stats Counter */}
                            <HStack gap={5}>
                              <Box
                                px={8}
                                py={5}
                                borderRadius="2xl"
                                textAlign="center"
                                style={{
                                  background: themeSpecs.headerBg,
                                  border: themeSpecs.headerBorder,
                                }}
                              >
                                <Text fontSize={preset === "billboard_8k_7680" ? "6xl" : preset === "desktop_4k_3840" ? "5xl" : "4xl"} fontWeight="800" style={{ color: themeSpecs.titleColor }}>
                                  {posts.length}
                                </Text>
                                <Text fontSize={preset === "billboard_8k_7680" ? "md" : "xs"} fontWeight="bold" style={{ color: themeSpecs.subtitleColor }}>
                                  TOTAL MEMORIES
                                </Text>
                              </Box>

                              <Box
                                px={8}
                                py={5}
                                borderRadius="2xl"
                                textAlign="center"
                                style={{
                                  background: themeSpecs.headerBg,
                                  border: themeSpecs.headerBorder,
                                }}
                              >
                                <Text fontSize={preset === "billboard_8k_7680" ? "6xl" : preset === "desktop_4k_3840" ? "5xl" : "4xl"} fontWeight="800" style={{ color: themeSpecs.titleColor }}>
                                  {totalLikes}
                                </Text>
                                <Text fontSize={preset === "billboard_8k_7680" ? "md" : "xs"} fontWeight="bold" style={{ color: themeSpecs.subtitleColor }}>
                                  TOTAL LIKES
                                </Text>
                              </Box>
                            </HStack>
                          </Flex>
                        </Box>

                        {/* Posts Grid Layout (Matching Live App MemoryCard Style) */}
                        <SimpleGrid columns={gridColumns} gap={preset === "billboard_8k_7680" ? 8 : 6} mb={8}>
                          {displayedPosts.map((item, index) => {
                            const isStaff = item.author.role !== "student";
                            const prefix = isStaff ? "P' " : "N' ";
                            const isHero = highlightTopLiked && index < 3 && item.likes > 0;
                            const tilt = getTiltAngle(index);

                            const cardBg = isStaff ? themeSpecs.staffCardBg : themeSpecs.studentCardBg;
                            const cardBorder = isStaff ? themeSpecs.staffCardBorder : themeSpecs.studentCardBorder;
                            const textColor = isStaff ? themeSpecs.staffCardTextColor : themeSpecs.studentCardTextColor;
                            const subTextColor = isStaff ? themeSpecs.staffCardSubText : themeSpecs.studentCardSubText;

                            const authorDisplayName = item.is_anonymous
                              ? "Anonymous"
                              : `${prefix}${item.author.nickname || "Student"}`;

                            return (
                              <Box
                                key={item.id}
                                p={preset === "billboard_8k_7680" ? 8 : preset === "desktop_4k_3840" ? 7 : 6}
                                minH={preset === "billboard_8k_7680" ? "300px" : "240px"}
                                borderRadius="2xl"
                                style={{
                                  background: isHero ? themeSpecs.heroCardBg : cardBg,
                                  border: isHero ? themeSpecs.heroCardBorder : cardBorder,
                                  color: textColor,
                                  transform: tilt,
                                  transition: "all 0.2s ease",
                                }}
                                boxShadow="0 4px 20px -4px rgba(0, 0, 0, 0.25)"
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
                                    w={preset === "billboard_8k_7680" ? "90px" : "64px"}
                                    h={preset === "billboard_8k_7680" ? "22px" : "16px"}
                                    borderRadius="2px"
                                    bg={themeSpecs.tapeColor}
                                    boxShadow="0 1px 3px rgba(0,0,0,0.1)"
                                  />
                                )}

                                <Box>
                                  {/* Author & Header Info */}
                                  <Flex justify="space-between" align="center" mb={3.5}>
                                    <HStack gap={3}>
                                      {avatarMode === "full" && (
                                        <UserAvatar
                                          src={item.author.profile_pic_url}
                                          name={authorDisplayName}
                                          avatarColor={item.author.avatar_color}
                                          size="md"
                                        />
                                      )}

                                      {avatarMode === "compact" && (
                                        <Box
                                          w="14px"
                                          h="14px"
                                          borderRadius="full"
                                          bg={item.author.avatar_color || "#496268"}
                                          flexShrink={0}
                                        />
                                      )}

                                      <Box>
                                        <HStack gap={1.5}>
                                          <Text fontSize={fontSizes.authorName} fontWeight="700" lineHeight="1.2" color={textColor}>
                                            {authorDisplayName}
                                          </Text>
                                          {isHero && (
                                            <Badge colorPalette="amber" size="xs" fontSize="xs" borderRadius="xs">
                                              TOP
                                            </Badge>
                                          )}
                                        </HStack>

                                        {item.author.faculty && (
                                          <Text fontSize={preset === "billboard_8k_7680" ? "sm" : "xs"} fontWeight="500" style={{ color: subTextColor }}>
                                            {item.author.faculty}
                                          </Text>
                                        )}
                                      </Box>
                                    </HStack>

                                    <Badge
                                      px={3.5}
                                      py={1}
                                      borderRadius="full"
                                      fontSize={preset === "billboard_8k_7680" ? "sm" : "xs"}
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
                                    lineHeight="1.65"
                                    mb={3.5}
                                    whiteSpace="pre-wrap"
                                    fontWeight={isHero ? "700" : "500"}
                                    color={textColor}
                                  >
                                    {parseFormattedContent(item.content)}
                                  </Text>

                                  {/* Memory Attached Image (if any) */}
                                  {item.image_url && (
                                    <Box
                                      borderRadius="xl"
                                      overflow="hidden"
                                      mb={3.5}
                                      maxH={preset === "billboard_8k_7680" ? "360px" : "260px"}
                                      border="1.5px solid rgba(0,0,0,0.1)"
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
                                <Text fontSize={fontSizes.timestamp} textAlign="right" fontWeight="500" style={{ color: subTextColor }} mt={2}>
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
                          pt={5}
                          borderTop={themeSpecs.headerBorder}
                          fontSize={preset === "billboard_8k_7680" ? "xl" : "md"}
                          fontWeight="600"
                          style={{ color: themeSpecs.subtitleColor }}
                        >
                          <Text>Curated by Baan 7 Moderator Team • Ween 2026</Text>
                          <Text>
                            {preset === "billboard_8k_7680"
                              ? `8K Ultra Billboard (7680px • ${gridColumns} Columns • ${exportDpi}x High-DPI) • Captured on ${new Date().toLocaleDateString("en-US", { dateStyle: "medium" })}`
                              : preset === "desktop_4k_3840"
                              ? `4K Super Wide Desktop Board (${gridColumns} Columns • ${exportDpi}x High-DPI) • Captured on ${new Date().toLocaleDateString("en-US", { dateStyle: "medium" })}`
                              : `Complete Desktop Style Poster (${posts.length} Cards) • Captured on ${new Date().toLocaleDateString("en-US", { dateStyle: "medium" })}`}
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
