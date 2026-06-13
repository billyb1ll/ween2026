import {
  Box,
  Flex,
  Heading,
  HStack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { useEffect, useState, lazy, Suspense } from "react";
import { getImmichConfig } from "../utils/immich";
import { toaster } from "../components/ui/toaster";
import { supabase } from "../lib/supabase";
import { motion, useReducedMotion, useScroll } from "framer-motion";
import type { Variants } from "framer-motion";

const ThreeBlob = lazy(() =>
  import("../components/ThreeBlob").then((module) => ({
    default: module.ThreeBlob,
  })),
);

const features = [
  {
    title: "Vibe Check",
    description:
      "Swipe to match with your Baan 7 friends and staff. Break the ice and build connections instantly.",
    icon: "waving_hand",
    color: "var(--c-lagoon-light)",
    textColor: "var(--c-lagoon)",
    link: "/vibe-check",
    size: "large" as const,
    avatars: ["B7", "Fr", "+12"],
  },
  {
    title: "Hype Board",
    description:
      "Drop a message, share the hype, and see what everyone is talking about in real-time.",
    icon: "campaign",
    color: "var(--c-chocolate)",
    textColor: "#ffffff",
    link: "/board",
    size: "wide" as const,
  },
  {
    title: "Gallery",
    description: "Relive the moments and celebrate memories.",
    icon: "photo_library",
    color: "var(--c-white)",
    textColor: "var(--c-ink)",
    link: "/gallery",
    size: "small" as const,
  },
  {
    title: "Next Event",
    subtitle: "First Meet",
    time: "Today, 18:00",
    icon: "event",
    color: "var(--c-ivory)",
    textColor: "var(--c-ink)",
    link: "/board",
    size: "small" as const,
  },
];

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

  const [nextEvent, setNextEvent] = useState({
    title: 'First Meet',
    isoTime: '',
  })
  const [countdownText, setCountdownText] = useState('')

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const { data } = await supabase
          .from('event_config')
          .select('*')
          .eq('key', 'next_event')
          .single()
        if (data) {
          setNextEvent({
            title: data.title,
            isoTime: data.event_time,
          })
        }
      } catch (err) {
        console.error('Error fetching event config:', err)
      }
    }
    fetchEvent()
  }, [])

  useEffect(() => {
    if (!nextEvent.isoTime) return

    const calculateCountdown = () => {
      const target = new Date(nextEvent.isoTime).getTime()
      const now = Date.now()
      const diff = target - now

      if (diff <= 0) {
        setCountdownText('Event has started!')
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      let countdownStr = ''
      if (days > 0) countdownStr += `${days}d `
      countdownStr += `${hours.toString().padStart(2, '0')}h `
      countdownStr += `${minutes.toString().padStart(2, '0')}m `
      countdownStr += `${seconds.toString().padStart(2, '0')}s`

      setCountdownText(`Starts in ${countdownStr}`)
    }

    calculateCountdown()
    const timer = setInterval(calculateCountdown, 1000)
    return () => clearInterval(timer)
  }, [nextEvent.isoTime])

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
            fontFamily="heading"
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
              color="accent.solid"
              fontStyle="italic"
              fontFamily="heading"
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
            Your journey starts here. Step into a community designed for
            connection, discovery, and unforgettable moments.
          </Text>

          <Flex flexWrap="wrap" gap={3} align="center">
            <Link to="/vibe-check">
              <HStack
                as="span"
                display="inline-flex"
                bg="accent.solid"
                color="white"
                px={{ base: 6, md: 8 }}
                py={{ base: 3, md: 4 }}
                borderRadius="full"
                fontWeight="600"
                fontSize="sm"
                letterSpacing="0.05em"
                gap={2}
                transition="all 0.3s var(--ease-out-quart)"
                boxShadow="0 6px 20px color-mix(in srgb, var(--c-chocolate) 25%, transparent)"
                _hover={{
                  transform: "translateY(-2px)",
                  boxShadow: "0 10px 30px color-mix(in srgb, var(--c-chocolate) 35%, transparent)",
                }}
                _active={{ transform: "scale(0.97)" }}
              >
                <Text>Start Exploring</Text>
                <Box className="material-symbols-outlined" fontSize="lg">
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
                <Box className="material-symbols-outlined" fontSize="lg">
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
          my={-8}
          display={{ base: "none", md: "block" }}
        >
          <svg
            width="100%"
            height="80"
            viewBox="0 0 1200 80"
            fill="none"
            preserveAspectRatio="xMidYMid meet"
            className="svg-block"
          >
            <motion.path
              d="M 100 40 C 300 10, 500 70, 700 40 C 900 10, 1000 70, 1100 40"
              stroke="var(--c-chocolate)"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              style={{ pathLength }}
            />
          </svg>
        </Box>

        {/* Features Grid — mobile-first: stacked with hierarchy */}
        <Box as="section" py={{ base: 8, md: 20 }} id="features">
          <Heading
            as="h2"
            fontFamily="heading"
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
              {/* Vibe Check — hero card on mobile, spans 2x2 on desktop */}
              <Box
                gridColumn={{ md: "span 2" }}
                gridRow={{ md: "span 2" }}
                height="100%"
              >
                <FeatureCardLarge feature={features[0]} variants={variants} />
              </Box>

              {/* Hype Board — spans 2 cols wide on desktop */}
              <Box gridColumn={{ md: "span 2" }} height="100%">
                <FeatureCardWide feature={features[1]} variants={variants} />
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
  feature: (typeof features)[0];
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
      className="feature-card-large"
      style={{ display: "block", height: "100%" }}
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
          p={{ base: 6, md: 12 }}
          borderRadius="2xl"
          position="relative"
          overflow="hidden"
          h={{ base: "auto", md: "100%" }}
          minH={{ base: "200px", md: "auto" }}
          display="flex"
          flexDirection="column"
          justifyContent="space-between"
          transition="all 0.4s var(--ease-out-quart)"
          cursor="pointer"
          role="group"
          _hover={{
            transform: "translateY(-4px)",
            boxShadow: "0 0 40px color-mix(in srgb, var(--c-lagoon-light) 40%, transparent)",
          }}
        >
          {/* Ambient glow */}
          <Box
            position="absolute"
            top={-10}
            right={-10}
            w={{ base: "160px", md: "256px" }}
            h={{ base: "160px", md: "256px" }}
            bg="rgba(255,255,255,0.3)"
            borderRadius="full"
            filter="blur(48px)"
            transition="background 0.4s"
            _groupHover={{ bg: "rgba(255,255,255,0.4)" }}
          />

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
              bg="rgba(255,255,255,0.8)"
              borderRadius="xl"
              display="flex"
              alignItems="center"
              justifyContent="center"
              boxShadow="var(--shadow-ambient)"
              mb={{ base: 2, md: 4 }}
            >
              <Box
                className="material-symbols-outlined"
                fontSize={{ base: "2xl", md: "3xl" }}
                color={feature.textColor}
              >
                {feature.icon}
              </Box>
            </Box>
            <Heading
              as="h3"
              fontFamily="heading"
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
                          ? "var(--c-chocolate-light)"
                          : "var(--c-ivory)"
                    }
                    border="2px solid"
                    borderColor={feature.color}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    fontSize="xs"
                    fontWeight="700"
                    color={i === 1 ? "var(--c-chocolate)" : feature.textColor}
                    ml={i > 0 ? -4 : 0}
                  >
                    {label}
                  </Box>
                ))}
              </HStack>
            )}
            <Box
              className="material-symbols-outlined"
              fontSize={{ base: "3xl", md: "5xl" }}
              color={feature.textColor}
              opacity={0.2}
              transition="all 0.5s"
              _groupHover={{ opacity: 0.4, transform: "scale(1.1)" }}
            >
              favorite
            </Box>
          </Flex>
        </Box>
      </motion.div>
    </Link>
  );
}

