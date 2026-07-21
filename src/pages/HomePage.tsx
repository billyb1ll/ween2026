import { Box, Flex, Heading, HStack, Text, VStack } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { useEffect, useState, lazy, Suspense } from "react";
import { getImmichConfig } from "../utils/immich";
import { toaster } from "../components/ui/toaster";
import { supabase } from "../lib/supabase";
import { motion, useReducedMotion, useScroll } from "framer-motion";
import type { Variants } from "framer-motion";
import { FeaturedCarousel } from "../components/FeaturedCarousel";

const ThreeBlob = lazy(() =>
  import("../components/ThreeBlob").then((module) => ({
    default: module.ThreeBlob,
  }))
);

interface FeatureItem {
  title: string;
  description?: string;
  icon: string;
  color: string;
  textColor: string;
  link: string;
  size: "large" | "wide" | "small";
  avatars?: string[];
  subtitle?: string;
  time?: string;
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardVariants = (shouldReduceMotion: boolean): Variants => ({
  hidden: {
    y: shouldReduceMotion ? 0 : 30,
    opacity: 0,
  },
  visible: {
    y: 0,
    opacity: 1,
    transition: shouldReduceMotion
      ? { duration: 0.01 }
      : { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
});

export function HomePage() {
  const [onlineCount] = useState(42);
  const [isMobile, setIsMobile] = useState(true);
  const { scrollYProgress } = useScroll();
  const shouldReduceMotion = useReducedMotion() ?? false;
  const pathLength = shouldReduceMotion ? 1 : scrollYProgress;
  const variants = cardVariants(shouldReduceMotion);

  const [vibecheckEnabled, setVibecheckEnabled] = useState(true);
  const [hypeBoardEnabled, setHypeBoardEnabled] = useState(true);
  const [featuredPhotos, setFeaturedPhotos] = useState<{ url: string; alt?: string }[]>([]);

  // Sync system config flags from system_config
  useEffect(() => {
    let active = true;
    const fetchConfigs = async () => {
      try {
        const { data, error } = await supabase
          .from("system_config")
          .select("key, value, text_value")
          .in("key", ["vibecheck_enabled", "enable_hype_board", "featured_photo_urls"]);
        if (!error && data && active) {
          const vc = data.find((r) => r.key === "vibecheck_enabled");
          const hb = data.find((r) => r.key === "enable_hype_board");
          const fp = data.find((r) => r.key === "featured_photo_urls");
          if (vc !== undefined) setVibecheckEnabled(Boolean(vc.value));
          if (hb !== undefined) setHypeBoardEnabled(Boolean(hb.value));
          if (fp?.text_value) {
            try {
              const parsed = JSON.parse(fp.text_value);
              if (Array.isArray(parsed)) {
                setFeaturedPhotos(parsed.map((item) => typeof item === "string" ? { url: item, alt: "Featured photo" } : item));
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      } catch (err) {
        console.error("Error fetching system config:", err);
      }
    };
    fetchConfigs();

    const syncChannel = supabase.channel("live_chat:system_config_sync");
    syncChannel
      .on("broadcast", { event: "config_change" }, (payload) => {
        if (active && payload.payload) {
          if (payload.payload.key === "vibecheck_enabled") {
            setVibecheckEnabled(Boolean(payload.payload.value));
          }
          if (payload.payload.key === "enable_hype_board") {
            setHypeBoardEnabled(Boolean(payload.payload.value));
          }
          if (payload.payload.key === "featured_photo_urls" && payload.payload.text_value) {
            try {
              const parsed = JSON.parse(payload.payload.text_value);
              if (Array.isArray(parsed)) {
                setFeaturedPhotos(parsed.map((item) => typeof item === "string" ? { url: item, alt: "Featured photo" } : item));
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(syncChannel);
    };
  }, []);

  const features = [
    {
      title: vibecheckEnabled ? "Interactive Vibe Check" : "Stay Tuned! (Vibe Check)",
      description: vibecheckEnabled
        ? "Find hidden peers and staff members around the campus! Swipe to collect cards and make new friends."
        : "Interactive Vibe Check is temporarily disabled by administrators (profile setup is suspended).",
      icon: vibecheckEnabled ? "mood" : "lock_clock",
      color: vibecheckEnabled ? "brand.100" : "bg.canvas",
      textColor: vibecheckEnabled ? "brand.600" : "border.default",
      link: vibecheckEnabled ? "/vibe-check" : "#",
      size: "large" as const,
      avatars: vibecheckEnabled ? ["B7", "Fr", "+12"] : undefined,
    },
    {
      title: hypeBoardEnabled ? "Real-time Message Board" : "Board Warming Up",
      description: hypeBoardEnabled
        ? "Share thoughts, send love, upload media, and hype up your fellow Baan 7 peers in real-time."
        : "The live chat is temporarily paused. Memory Board and posts are still accessible.",
      icon: hypeBoardEnabled ? "campaign" : "hourglass_top",
      color: hypeBoardEnabled ? "accent.solid" : "bg.surface",
      textColor: hypeBoardEnabled ? "brand.900" : "fg.subtle",
      link: "/board",
      size: "wide" as const,
    },
    {
      title: "Exclusive Gallery",
      description: "Browse orientation activity highlights with our face-matching search engine.",
      icon: "photo_library",
      color: "bg.surface",
      textColor: "fg.default",
      link: "/gallery",
      size: "small" as const,
    },
    {
      title: "Next Event",
      subtitle: "First Meet",
      time: "Today, 18:00",
      icon: "event",
      color: "bg.canvas",
      textColor: "fg.default",
      link: "/board",
      size: "small" as const,
    },
  ];

  const [nextEvent, setNextEvent] = useState({
    title: "First Meet",
    isoTime: "",
  });
  const [countdownText, setCountdownText] = useState("");

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const { data } = await supabase
          .from("event_config")
          .select("*")
          .eq("key", "next_event")
          .single();
        if (data) {
          setNextEvent({
            title: data.title,
            isoTime: data.event_time,
          });
        }
      } catch (err) {
        console.error("Error fetching event config:", err);
      }
    };
    fetchEvent();
  }, []);

  useEffect(() => {
    if (!nextEvent.isoTime) return;

    const calculateCountdown = () => {
      const target = new Date(nextEvent.isoTime).getTime();
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setCountdownText("Event has started!");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      let countdownStr = "";
      if (days > 0) countdownStr += `${days}d `;
      countdownStr += `${hours.toString().padStart(2, "0")}h `;
      countdownStr += `${minutes.toString().padStart(2, "0")}m `;
      countdownStr += `${seconds.toString().padStart(2, "0")}s`;

      setCountdownText(`Starts in ${countdownStr}`);
    };

    calculateCountdown();
    const timer = setInterval(calculateCountdown, 1000);
    return () => clearInterval(timer);
  }, [nextEvent.isoTime]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <Box position="relative">
      {/* 3D Canvas Background Scroll Animation (only on desktop) */}
      {!isMobile && (
        <Suspense fallback={null}>
          <ThreeBlob />
        </Suspense>
      )}

      <Box
        position="relative"
        zIndex={10}
        maxW="var(--container-max)"
        mx="auto"
        px={{ base: 4, md: 16 }}
        pt={{ base: 2, md: 32 }}
      >
        {/* Live Status */}
        <Flex justify="space-between" align="center" mb={{ base: 4, md: 8 }}>
          <HStack
            bg="bg.surface"
            px={3}
            py={1.5}
            borderRadius="full"
            border="1px solid"
            borderColor="border.subtle"
            boxShadow="var(--shadow-ambient)"
            gap={2}
          >
            <Box
              w="8px"
              h="8px"
              bg="brand.fg"
              borderRadius="full"
              animation="pulse-dot 2s infinite"
            />
            <Text
              fontSize="xs"
              fontWeight="600"
              letterSpacing="0.05em"
              color="fg.subtle"
            >
              {onlineCount} Freshmen Online
            </Text>
          </HStack>
        </Flex>

        {/* Hero Section — mobile compact, desktop spacious */}
        <Box
          as="section"
          display="flex"
          flexDirection="column"
          justifyContent="center"
          py={{ base: 6, md: 20 }}
          animation="fade-in-up 0.8s var(--ease-out-expo) both"
        >
          <Heading
            as="h1"
            fontFamily="'Playfair Display', serif"
            fontSize={{
              base: "clamp(2rem, 8vw, 2.8rem)",
              md: "clamp(3rem, 5vw, 4.5rem)",
            }}
            fontWeight={700}
            lineHeight={1.05}
            letterSpacing="-0.03em"
            color="fg.default"
            mb={{ base: 4, md: 6 }}
          >
            Welcome to <br />
            <Text
              as="span"
              color="brand.900"
              fontStyle="italic"
              fontFamily="'Playfair Display', serif"
            >
              Baan 7
            </Text>
          </Heading>

          <Text
            fontSize={{ base: "md", md: "xl" }}
            color="fg.muted"
            maxW="xl"
            lineHeight={1.6}
            mb={{ base: 8, md: 12 }}
          >
            Welcome to Baan 7—your official orientation portal. Connect with peers, engage with live activities, and access exclusive event content seamlessly.
          </Text>

          <Flex flexWrap="wrap" gap={3} align="center">
            <Link to={vibecheckEnabled ? "/vibe-check" : "/board"}>
              <HStack
                as="span"
                display="inline-flex"
                bg="accent.solid"
                color="brand.900"
                px={{ base: 6, md: 8 }}
                py={{ base: 3, md: 4 }}
                borderRadius="full"
                fontWeight="600"
                fontSize="sm"
                letterSpacing="0.05em"
                gap={2}
                transition="all 0.3s var(--ease-out-quart)"
                boxShadow="0 6px 20px color-mix(in srgb, var(--chakra-colors-accent-solid) 25%, transparent)"
                _hover={{
                  transform: "translateY(-2px)",
                  boxShadow:
                    "0 10px 30px color-mix(in srgb, var(--chakra-colors-accent-solid) 35%, transparent)",
                }}
                _active={{ transform: "scale(0.97)" }}
              >
                <Text>Start Exploring</Text>
                <Box className="material-symbols-outlined" aria-hidden="true" fontSize="lg">
                  arrow_downward
                </Box>
              </HStack>
            </Link>

            <a href="#features">
              <HStack
                display="inline-flex"
                bg="bg.surface"
                border="1px solid"
                borderColor="border.subtle"
                color="fg.default"
                px={{ base: 6, md: 8 }}
                py={{ base: 3, md: 4 }}
                borderRadius="full"
                fontWeight="600"
                fontSize="sm"
                letterSpacing="0.05em"
                gap={2}
                transition="all 0.3s var(--ease-out-quart)"
                _hover={{
                  bg: "bg.hero",
                  transform: "translateY(-1px)",
                }}
              >
                <Text>Explore Features</Text>
                <Box className="material-symbols-outlined" aria-hidden="true" fontSize="lg">
                  arrow_downward
                </Box>
              </HStack>
            </a>
          </Flex>
        </Box>

        {/* Connecting SVG Line — hidden on mobile, visible on md+ */}
        <Box
          position="relative"
          mx="auto"
          maxW="100%"
          overflow="visible"
          my={-12}
          display={{ base: "none", md: "block" }}
        >
          <svg
            width="100%"
            height="140"
            viewBox="0 0 1200 140"
            fill="none"
            preserveAspectRatio="xMidYMid meet"
            className="svg-block"
            aria-hidden="true"
          >
            <motion.path
              d="M 100 100 Q 350 100, 550 100 C 600 100, 620 70, 600 40 C 580 50, 570 80, 550 100 C 500 100, 480 70, 500 40 C 520 50, 530 80, 550 100 C 570 80, 570 40, 550 15 C 530 40, 530 80, 550 100 Q 750 100, 1100 100"
              stroke="var(--chakra-colors-accent-solid)"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ pathLength }}
            />
          </svg>
        </Box>

        {/* Face Claim Banner */}
        <Box mb={8} animation="fade-in-up 0.7s var(--ease-out-expo) both">
          <Link to="/face-claim">
            <Flex w="100%" bg="white" border="2px dashed" borderColor="brand.solid" borderRadius="2xl" p={{ base: 5, md: 8 }} align="center" justify="center" direction={{ base: "column", md: "row" }} gap={4} transition="all 0.3s var(--ease-out-quart)" _hover={{ bg: "brand.subtle", transform: "translateY(-4px)", boxShadow: "var(--shadow-card-hover)" }}>
              <Flex bg="brand.solid" color="white" w={12} h={12} borderRadius="full" align="center" justify="center" flexShrink={0}>
                <Box as="span" className="material-symbols-outlined" fontSize="24px">face</Box>
              </Flex>
              <VStack align={{ base: "center", md: "start" }} gap={1} flex={1}>
                <Heading as="h2" fontSize={{ base: "md", md: "lg" }} color="brand.solid">AI Face Match is now live!</Heading>
                <Text color="fg.muted" fontSize="sm" textAlign={{ base: "center", md: "left" }} maxW="65ch">
                  Unclaimed faces have been detected in our orientation gallery. Find yours and claim it before someone else does!
                </Text>
              </VStack>
              <Box as="span" className="material-symbols-outlined" color="brand.solid" display={{ base: "none", md: "block" }}>arrow_forward</Box>
            </Flex>
          </Link>
        </Box>

        {/* Featured Carousel — only when both modules are live */}
        {vibecheckEnabled && hypeBoardEnabled && <FeaturedCarousel />}

        {/* Features Grid — mobile-first: stacked with hierarchy */}
        <Box as="section" py={{ base: 4, md: 10 }} id="features">
          <Heading
            as="h2"
            fontFamily="'Playfair Display', serif"
            fontSize={{ base: "1.5rem", md: "2rem" }}
            fontWeight={600}
            lineHeight={1.3}
            color="fg.default"
            mb={{ base: 6, md: 12 }}
            display="flex"
            alignItems="center"
            gap={4}
          >
            <Box as="span" w={8} h="1px" bg="border.default" />
            Your Baan 7 Experience
          </Heading>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-10%" }}
          >
            <Box
              display="grid"
              gridTemplateColumns={{
                base: "1fr",
                sm: "repeat(2, 1fr)",
                md: "repeat(4, 1fr)",
              }}
              gridTemplateRows={{ base: "auto", md: "repeat(2, 1fr)" }}
              gap={{ base: 3, md: 6 }}
              minH={{ md: "600px" }}
            >
              {/* Vibe Check + Hype Board slots: consolidated when both are off */}
              {!vibecheckEnabled && !hypeBoardEnabled ? (
                // Both off — one full-width Featured Moments card
                <Box
                  gridColumn={{ md: "span 4" }}
                  gridRow={{ md: "span 2" }}
                  height="100%"
                >
                  <FeatureCardAutoScroll
                    feature={{ ...features[0], link: "#", title: "Featured Moments", description: "Baan 7 Highlights", icon: "photo_library", color: "gray.100", textColor: "brand.900" }}
                    images={featuredPhotos}
                    variants={variants}
                    isWide
                  />
                </Box>
              ) : (
                <>
                  {/* Vibe Check — hero card on mobile, spans 2x2 on desktop */}
                  <Box
                    gridColumn={{ md: "span 2" }}
                    gridRow={{ md: "span 2" }}
                    height="100%"
                  >
                    {vibecheckEnabled ? (
                      <FeatureCardLarge feature={features[0]} variants={variants} />
                    ) : (
                      <FeatureCardAutoScroll
                        feature={{ ...features[0], link: "#", title: "Featured Moments", description: "Baan 7 Highlights", icon: "photo_library", color: "gray.100", textColor: "brand.900" }}
                        images={featuredPhotos}
                        variants={variants}
                      />
                    )}
                  </Box>

                  {/* Hype Board — spans 2 cols wide on desktop */}
                  <Box gridColumn={{ md: "span 2" }} height="100%">
                    {hypeBoardEnabled ? (
                      <FeatureCardWide feature={features[1]} variants={variants} />
                    ) : (
                      <FeatureCardAutoScroll
                        feature={{ ...features[1], link: "#", title: "Featured Moments", description: "Baan 7 Highlights", icon: "photo_library", color: "bg.hero", textColor: "brand.900" }}
                        images={featuredPhotos}
                        variants={variants}
                        isWide
                      />
                    )}
                  </Box>

                  {/* Gallery — spans 1 col on desktop */}
                  <Box height="100%">
                    <FeatureCardSmall feature={features[2]} variants={variants} />
                  </Box>

                  {/* Next Event — spans 1 col on desktop */}
                  <Box height="100%">
                    <FeatureCardEvent
                      feature={features[3]}
                      eventTitle={nextEvent.title}
                      countdownText={countdownText}
                      variants={variants}
                    />
                  </Box>
                </>
              )}

              {/* Gallery + Event still appear when both modules are off */}
              {!vibecheckEnabled && !hypeBoardEnabled && (
                <>
                  <Box height="100%">
                    <FeatureCardSmall feature={features[2]} variants={variants} />
                  </Box>
                  <Box height="100%">
                    <FeatureCardEvent
                      feature={features[3]}
                      eventTitle={nextEvent.title}
                      countdownText={countdownText}
                      variants={variants}
                    />
                  </Box>
                </>
              )}
            </Box>
          </motion.div>
        </Box>
      </Box>
    </Box>
  );
}

function FeatureCardLarge({
  feature,
  variants,
}: {
  feature: FeatureItem;
  variants: Variants;
}) {
  const [tilt, setTilt] = useState(0);
  const shouldReduceMotion = useReducedMotion() ?? false;
  const isLocked = feature.link === "#";

  const handleTapStart = () => {
    if (!shouldReduceMotion && !isLocked) {
      setTilt((Math.random() - 0.5) * 1.0);
    }
  };

  const cardContent = (
    <motion.div
      variants={variants}
      whileTap={
        shouldReduceMotion || isLocked
          ? { opacity: isLocked ? 1 : 0.8 }
          : {
              scale: 0.96,
              rotate: tilt,
              transition: { type: "spring", stiffness: 400, damping: 15 },
            }
      }
      onTapStart={handleTapStart}
      style={{ height: "100%" }}
    >
      <Box
        bg={feature.color}
        p={{ base: 6, md: 12 }}
        borderRadius="2xl"
        position="relative"
        overflow="visible"
        h={{ base: "auto", md: "100%" }}
        minH={{ base: "200px", md: "auto" }}
        display="flex"
        flexDirection="column"
        justifyContent="space-between"
        transition="all 0.4s var(--ease-out-quart)"
        cursor={isLocked ? "default" : "pointer"}
        role={isLocked ? "presentation" : "group"}
        opacity={isLocked ? 0.85 : 1}
        border={isLocked ? "2px dashed" : "1px solid"}
        borderColor={isLocked ? "border.subtle" : "transparent"}
        _hover={
          isLocked
            ? undefined
            : {
                transform: "translateY(-4px)",
                boxShadow:
                  "0 0 40px color-mix(in srgb, var(--chakra-colors-brand-100) 40%, transparent)",
              }
        }
      >
        {/* Ambient glow */}
        {!isLocked && (
          <Box
            position="absolute"
            top={-2}
            right={-2}
            w={{ base: "160px", md: "256px" }}
            h={{ base: "160px", md: "256px" }}
            bg="color-mix(in srgb, white 30%, transparent)"
            borderRadius="full"
            filter="blur(48px)"
            transition="background 0.4s"
            _groupHover={{ bg: "rgba(255,255,255,0.4)" }}
          />
        )}

        <VStack
          align="start"
          gap={{ base: 2, md: 4 }}
          position="relative"
          zIndex={1}
          flex={1}
        >
          <Box
            w={{ base: 12, md: 16 }}
            h={{ base: 12, md: 16 }}
            bg="color-mix(in srgb, white 80%, transparent)"
            borderRadius="xl"
            display="flex"
            alignItems="center"
            justifyContent="center"
            boxShadow="var(--shadow-ambient)"
            mb={{ base: 2, md: 4 }}
          >
            <Box
              className="material-symbols-outlined" aria-hidden="true"
              fontSize={{ base: "2xl", md: "3xl" }}
              color={feature.textColor}
            >
              {feature.icon}
            </Box>
          </Box>
          <Heading
            as="h3"
            fontFamily="'Playfair Display', serif"
            fontSize={{ base: "1.5rem", md: "2.5rem" }}
            fontWeight={700}
            lineHeight={1.1}
            color={feature.textColor}
          >
            {feature.title}
          </Heading>
          <Text
            fontSize={{ base: "sm", md: "lg" }}
            color={feature.textColor}
            opacity={0.8}
            maxW="md"
          >
            {feature.description}
          </Text>
        </VStack>

        <Flex
          position="relative"
          zIndex={1}
          mt={{ base: 4, md: 12 }}
          align="flex-end"
          justify="space-between"
        >
          {feature.avatars && (
            <HStack gap={0}>
              {feature.avatars.map((label, i) => (
                <Box
                  key={label}
                  w={{ base: 10, md: 12 }}
                  h={{ base: 10, md: 12 }}
                  borderRadius="full"
                  bg={
                    i === 0
                      ? "white"
                      : i === 1
                        ? "accent.muted"
                        : "bg.canvas"
                  }
                  border="2px solid"
                  borderColor={feature.color}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  fontSize="xs"
                  fontWeight="700"
                  color={i === 1 ? "brand.900" : feature.textColor}
                  ml={i > 0 ? -4 : 0}
                >
                  {label}
                </Box>
              ))}
            </HStack>
          )}
          {isLocked ? (
            <Box
              bg="rgba(124, 86, 63, 0.1)"
              color="brand.900"
              px={3}
              py={1}
              borderRadius="full"
              fontSize="2xs"
              fontWeight="800"
              letterSpacing="0.05em"
              textTransform="uppercase"
            >
              Coming Soon
            </Box>
          ) : (
            <Box
              className="material-symbols-outlined" aria-hidden="true"
              fontSize={{ base: "3xl", md: "5xl" }}
              color={feature.textColor}
              opacity={0.2}
              transition="all 0.5s"
              _groupHover={{ opacity: 0.4, transform: "scale(1.1)" }}
            >
              favorite
            </Box>
          )}
        </Flex>
      </Box>
    </motion.div>
  );

  if (isLocked) {
    return (
      <Box
        bg="bg.canvas"
        p={{ base: 6, md: 12 }}
        borderRadius="2xl"
        border="2px dashed"
        borderColor="border.subtle"
        h="100%"
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        textAlign="center"
        minH={{ base: "200px", md: "auto" }}
      >
        <VStack gap={4} maxW="sm">
          <Box
            className="material-symbols-outlined"
            aria-hidden="true"
            fontSize={{ base: "3xl", md: "5xl" }}
            color="fg.muted"
          >
            lock_clock
          </Box>
          <Heading
            as="h3"
            fontFamily="'Playfair Display', serif"
            fontSize={{ base: "xl", md: "2xl" }}
            fontWeight={700}
            color="fg.muted"
          >
            Coming Soon
          </Heading>
          <Text
            fontSize={{ base: "sm", md: "md" }}
            color="fg.muted"
            opacity={0.8}
            lineHeight={1.5}
          >
            {feature.description}
          </Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Link to={feature.link} className="feature-card-large">
      {cardContent}
    </Link>
  );
}

function FeatureCardWide({
  feature,
  variants,
}: {
  feature: FeatureItem;
  variants: Variants;
}) {
  const [tilt, setTilt] = useState(0);
  const shouldReduceMotion = useReducedMotion() ?? false;

  const handleTapStart = () => {
    if (!shouldReduceMotion) {
      setTilt((Math.random() - 0.5) * 1.0);
    }
  };

  return (
    <Link
      to={feature.link}
      className="feature-card-wide"
    >
      <motion.div
        variants={variants}
        whileTap={
          shouldReduceMotion
            ? { opacity: 0.8 }
            : {
                scale: 0.96,
                rotate: tilt,
                transition: { type: "spring", stiffness: 400, damping: 15 },
              }
        }
        onTapStart={handleTapStart}
        style={{ height: "100%" }}
      >
        <Box
          bg={feature.color}
          p={{ base: 5, md: 8 }}
          borderRadius="2xl"
          position="relative"
          overflow="hidden"
          h="100%"
          display="flex"
          flexDirection="column"
          justifyContent="center"
          transition="all 0.4s var(--ease-out-quart)"
          cursor="pointer"
          role="group"
          _hover={{
            transform: "translateY(-4px)",
            boxShadow:
              "0 0 40px color-mix(in srgb, var(--chakra-colors-accent-solid) 30%, transparent)",
          }}
        >
          {/* Dot pattern */}
          <Box
            position="absolute"
            inset={0}
            bgImage="radial-gradient(circle, color-mix(in srgb, white 6%, transparent) 1px, transparent 1px)"
            bgSize="20px 20px"
            opacity={0.5}
          />
          <Flex
            align="start"
            gap={{ base: 4, md: 6 }}
            position="relative"
            zIndex={1}
          >
            <Box
              w={{ base: 12, md: 14 }}
              h={{ base: 12, md: 14 }}
              bg="color-mix(in srgb, white 20%, transparent)"
              borderRadius="xl"
              display="flex"
              alignItems="center"
              justifyContent="center"
              flexShrink={0}
            >
              <Box
                className="material-symbols-outlined" aria-hidden="true"
                fontSize={{ base: "2xl", md: "3xl" }}
                color={feature.textColor}
              >
                {feature.icon}
              </Box>
            </Box>
            <VStack align="start" gap={2}>
              <Heading
                as="h3"
                fontFamily="'Playfair Display', serif"
                fontSize={{ base: "1.25rem", md: "1.5rem" }}
                fontWeight={600}
                lineHeight={1.3}
                color={feature.textColor}
              >
                {feature.title}
              </Heading>
              <Text
                fontSize={{ base: "sm", md: "md" }}
                color={feature.textColor}
                opacity={0.8}
              >
                {feature.description}
              </Text>
            </VStack>
          </Flex>
        </Box>
      </motion.div>
    </Link>
  );
}

function FeatureCardSmall({
  feature,
  variants,
}: {
  feature: FeatureItem;
  variants: Variants;
}) {
  const isGallery = feature.title === "Gallery";
  const immich = getImmichConfig();
  const [tilt, setTilt] = useState(0);
  const shouldReduceMotion = useReducedMotion() ?? false;

  const handleTapStart = () => {
    if (!shouldReduceMotion) {
      setTilt((Math.random() - 0.5) * 1.0);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isGallery) {
      if (!immich.isConfigured || !immich.url) {
        e.preventDefault();
        toaster.create({
          title: "Gallery Warming Up",
          description:
            "Baan 7 Photo Gallery is currently warming up! Check back soon once the event kicks off.",
          type: "info",
          closable: true,
          duration: 5000,
        });
      }
    }
  };

  const cardContent = (
    <motion.div
      variants={variants}
      whileTap={
        shouldReduceMotion
          ? { opacity: 0.8 }
          : {
              scale: 0.96,
              rotate: tilt,
              transition: { type: "spring", stiffness: 400, damping: 15 },
            }
      }
      onTapStart={handleTapStart}
      style={{ height: "100%" }}
    >
      <Box
        bg={feature.color}
        p={{ base: 5, md: 8 }}
        borderRadius="2xl"
        h="100%"
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        textAlign="center"
        border="1px solid"
        borderColor="border.subtle"
        transition="all 0.4s var(--ease-out-quart)"
        cursor="pointer"
        role="group"
        _hover={{
          transform: "translateY(-4px)",
          boxShadow: "var(--shadow-card-hover)",
        }}
      >
        <Box
          w={{ base: 12, md: 14 }}
          h={{ base: 12, md: 14 }}
          bg="color-mix(in srgb, var(--chakra-colors-brand-500) 10%, transparent)"
          borderRadius="xl"
          display="flex"
          alignItems="center"
          justifyContent="center"
          mb={{ base: 3, md: 6 }}
          transition="transform 0.3s"
          _groupHover={{ transform: "scale(1.1)" }}
        >
          <Box
            className="material-symbols-outlined" aria-hidden="true"
            fontSize={{ base: "2xl", md: "3xl" }}
            color="brand.fg"
          >
            {feature.icon}
          </Box>
        </Box>
        <Heading
          as="h3"
          fontFamily="'Playfair Display', serif"
          fontSize={{ base: "1.15rem", md: "1.5rem" }}
          fontWeight={600}
          lineHeight={1.3}
          color={feature.textColor}
          mb={1}
        >
          {feature.title}
        </Heading>
        <Text fontSize={{ base: "xs", md: "sm" }} color="fg.subtle">
          {feature.description}
        </Text>
      </Box>
    </motion.div>
  );

  if (isGallery && immich.isConfigured && immich.url) {
    return (
      <a
        href={immich.url}
        target="_blank"
        rel="noopener noreferrer"
        className="feature-card-small"
      >
        {cardContent}
      </a>
    );
  }

  return (
    <Link
      to={feature.link}
      className="feature-card-small"
      onClick={handleClick}
    >
      {cardContent}
    </Link>
  );
}

function FeatureCardEvent({
  feature,
  eventTitle,
  countdownText,
  variants,
}: {
  feature: FeatureItem;
  eventTitle: string;
  countdownText: string;
  variants: Variants;
}) {
  return (
    <Link to={feature.link} style={{ display: "block", height: "100%" }}>
      <motion.div variants={variants} style={{ height: "100%" }}>
        <Box
          bg={feature.color}
          p={{ base: 5, md: 8 }}
          borderRadius="2xl"
          h="100%"
          display="flex"
          flexDirection="column"
          justifyContent="space-between"
          border="1px solid"
          borderColor="border.subtle"
          transition="all 0.4s var(--ease-out-quart)"
          cursor="pointer"
          role="group"
          _hover={{
            transform: "translateY(-4px)",
            boxShadow: "var(--shadow-card-hover)",
          }}
        >
          <Flex justify="space-between" align="start">
            <Text
              fontSize="xs"
              fontWeight="600"
              letterSpacing="0.1em"
              textTransform="uppercase"
              color="fg.subtle"
            >
              {feature.title}
            </Text>
            <Box className="material-symbols-outlined" aria-hidden="true" color="fg.subtle">
              {feature.icon}
            </Box>
          </Flex>
          <VStack align="start" gap={1.5} mt={4}>
            <Heading
              as="h3"
              fontFamily="'Playfair Display', serif"
              fontSize={{ base: "1.15rem", md: "1.5rem" }}
              fontWeight={600}
              lineHeight={1.3}
              color={feature.textColor}
            >
              {eventTitle}
            </Heading>
            <Text fontSize="sm" color="brand.fg" fontWeight="600">
              {countdownText || "Loading countdown..."}
            </Text>
          </VStack>
          <Box
            w="100%"
            mt={{ base: 4, md: 6 }}
            py={2.5}
            bg="white"
            borderRadius="xl"
            fontSize="xs"
            fontWeight="600"
            letterSpacing="0.05em"
            color="brand.fg"
            boxShadow="var(--shadow-ambient)"
            transition="all 0.2s"
            display="flex"
            alignItems="center"
            justifyContent="center"
            _groupHover={{ bg: "brand.muted" }}
            minH="44px"
          >
            Join Now
          </Box>
        </Box>
      </motion.div>
    </Link>
  );
}

function FeatureCardAutoScroll({
  feature,
  images,
  variants,
  isWide = false
}: {
  feature: FeatureItem;
  images: {url: string; alt?: string}[];
  variants: Variants;
  isWide?: boolean;
}) {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const displayImages = images.length > 0 ? [...images, ...images, ...images] : [];

  return (
    <motion.div variants={variants} style={{ height: "100%" }}>
      <Box
        bg={feature.color}
        p={{ base: 6, md: isWide ? 8 : 12 }}
        borderRadius="2xl"
        position="relative"
        overflow="hidden"
        h="100%"
        minH={{ base: "200px", md: "auto" }}
        display="flex"
        flexDirection="column"
        border="1px solid"
        borderColor="border.subtle"
      >
        <VStack align="start" gap={2} position="relative" zIndex={1} mb={6}>
          <Heading as="h3" fontFamily="'Playfair Display', serif" fontSize={isWide ? "1.5rem" : { base: "1.5rem", md: "2.5rem" }} fontWeight={700} color={feature.textColor}>
            {feature.title}
          </Heading>
          <Text fontSize="sm" color={feature.textColor} opacity={0.8}>
            {feature.description}
          </Text>
        </VStack>

        <Flex position="relative" flex={1} w="100%" align="center" justify="center">
          {images.length > 0 ? (
            shouldReduceMotion ? (
              <Flex gap={3} overflowX="auto" w="100%" pb={2}>
                {images.slice(0, 4).map((img, i) => (
                  <Box key={i} flexShrink={0} w="120px" h="100px" borderRadius="lg" overflow="hidden">
                    <img src={img.url} alt="Gallery item" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                  </Box>
                ))}
              </Flex>
            ) : (
              <Box position="absolute" inset={0}
                style={{
                  WebkitMaskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
                  maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
                }}
              >
                <div className="carousel-track" style={{ height: "100%", alignItems: "center" }}>
                  {displayImages.map((img, i) => (
                    <Box key={i} flexShrink={0} w={isWide ? "140px" : "180px"} h={isWide ? "100px" : "140px"} borderRadius="lg" overflow="hidden" boxShadow="sm">
                      <img src={img.url} alt="Gallery item" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                    </Box>
                  ))}
                </div>
              </Box>
            )
          ) : (
            <Text color="fg.subtle" fontStyle="italic" fontSize="sm">
              No photos currently featured.
            </Text>
          )}
        </Flex>
      </Box>
    </motion.div>
  );
}
