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
import { RoughNotation } from "react-rough-notation";
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

  // GSAP entrance animation
  useEffect(() => {
    if (!isLoading && containerRef.current) {
      gsap.fromTo(
        containerRef.current.querySelectorAll(".bento-card"),
        { opacity: 0, y: 16 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.1,
          ease: "power2.out",
        }
      );
    }
  }, [isLoading]);

  return (
    <Box
      ref={containerRef}
      mb={12}
      position="relative"
      bg="#F5F0E6"
      p={{ base: 4, md: 7 }}
      borderRadius="3xl"
      border="1px dashed rgba(13, 26, 54, 0.18)"
      boxShadow="0 4px 20px -4px rgba(13, 26, 54, 0.06)"
    >
      {/* Handcrafted Header Tag */}
      <Flex align="center" justify="space-between" mb={6} flexWrap="wrap" gap={3}>
        <HStack gap={3} align="center">
          <Flex
            w={10}
            h={10}
            borderRadius="xl"
            bg="#FFFDF7"
            align="center"
            justify="center"
            border="1px solid rgba(13, 26, 54, 0.12)"
            boxShadow="0 2px 6px rgba(0, 0, 0, 0.04)"
            transform="rotate(-4deg)"
          >
            <Box className="material-symbols-outlined" fontSize="22px" color="#39425B">
              push_pin
            </Box>
          </Flex>
          <VStack align="start" gap={0}>
            <HStack gap={1.5} align="center">
              <Box className="material-symbols-outlined" fontSize="13px" color="brand.solid">
                push_pin
              </Box>
              <Text
                fontSize="2xs"
                fontWeight="800"
                color="brand.solid"
                letterSpacing="0.1em"
                textTransform="uppercase"
                fontFamily="'Mali', sans-serif"
              >
                Handcrafted Memory Board
              </Text>
            </HStack>
            <Heading
              as="h2"
              fontFamily="'Playfair Display', serif"
              fontSize={{ base: "xl", md: "2xl" }}
              fontWeight={700}
              color="brand.900"
            >
              <RoughNotation type="highlight" color="#FFE8A3" show={true} padding={2}>
                Memory Board Baan 7
              </RoughNotation>
            </Heading>
          </VStack>
        </HStack>

        <Badge
          bg="#FFFDF7"
          color="brand.900"
          fontSize="xs"
          px={3}
          py={1}
          borderRadius="full"
          border="1px dashed rgba(13, 26, 54, 0.2)"
          fontWeight="700"
          fontFamily="'Mali', sans-serif"
        >
          #ween2026 memories
        </Badge>
      </Flex>

      {/* Handcrafted Bento Board Layout (Solid Paper Surfaces, No Emojis, No Glossy Gradients) */}
      <Box
        display="grid"
        gridTemplateColumns={{ base: "1fr", lg: "repeat(3, 1fr)" }}
        gap={5}
      >
        {/* Featured Memories Polaroid Canvas Card (Spans 2 cols on lg) */}
        <Box
          className="bento-card"
          gridColumn={{ base: "1", lg: "span 2" }}
          position="relative"
          overflow="visible"
          borderRadius="2xl"
          bg="#FFFDF7"
          color="brand.900"
          p={{ base: 5, md: 6 }}
          border="1px solid rgba(13, 26, 54, 0.12)"
          boxShadow="0 8px 30px -6px rgba(13, 26, 54, 0.08)"
          display="flex"
          flexDirection="column"
          justifyContent="space-between"
          minH="320px"
        >
          {/* Top Washi Tape Accent */}
          <Box
            position="absolute"
            top="-10px"
            left="40px"
            w="65px"
            h="18px"
            bg="rgba(255, 223, 137, 0.75)"
            borderLeft="1px dashed rgba(57, 66, 91, 0.25)"
            borderRight="1px dashed rgba(57, 66, 91, 0.25)"
            boxShadow="0 1px 3px rgba(0, 0, 0, 0.04)"
            transform="rotate(-2deg)"
            zIndex={2}
          />

          <VStack align="start" gap={1.5} mb={4} zIndex={1}>
            <HStack gap={1.5} align="center">
              <Box className="material-symbols-outlined" fontSize="14px" color="brand.solid">
                auto_awesome
              </Box>
              <Text fontSize="xs" fontWeight="700" color="brand.solid" textTransform="uppercase">
                Handcrafted Highlights
              </Text>
            </HStack>
            <Text
              fontSize={{ base: "sm", md: "md" }}
              color="rgba(13, 26, 54, 0.8)"
              maxW="48ch"
              lineHeight={1.6}
              fontFamily="'Mali', sans-serif"
            >
              Pin your favorite orientation memories, leave warm notes, and see who liked posts in Baan 7!
            </Text>
          </VStack>

          {/* Featured Cards Row (Paper Card Design) */}
          <Box zIndex={1} mt="auto">
            {isLoading ? (
              <Flex align="center" justify="center" py={8}>
                <Spinner color="brand.solid" size="md" />
              </Flex>
            ) : posts.length === 0 ? (
              <Box
                p={4}
                borderRadius="xl"
                bg="#E2EAFB"
                border="1px dashed rgba(59, 106, 191, 0.3)"
              >
                <Text fontSize="xs" color="brand.900" fontFamily="'Mali', sans-serif">
                  No memories shared yet. Be the first to pin one on the board!
                </Text>
              </Box>
            ) : (
              <Box
                display="grid"
                gridTemplateColumns={{ base: "1fr", sm: "repeat(2, 1fr)" }}
                gap={4}
              >
                {posts.slice(0, 2).map((post, idx) => {
                  const isAnon = post.is_anonymous;
                  const isStaff = post.author.role !== "student";
                  const prefix = isStaff ? "P' " : "N' ";
                  const authorName = isAnon
                    ? "Anonymous"
                    : `${prefix}${post.author.nickname || "Guest"}`;
                  const cardBg = isStaff ? "#FCE8E6" : "#E2EAFB";
                  const rotation = idx % 2 === 0 ? -1.2 : 1.5;

                  return (
                    <Box
                      key={post.id}
                      bg={cardBg}
                      p={4}
                      borderRadius="xl"
                      border="1px solid"
                      borderColor={isStaff ? "rgba(242, 100, 117, 0.25)" : "rgba(59, 106, 191, 0.20)"}
                      boxShadow="0 4px 16px -2px rgba(13, 26, 54, 0.08)"
                      position="relative"
                      transform={`rotate(${rotation}deg)`}
                      transition="all 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
                      _hover={{
                        transform: "rotate(0deg) translateY(-4px)",
                        boxShadow: "0 10px 24px -4px rgba(13, 26, 54, 0.14)",
                      }}
                    >
                      {/* Paper Note Tape */}
                      <Box
                        position="absolute"
                        top="-8px"
                        left="50%"
                        transform="translateX(-50%) rotate(-1deg)"
                        w="45px"
                        h="14px"
                        bg="rgba(255, 223, 137, 0.65)"
                        borderLeft="1px dashed rgba(57, 66, 91, 0.2)"
                        borderRight="1px dashed rgba(57, 66, 91, 0.2)"
                        pointerEvents="none"
                      />

                      <Flex align="center" gap={2} mb={2}>
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
                            fontWeight="800"
                            color="brand.900"
                            lineClamp={1}
                          >
                            {authorName}
                          </Text>
                        </VStack>
                        <Badge
                          bg="rgba(242, 100, 117, 0.12)"
                          color="#f26475"
                          fontSize="3xs"
                          px={2}
                          py={0.5}
                          borderRadius="full"
                          fontWeight="700"
                          display="inline-flex"
                          alignItems="center"
                          gap={1}
                        >
                          <Box className="material-symbols-outlined fill" fontSize="12px" color="#f26475">
                            favorite
                          </Box>
                          {post.likes}
                        </Badge>
                      </Flex>

                      {post.image_url ? (
                        <Box
                          h="95px"
                          borderRadius="lg"
                          overflow="hidden"
                          mb={2}
                          border="1px solid rgba(13, 26, 54, 0.1)"
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
                        color="brand.900"
                        lineClamp={2}
                        lineHeight={1.5}
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

        {/* Secondary Column: Handcrafted Stats & Tactile Shortcut */}
        <VStack
          className="bento-card"
          gap={4}
          align="stretch"
          justify="space-between"
        >
          {/* Community Stats Widget */}
          <Box
            bg="#FFFDF7"
            borderRadius="2xl"
            p={5}
            border="1px solid rgba(13, 26, 54, 0.12)"
            boxShadow="0 4px 16px -2px rgba(13, 26, 54, 0.06)"
            flex={1}
          >
            <HStack gap={1.5} align="center" mb={3}>
              <Box className="material-symbols-outlined" fontSize="15px" color="brand.900">
                analytics
              </Box>
              <Text
                fontSize="2xs"
                fontWeight="800"
                color="brand.900"
                textTransform="uppercase"
                letterSpacing="0.06em"
                fontFamily="'Mali', sans-serif"
              >
                Community Activity
              </Text>
            </HStack>

            <Box display="grid" gridTemplateColumns="repeat(2, 1fr)" gap={3}>
              <Box
                p={3.5}
                borderRadius="xl"
                bg="#E2EAFB"
                border="1px solid rgba(59, 106, 191, 0.2)"
              >
                <HStack gap={1.5} color="brand.solid" mb={1}>
                  <Box className="material-symbols-outlined" fontSize="16px">
                    photo_library
                  </Box>
                  <Text fontSize="2xs" fontWeight="700">
                    Memories
                  </Text>
                </HStack>
                <Text fontSize="xl" fontWeight="900" color="brand.900">
                  {stats.totalMemories}+
                </Text>
              </Box>

              <Box
                p={3.5}
                borderRadius="xl"
                bg="#FCE8E6"
                border="1px solid rgba(242, 100, 117, 0.25)"
              >
                <HStack gap={1.5} color="#f26475" mb={1}>
                  <Box className="material-symbols-outlined fill" fontSize="16px">
                    favorite
                  </Box>
                  <Text fontSize="2xs" fontWeight="700">
                    Total Likes
                  </Text>
                </HStack>
                <Text fontSize="xl" fontWeight="900" color="brand.900">
                  {stats.totalLikes}+
                </Text>
              </Box>
            </Box>
          </Box>

          {/* Tactile Navigation Button (Solid Warm Navy - NO Gradient) */}
          <Link to="/board" style={{ textDecoration: "none" }}>
            <Box
              bg="#2E3A4B"
              color="white"
              borderRadius="2xl"
              p={5}
              role="group"
              border="1px solid rgba(13, 26, 54, 0.2)"
              boxShadow="0 6px 20px -4px rgba(46, 58, 75, 0.35)"
              transition="all 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
              _hover={{
                transform: "translateY(-3px)",
                bg: "#242F3E",
                boxShadow: "0 12px 28px -4px rgba(46, 58, 75, 0.45)",
              }}
            >
              <Flex align="center" justify="space-between" w="100%">
                <VStack align="start" gap={0.5}>
                  <Text fontSize="sm" fontWeight="800">
                    Go to Memory Board
                  </Text>
                  <Text fontSize="2xs" color="rgba(255, 255, 255, 0.75)" fontFamily="'Mali', sans-serif">
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