function FeatureCardWide({
  feature,
  variants,
}: {
  feature: (typeof features)[1];
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
      style={{ display: "block", height: "100%" }}
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
            boxShadow: "0 0 40px color-mix(in srgb, var(--c-chocolate) 30%, transparent)",
          }}
        >
          {/* Dot pattern */}
          <Box
            position="absolute"
            inset={0}
            bgImage="radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)"
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
              bg="rgba(255,255,255,0.2)"
              borderRadius="xl"
              display="flex"
              alignItems="center"
              justifyContent="center"
              flexShrink={0}
            >
              <Box
                className="material-symbols-outlined"
                fontSize={{ base: "2xl", md: "3xl" }}
                color={feature.textColor}
              >
                {feature.icon}
              </Box>
            </Box>
            <VStack align="start" gap={2}>
              <Heading
                as="h3"
                fontFamily="heading"
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
  feature: (typeof features)[2];
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

  const handleClick = (e: React.MouseEvent) => {
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
          bg="rgba(73, 98, 104, 0.1)"
          borderRadius="xl"
          display="flex"
          alignItems="center"
          justifyContent="center"
          mb={{ base: 3, md: 6 }}
          transition="transform 0.3s"
          _groupHover={{ transform: "scale(1.1)" }}
        >
          <Box
            className="material-symbols-outlined"
            fontSize={{ base: "2xl", md: "3xl" }}
            color="brand.fg"
          >
            {feature.icon}
          </Box>
        </Box>
        <Heading
          as="h3"
          fontFamily="heading"
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
        className="feature-card-small-link"
        style={{ display: "block", height: "100%" }}
      >
        {cardContent}
      </a>
    );
  }

  return (
    <Link
      to={feature.link}
      onClick={handleClick}
      style={{ display: "block", height: "100%" }}
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
  feature: (typeof features)[3];
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
            <Box className="material-symbols-outlined" color="fg.subtle">
              {feature.icon}
            </Box>
          </Flex>
          <VStack align="start" gap={1.5} mt={4}>
            <Heading
              as="h3"
              fontFamily="heading"
              fontSize={{ base: "1.15rem", md: "1.5rem" }}
              fontWeight={600}
              lineHeight={1.3}
              color={feature.textColor}
            >
              {eventTitle}
            </Heading>
            <Text fontSize="sm" color="brand.fg" fontWeight="600">
              {countdownText || 'Loading countdown...'}
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
