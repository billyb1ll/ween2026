import { useEffect, useRef } from "react";
import {
  Box,
  Flex,
  Heading,
  HStack,
  Text,
  VStack,
  Image,
  Badge,
  Spinner,
} from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { UserAvatar } from "./UserAvatar";
import gsap from "gsap";

interface MemoryPostSummary {
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

export function useMemoryBentoData() {
  return useQuery({
    queryKey: ["memory_bento_showcase"],
    queryFn: async () => {
      const [postsRes, allLikesRes] = await Promise.all([
        supabase
          .from("posts")
          .select(
            "id, content, image_url, likes, created_at, is_anonymous, author:users(student_id, nickname, avatar_color, role, profile_pic_url, faculty)",
            { count: "exact" }
          )
          .eq("type", "memory")
          .eq("is_hidden", false)
          .order("likes", { ascending: false })
          .limit(4),
        supabase
          .from("posts")
          .select("likes")
          .eq("type", "memory")
          .eq("is_hidden", false),
      ]);

      if (postsRes.error) throw postsRes.error;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: MemoryPostSummary[] = (postsRes.data ?? []).map((p: any) => ({
        id: p.id,
        content: p.content,
        image_url: p.image_url,
        likes: p.likes ?? 0,
        created_at: p.created_at,
        is_anonymous: p.is_anonymous ?? false,
        author: {
          student_id: p.author?.student_id ?? "",
          nickname: p.author?.nickname ?? "Guest Whitelist",
          avatar_color: p.author?.avatar_color ?? "#496268",
          role: p.author?.role ?? "student",
          profile_pic_url: p.author?.profile_pic_url ?? null,
          faculty: p.author?.faculty ?? null,
        },
      }));

      const totalLikesSum = (allLikesRes.data ?? []).reduce(
        (acc, curr) => acc + (Number(curr.likes) || 0),
        0
      );

      return {
        posts: mapped,
        totalMemories: postsRes.count ?? mapped.length,
        totalLikes: totalLikesSum,
      };
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });
}

export function MemoryBoardBento() {
  const { data, isLoading } = useMemoryBentoData();
  const containerRef = useRef<HTMLDivElement>(null);

  const posts = data?.posts ?? [];
  const stats = {
    totalMemories: data?.totalMemories ?? 0,
    totalLikes: data?.totalLikes ?? 0,
  };

  // GSAP subtle entrance animation
  useEffect(() => {
    if (!isLoading && containerRef.current) {
      gsap.fromTo(
        containerRef.current.querySelectorAll(".bento-card"),
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.12,
          ease: "power2.out",
        }
      );
    }
  }, [isLoading]);

  return (
    <Box ref={containerRef} mb={12} position="relative">
      <Box mb={5}>
        <HStack gap={2} align="center" mb={1}>
          <Box w={2.5} h={2.5} borderRadius="full" bg="#f26475" className="pulse-dot" />
          <Text
            fontSize="xs"
            fontWeight="800"
            color="#f26475"
            letterSpacing="0.1em"
            textTransform="uppercase"
          >
            Live Board Showcase
          </Text>
        </HStack>
        <Heading
          as="h2"
          fontFamily="'Playfair Display', serif"
          fontSize={{ base: "xl", md: "2xl" }}
          fontWeight={700}
          color="fg.default"
        >
          Memory Board Baan 7
        </Heading>
      </Box>

      {/* Bento Grid */}
      <Box
        display="grid"
        gridTemplateColumns={{ base: "1fr", lg: "repeat(3, 1fr)" }}
        gap={4}
      >
        {/* Main Feature Bento Card (Spans 2 cols on lg) */}
        <Box
          className="bento-card"
          gridColumn={{ base: "1", lg: "span 2" }}
          position="relative"
          overflow="hidden"
          borderRadius="2xl"
          bg="linear-gradient(135deg, #1e1410 0%, #3a2418 50%, #573b2a 100%)"
          color="white"
          p={{ base: 5, md: 7 }}
          border="1px solid rgba(255, 255, 255, 0.08)"
          boxShadow="0 20px 50px rgba(30, 20, 16, 0.35)"
          display="flex"
          flexDirection="column"
          justifyContent="space-between"
          minH="320px"
        >
          {/* Background Ambient Glow */}
          <Box
            position="absolute"
            top="-80px"
            right="-80px"
            w="350px"
            h="350px"
            bg="rgba(242, 100, 117, 0.18)"
            filter="blur(80px)"
            borderRadius="full"
            pointerEvents="none"
          />
          <Box
            position="absolute"
            bottom="-60px"
            left="-60px"
            w="250px"
            h="250px"
            bg="rgba(255, 185, 100, 0.12)"
            filter="blur(60px)"
            borderRadius="full"
            pointerEvents="none"
          />

          {/* Card Top Content */}
          <VStack align="start" gap={2} zIndex={1} mb={4}>
            <HStack gap={2}>
              <Badge
                bg="rgba(255, 255, 255, 0.12)"
                color="white"
                fontSize="2xs"
                px={2.5}
                py={0.5}
                borderRadius="full"
                backdropFilter="blur(4px)"
              >
                📌 Featured Highlights
              </Badge>
            </HStack>
            <Text
              fontSize={{ base: "sm", md: "md" }}
              color="rgba(255, 255, 255, 0.85)"
              maxW="42ch"
              lineHeight={1.6}
            >
              Share photos, leave notes, and see who liked memories in Baan 7!
            </Text>
          </VStack>

          {/* Memory Post Previews Row */}
          <Box zIndex={1} mt="auto">
            {isLoading ? (
              <Flex align="center" justify="center" py={8}>
                <Spinner color="white" size="sm" />
              </Flex>
            ) : posts.length === 0 ? (
              <Box
                p={4}
                borderRadius="xl"
                bg="rgba(255, 255, 255, 0.05)"
                border="1px dashed rgba(255, 255, 255, 0.2)"
              >
                <Text fontSize="xs" color="rgba(255, 255, 255, 0.7)">
                  No memories shared yet. Be the first to share one!
                </Text>
              </Box>
            ) : (
              <Box
                display="grid"
                gridTemplateColumns={{ base: "1fr", sm: "repeat(2, 1fr)" }}
                gap={3}
              >
                {posts.slice(0, 2).map((post) => {
                  const isAnon = post.is_anonymous;
                  const isStaff = post.author.role !== "student";
                  const prefix = isStaff ? "P' " : "N' ";
                  const authorName = isAnon
                    ? "Anonymous"
                    : `${prefix}${post.author.nickname || "Guest"}`;

                  return (
                    <Box
                      key={post.id}
                      bg="rgba(255, 255, 255, 0.08)"
                      backdropFilter="blur(8px)"
                      p={3.5}
                      borderRadius="xl"
                      border="1px solid rgba(255, 255, 255, 0.12)"
                      transition="all 0.3s ease"
                      _hover={{
                        bg: "rgba(255, 255, 255, 0.14)",
                        transform: "translateY(-2px)",
                      }}
                    >
                      <Flex align="center" gap={2.5} mb={2}>
                        <UserAvatar
                          src={!isAnon ? post.author.profile_pic_url : null}
                          name={authorName}
                          avatarColor={post.author.avatar_color}
                          size="28px"
                          fontSize="2xs"
                        />
                        <VStack align="start" gap={0} flex={1}>
                          <Text
                            fontSize="xs"
                            fontWeight="700"
                            color="white"
                            lineClamp={1}
                          >
                            {authorName}
                          </Text>
                          <Text fontSize="3xs" color="rgba(255, 255, 255, 0.6)">
                            {post.likes} {post.likes === 1 ? "like" : "likes"}
                          </Text>
                        </VStack>
                        <Badge colorPalette="pink" fontSize="3xs" px={1.5}>
                          ❤️ {post.likes}
                        </Badge>
                      </Flex>
                      {post.image_url ? (
                        <Box
                          h="90px"
                          borderRadius="lg"
                          overflow="hidden"
                          mb={1.5}
                        >
                          <Image
                            src={post.image_url}
                            alt="Memory highlight"
                            w="100%"
                            h="100%"
                            objectFit="cover"
                          />
                        </Box>
                      ) : null}
                      <Text
                        fontSize="2xs"
                        color="rgba(255, 255, 255, 0.9)"
                        lineClamp={2}
                        lineHeight={1.4}
                        fontFamily="'Mali', sans-serif"
                      >
                        {post.content}
                      </Text>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        </Box>

        {/* Secondary Bento Card: Stats & Quick CTA */}
        <VStack
          className="bento-card"
          gap={4}
          align="stretch"
          justify="space-between"
        >
          {/* Stats Widget */}
          <Box
            bg="bg.surface"
            borderRadius="2xl"
            p={5}
            border="1px solid"
            borderColor="border.default"
            boxShadow="sm"
            flex={1}
          >
            <Text
              fontSize="2xs"
              fontWeight="700"
              color="fg.subtle"
              textTransform="uppercase"
              letterSpacing="0.05em"
              mb={3}
            >
              📊 Community Activity
            </Text>

            <Box
              display="grid"
              gridTemplateColumns="repeat(2, 1fr)"
              gap={3}
            >
              <Box
                p={3}
                borderRadius="xl"
                bg="rgba(59, 106, 191, 0.06)"
                border="1px solid rgba(59, 106, 191, 0.15)"
              >
                <HStack gap={1.5} color="brand.solid" mb={1}>
                  <Box className="material-symbols-outlined" fontSize="16px">
                    photo_library
                  </Box>
                  <Text fontSize="2xs" fontWeight="700">
                    Memories
                  </Text>
                </HStack>
                <Text fontSize="xl" fontWeight="900" color="fg.default">
                  {stats.totalMemories}+
                </Text>
              </Box>

              <Box
                p={3}
                borderRadius="xl"
                bg="rgba(242, 100, 117, 0.08)"
                border="1px solid rgba(242, 100, 117, 0.2)"
              >
                <HStack gap={1.5} color="#f26475" mb={1}>
                  <Box className="material-symbols-outlined fill" fontSize="16px">
                    favorite
                  </Box>
                  <Text fontSize="2xs" fontWeight="700">
                    Total Likes
                  </Text>
                </HStack>
                <Text fontSize="xl" fontWeight="900" color="fg.default">
                  {stats.totalLikes}+
                </Text>
              </Box>
            </Box>
          </Box>

          {/* Navigation Shortcut Card */}
          <Link to="/board" style={{ textDecoration: "none" }}>
            <Box
              bg="linear-gradient(135deg, #496268 0%, #2c3e42 100%)"
              color="white"
              borderRadius="2xl"
              p={5}
              role="group"
              transition="all 0.35s cubic-bezier(0.16, 1, 0.3, 1)"
              _hover={{
                transform: "translateY(-3px)",
                boxShadow: "0 12px 30px rgba(73, 98, 104, 0.35)",
              }}
            >
              <Flex align="center" justify="space-between" w="100%">
                <VStack align="start" gap={0.5}>
                  <Text fontSize="sm" fontWeight="800">
                    Go to Memory Board
                  </Text>
                  <Text fontSize="2xs" color="rgba(255, 255, 255, 0.75)">
                    Explore notes & see who liked them
                  </Text>
                </VStack>
                <Flex
                  w={10}
                  h={10}
                  borderRadius="full"
                  bg="rgba(255, 255, 255, 0.15)"
                  align="center"
                  justify="center"
                  transition="transform 0.3s ease"
                  _groupHover={{ transform: "translateX(4px)" }}
                >
                  <Box className="material-symbols-outlined" fontSize="20px">
                    arrow_forward
                  </Box>
                </Flex>
              </Flex>
            </Box>
          </Link>
        </VStack>
      </Box>
    </Box>
  );
}
