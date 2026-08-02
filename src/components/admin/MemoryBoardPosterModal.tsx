import React, { useState, useRef } from "react";
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
import { FiDownload, FiUpload, FiRefreshCw, FiGrid, FiLayers, FiCheck, FiHeart, FiSliders } from "react-icons/fi";

interface MemoryPostItem {
  id: number;
  content: string;
  image_url: string | null;
  likes: number;
  created_at: string;
  is_anonymous: boolean;
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
        "h-blue": { bg: "rgba(56, 189, 248, 0.25)", color: "#38bdf8", border: "rgba(56, 189, 248, 0.4)" },
        "h-gold": { bg: "rgba(245, 158, 11, 0.25)", color: "#fbbf24", border: "rgba(245, 158, 11, 0.4)" },
        "h-yellow": { bg: "rgba(245, 158, 11, 0.25)", color: "#fbbf24", border: "rgba(245, 158, 11, 0.4)" },
        "h-pink": { bg: "rgba(244, 63, 94, 0.25)", color: "#fda4af", border: "rgba(244, 63, 94, 0.4)" },
        "h-red": { bg: "rgba(239, 68, 68, 0.25)", color: "#fca5a5", border: "rgba(239, 68, 68, 0.4)" },
        "h-green": { bg: "rgba(34, 197, 94, 0.25)", color: "#86efac", border: "rgba(34, 197, 94, 0.4)" },
        "h-purple": { bg: "rgba(168, 85, 247, 0.25)", color: "#c084fc", border: "rgba(168, 85, 247, 0.4)" },
      };

      const style = highlightStyles[tagType] || highlightStyles["h-blue"];

      elements.push(
        <Box
          as="span"
          key={match.index}
          px={1.5}
          py={0.5}
          mx={0.5}
          borderRadius="md"
          fontWeight="600"
          display="inline-block"
          style={{
            background: style.bg,
            color: style.color,
            border: `1px solid ${style.border}`,
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
  const [theme, setTheme] = useState<PosterTheme>("baan7_classic");
  const [customNote, setCustomNote] = useState<string>(
    "Thank you everyone for contributing your heartwarming memories to Baan 7. Here is a complete recap of all memory cards captured together."
  );
  const [enablePolaroidTilt, setEnablePolaroidTilt] = useState<boolean>(false);
  const [highlightTopLiked, setHighlightTopLiked] = useState<boolean>(true);
  const [avatarMode, setAvatarMode] = useState<AvatarMode>("compact");
  const [gridColumns, setGridColumns] = useState<3 | 4 | 5>(4);
  const [sortBy, setSortBy] = useState<"likes" | "newest">("likes");
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Fetch ALL non-hidden memory posts from Supabase
  const { data: posts = [], isLoading, refetch } = useQuery<MemoryPostItem[]>({
    queryKey: ["all_memory_posts_poster", sortBy],
    queryFn: async () => {
      const query = supabase
        .from("posts")
        .select(
          "id, content, image_url, likes, created_at, is_anonymous, author:users(student_id, nickname, avatar_color, role, profile_pic_url, faculty)"
        )
        .eq("type", "memory")
        .eq("is_hidden", false);

      if (sortBy === "likes") {
        query.order("likes", { ascending: false }).order("created_at", { ascending: false });
      } else {
        query.order("created_at", { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []).map((p: any) => ({
        id: p.id,
        content: p.content,
        image_url: p.image_url,
        likes: p.likes ?? 0,
        created_at: p.created_at,
        is_anonymous: p.is_anonymous ?? false,
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
    staleTime: 30000,
  });

  const totalLikes = posts.reduce((sum, item) => sum + (item.likes || 0), 0);

  const handleDownload = async () => {
    if (!posterRef.current) return;
    setIsExporting(true);
    try {
      await downloadElementAsPng(posterRef.current, {
        fileName: `baan7-memory-poster-${Date.now()}.png`,
        pixelRatio: 2,
      });
      toaster.create({
        title: "Export Successful",
        description: "Memory Poster PNG saved to your downloads.",
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
      const res = await uploadElementToSupabaseStorage(posterRef.current, "memory-cards", {
        fileName: `poster-${Date.now()}.png`,
        pixelRatio: 2,
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

  // Design Systems for Poster Canvas
  const themeSpecs = {
    baan7_classic: {
      name: "Baan 7 Warm Ivory & Chocolate",
      canvasBg: "linear-gradient(135deg, #2b1a13 0%, #1f120c 40%, #170d08 100%)",
      headerBg: "rgba(43, 26, 19, 0.85)",
      headerBorder: "1px solid rgba(253, 202, 173, 0.25)",
      titleColor: "#fdcaad",
      subtitleColor: "#e4e2e1",
      badgeBg: "#7c563f",
      badgeText: "#fcf9f8",
      cardBg: "rgba(43, 26, 19, 0.9)",
      cardBorder: "1px solid rgba(253, 202, 173, 0.2)",
      cardTextColor: "#fcf9f8",
      cardSubText: "#c5e0e6",
      accentBadgeBg: "rgba(73, 98, 104, 0.3)",
      accentBadgeText: "#c5e0e6",
      likesBadgeBg: "rgba(239, 68, 68, 0.2)",
      likesBadgeText: "#fca5a5",
      heroCardBg: "linear-gradient(135deg, rgba(124, 86, 63, 0.95), rgba(73, 98, 104, 0.9))",
      heroCardBorder: "2px solid #fdcaad",
      tapeColor: "rgba(253, 202, 173, 0.4)",
    },
    midnight_lagoon: {
      name: "Midnight Lagoon",
      canvasBg: "linear-gradient(135deg, #0b1329 0%, #111c38 50%, #080d1d 100%)",
      headerBg: "rgba(17, 28, 56, 0.85)",
      headerBorder: "1px solid rgba(73, 98, 104, 0.4)",
      titleColor: "#c5e0e6",
      subtitleColor: "#94a3b8",
      badgeBg: "#496268",
      badgeText: "#ffffff",
      cardBg: "rgba(17, 28, 56, 0.9)",
      cardBorder: "1px solid rgba(73, 98, 104, 0.25)",
      cardTextColor: "#f8fafc",
      cardSubText: "#94a3b8",
      accentBadgeBg: "rgba(56, 189, 248, 0.15)",
      accentBadgeText: "#38bdf8",
      likesBadgeBg: "rgba(244, 63, 94, 0.2)",
      likesBadgeText: "#fda4af",
      heroCardBg: "linear-gradient(135deg, rgba(73, 98, 104, 0.95), rgba(15, 23, 42, 0.95))",
      heroCardBorder: "2px solid #38bdf8",
      tapeColor: "rgba(56, 189, 248, 0.3)",
    },
    vintage_scrapbook: {
      name: "Vintage Scrapbook",
      canvasBg: "linear-gradient(135deg, #f7f3ee 0%, #eee6dc 50%, #e2d7c7 100%)",
      headerBg: "#ffffff",
      headerBorder: "1px solid rgba(124, 86, 63, 0.2)",
      titleColor: "#7c563f",
      subtitleColor: "#574235",
      badgeBg: "#7c563f",
      badgeText: "#ffffff",
      cardBg: "#ffffff",
      cardBorder: "1px solid rgba(124, 86, 63, 0.15)",
      cardTextColor: "#1b1c1c",
      cardSubText: "#72787a",
      accentBadgeBg: "rgba(73, 98, 104, 0.1)",
      accentBadgeText: "#496268",
      likesBadgeBg: "rgba(186, 26, 26, 0.1)",
      likesBadgeText: "#ba1a1a",
      heroCardBg: "linear-gradient(135deg, #ffffff 0%, #fffdfa 100%)",
      heroCardBorder: "2px solid #7c563f",
      tapeColor: "rgba(217, 119, 6, 0.3)",
    },
    golden_gala: {
      name: "Golden Gala",
      canvasBg: "linear-gradient(135deg, #181512 0%, #241f1a 50%, #12100e 100%)",
      headerBg: "rgba(36, 31, 26, 0.9)",
      headerBorder: "1px solid rgba(245, 158, 11, 0.35)",
      titleColor: "#fef3c7",
      subtitleColor: "#d97706",
      badgeBg: "#f59e0b",
      badgeText: "#181512",
      cardBg: "rgba(36, 31, 26, 0.92)",
      cardBorder: "1px solid rgba(245, 158, 11, 0.22)",
      cardTextColor: "#fffbeb",
      cardSubText: "#d97706",
      accentBadgeBg: "rgba(245, 158, 11, 0.15)",
      accentBadgeText: "#fbbf24",
      likesBadgeBg: "rgba(245, 158, 11, 0.25)",
      likesBadgeText: "#fef08a",
      heroCardBg: "linear-gradient(135deg, rgba(69, 52, 34, 0.95), rgba(36, 31, 26, 0.95))",
      heroCardBorder: "2px solid #fbbf24",
      tapeColor: "rgba(251, 191, 36, 0.35)",
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
          <Dialog.Content maxW="1360px" bg="#170d08" border="1px solid rgba(253,202,173,0.2)" borderRadius="2xl">
            <Dialog.Header p={5} borderBottom="1px solid rgba(255,255,255,0.1)">
              <Flex justify="space-between" align="center" w="100%">
                <Box>
                  <Dialog.Title fontSize="xl" fontWeight="bold" color="#fdcaad" fontFamily="Georgia, serif">
                    Memory Board Mega Canvas Studio
                  </Dialog.Title>
                  <Text fontSize="xs" color="gray.400" mt={0.5}>
                    Fit all {posts.length} memory cards seamlessly into 1 complete poster canvas.
                  </Text>
                </Box>
                <HStack gap={3}>
                  <Button size="xs" variant="ghost" color="gray.300" onClick={() => refetch()}>
                    <FiRefreshCw /> Refresh Data
                  </Button>
                  <Dialog.CloseTrigger color="gray.400" />
                </HStack>
              </Flex>
            </Dialog.Header>

            <Dialog.Body p={5} maxH="84vh" overflowY="auto">
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
                    <Flex direction={{ base: "column", lg: "row" }} gap={3} justify="space-between" align="center">
                      {/* Theme Picker */}
                      <HStack gap={1.5} flexWrap="wrap">
                        <Text fontSize="xs" fontWeight="bold" color="#fdcaad" mr={1}>
                          Theme:
                        </Text>
                        {(
                          [
                            { id: "baan7_classic", label: "Baan 7 Chocolate" },
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
                            px={3}
                          >
                            {theme === t.id && <FiCheck style={{ marginRight: 3 }} />}
                            {t.label}
                          </Button>
                        ))}
                      </HStack>

                      {/* Export Actions */}
                      <HStack gap={2}>
                        <Button
                          colorPalette="amber"
                          size="xs"
                          onClick={handleDownload}
                          loading={isExporting}
                          disabled={isLoading || posts.length === 0}
                          borderRadius="lg"
                          px={4}
                        >
                          <FiDownload /> Download Canvas PNG
                        </Button>
                        <Button
                          colorPalette="teal"
                          variant="outline"
                          size="xs"
                          onClick={handleUploadSupabase}
                          loading={isExporting}
                          disabled={isLoading || posts.length === 0}
                          borderRadius="lg"
                        >
                          <FiUpload /> Save to Supabase Storage
                        </Button>
                      </HStack>
                    </Flex>

                    {/* Canvas Density & Layout Controls */}
                    <Flex direction={{ base: "column", md: "row" }} gap={3} justify="space-between" align="center">
                      <HStack gap={2} flexWrap="wrap">
                        <Text fontSize="xs" fontWeight="bold" color="gray.300" mr={1}>
                          <FiSliders style={{ display: "inline", marginRight: 4 }} />
                          Grid Density:
                        </Text>
                        <HStack gap={1}>
                          {([3, 4, 5] as const).map((cols) => (
                            <Button
                              key={cols}
                              size="xs"
                              variant={gridColumns === cols ? "solid" : "outline"}
                              colorPalette="blue"
                              onClick={() => setGridColumns(cols)}
                              borderRadius="md"
                            >
                              {cols} Columns
                            </Button>
                          ))}
                        </HStack>

                        <Text fontSize="xs" fontWeight="bold" color="gray.300" ml={3} mr={1}>
                          Avatar Display:
                        </Text>
                        <HStack gap={1}>
                          {(["compact", "hidden", "full"] as const).map((mode) => (
                            <Button
                              key={mode}
                              size="xs"
                              variant={avatarMode === mode ? "solid" : "outline"}
                              colorPalette="purple"
                              onClick={() => setAvatarMode(mode)}
                              borderRadius="md"
                              textTransform="capitalize"
                            >
                              {mode}
                            </Button>
                          ))}
                        </HStack>
                      </HStack>

                      <HStack gap={2}>
                        <Button
                          size="xs"
                          variant={highlightTopLiked ? "solid" : "outline"}
                          colorPalette="teal"
                          onClick={() => setHighlightTopLiked(!highlightTopLiked)}
                          borderRadius="md"
                        >
                          <FiGrid style={{ marginRight: 3 }} />
                          {highlightTopLiked ? "Hero Highlights: ON" : "Hero Highlights: OFF"}
                        </Button>

                        <Button
                          size="xs"
                          variant={enablePolaroidTilt ? "solid" : "outline"}
                          colorPalette="gray"
                          onClick={() => setEnablePolaroidTilt(!enablePolaroidTilt)}
                          borderRadius="md"
                        >
                          <FiLayers style={{ marginRight: 3 }} />
                          {enablePolaroidTilt ? "Tilt: ON" : "Tilt: OFF"}
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
                      Fetching all memory cards from database...
                    </Text>
                  </Flex>
                ) : (
                  /* ─── POSTER CANVAS DOM NODE TO CAPTURE ─── */
                  <Box
                    ref={posterRef}
                    w="1300px"
                    mx="auto"
                    p={8}
                    style={{ background: themeSpecs.canvasBg }}
                    borderRadius="2xl"
                    boxShadow="0 25px 50px -12px rgba(0, 0, 0, 0.7)"
                    fontFamily='"Plus Jakarta Sans", system-ui, sans-serif'
                    color={themeSpecs.cardTextColor}
                    position="relative"
                    overflow="hidden"
                  >
                    {/* Poster Header */}
                    <Box
                      p={6}
                      borderRadius="xl"
                      style={{
                        background: themeSpecs.headerBg,
                        border: themeSpecs.headerBorder,
                        backdropFilter: "blur(16px)",
                      }}
                      mb={6}
                    >
                      <Flex justify="space-between" align="center">
                        <Box maxW="800px">
                          <HStack gap={2} mb={2}>
                            <Badge
                              px={3}
                              py={0.5}
                              borderRadius="full"
                              fontSize="3xs"
                              fontWeight="bold"
                              letterSpacing="0.05em"
                              style={{ background: themeSpecs.badgeBg, color: themeSpecs.badgeText }}
                            >
                              BAAN 7 OFFICIAL MEMORY WALL 2026
                            </Badge>
                            <Badge variant="outline" colorPalette="amber" px={2.5} py={0.5} borderRadius="full" fontSize="3xs">
                              COMPLETE MEMORY CANVAS
                            </Badge>
                          </HStack>

                          <Heading
                            size="xl"
                            fontWeight="800"
                            letterSpacing="-0.02em"
                            fontFamily='"Playfair Display", Georgia, serif'
                            style={{ color: themeSpecs.titleColor }}
                          >
                            Ween 2026 Memory Board Recap
                          </Heading>

                          <Text fontSize="sm" mt={2} lineHeight="1.5" style={{ color: themeSpecs.subtitleColor }}>
                            {customNote}
                          </Text>
                        </Box>

                        {/* Event Stats Counter */}
                        <HStack gap={3}>
                          <Box
                            px={5}
                            py={3}
                            borderRadius="xl"
                            textAlign="center"
                            style={{
                              background: themeSpecs.cardBg,
                              border: themeSpecs.cardBorder,
                            }}
                          >
                            <Text fontSize="2xl" fontWeight="800" style={{ color: themeSpecs.titleColor }}>
                              {posts.length}
                            </Text>
                            <Text fontSize="3xs" fontWeight="bold" style={{ color: themeSpecs.cardSubText }}>
                              TOTAL MEMORIES
                            </Text>
                          </Box>

                          <Box
                            px={5}
                            py={3}
                            borderRadius="xl"
                            textAlign="center"
                            style={{
                              background: themeSpecs.cardBg,
                              border: themeSpecs.cardBorder,
                            }}
                          >
                            <Text fontSize="2xl" fontWeight="800" style={{ color: themeSpecs.titleColor }}>
                              {totalLikes}
                            </Text>
                            <Text fontSize="3xs" fontWeight="bold" style={{ color: themeSpecs.cardSubText }}>
                              TOTAL LIKES
                            </Text>
                          </Box>
                        </HStack>
                      </Flex>
                    </Box>

                    {/* Posts Grid Layout */}
                    <SimpleGrid columns={gridColumns} gap={4}>
                      {posts.map((item, index) => {
                        const isHero = highlightTopLiked && index < 3 && item.likes > 0;
                        const tilt = getTiltAngle(index);

                        return (
                          <Box
                            key={item.id}
                            p={avatarMode === "compact" ? 4 : avatarMode === "hidden" ? 3.5 : 5}
                            borderRadius="xl"
                            style={{
                              background: isHero ? themeSpecs.heroCardBg : themeSpecs.cardBg,
                              border: isHero ? themeSpecs.heroCardBorder : themeSpecs.cardBorder,
                              transform: tilt,
                              transition: "all 0.2s ease",
                            }}
                            boxShadow="sm"
                            display="flex"
                            flexDirection="column"
                            justifyContent="space-between"
                            position="relative"
                          >
                            {/* Decorative Tape Top Center */}
                            {enablePolaroidTilt && (
                              <Box
                                position="absolute"
                                top="-6px"
                                left="50%"
                                style={{ transform: "translateX(-50%)" }}
                                w="44px"
                                h="10px"
                                borderRadius="2px"
                                bg={themeSpecs.tapeColor}
                              />
                            )}

                            <Box>
                              {/* Author & Header Info */}
                              <Flex justify="space-between" align="center" mb={2}>
                                <HStack gap={2}>
                                  {avatarMode === "full" && (
                                    <UserAvatar
                                      src={item.author.profile_pic_url}
                                      name={item.is_anonymous ? "Anonymous" : item.author.nickname ?? "Student"}
                                      avatarColor={item.author.avatar_color}
                                      size="2xs"
                                    />
                                  )}

                                  {avatarMode === "compact" && (
                                    <Box
                                      w="8px"
                                      h="8px"
                                      borderRadius="full"
                                      bg={item.author.avatar_color || "#496268"}
                                      flexShrink={0}
                                    />
                                  )}

                                  <Box>
                                    <HStack gap={1}>
                                      <Text fontSize="xs" fontWeight="bold" lineHeight="1.2">
                                        {item.is_anonymous ? "Anonymous" : item.author.nickname || "Student"}
                                      </Text>
                                      {isHero && (
                                        <Badge colorPalette="amber" size="xs" fontSize="3xs" borderRadius="xs">
                                          TOP
                                        </Badge>
                                      )}
                                    </HStack>

                                    {item.author.faculty && (
                                      <Text fontSize="3xs" style={{ color: themeSpecs.cardSubText }}>
                                        {item.author.faculty}
                                      </Text>
                                    )}
                                  </Box>
                                </HStack>

                                <Badge
                                  px={2}
                                  py={0.5}
                                  borderRadius="full"
                                  fontSize="3xs"
                                  fontWeight="bold"
                                  style={{
                                    background: themeSpecs.likesBadgeBg,
                                    color: themeSpecs.likesBadgeText,
                                  }}
                                >
                                  <FiHeart style={{ display: "inline", marginRight: 2 }} />
                                  {item.likes}
                                </Badge>
                              </Flex>

                              {/* Memory Content Text with Highlight Tag Parsing */}
                              <Text
                                fontSize="xs"
                                lineHeight="1.5"
                                mb={2.5}
                                whiteSpace="pre-wrap"
                                fontWeight={isHero ? "600" : "400"}
                              >
                                {parseFormattedContent(item.content)}
                              </Text>

                              {/* Memory Attached Image (if any) */}
                              {item.image_url && (
                                <Box
                                  borderRadius="lg"
                                  overflow="hidden"
                                  mb={2}
                                  maxH={gridColumns === 5 ? "120px" : "160px"}
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
                            <Text fontSize="3xs" textAlign="right" style={{ color: themeSpecs.cardSubText }} mt={1}>
                              {new Date(item.created_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
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
                      fontSize="xs"
                      fontWeight="500"
                      style={{ color: themeSpecs.subtitleColor }}
                    >
                      <Text>Curated by Baan 7 Moderator Team • Ween 2026</Text>
                      <Text>Captured on {new Date().toLocaleDateString("en-US", { dateStyle: "medium" })}</Text>
                    </Flex>
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
