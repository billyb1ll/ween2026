import { Box, Heading, VStack, Flex, Text, Badge, Button, HStack } from "@chakra-ui/react";

interface SystemControlPanelProps {
  hypeBoardMode: "active" | "slow_3s" | "read_only";
  enableMemoryBoard: boolean;
  vibecheckEnabled: boolean;
  globalMuteActive: boolean;
  handleSetHypeMode: (mode: "active" | "slow_3s" | "read_only") => void;
  handleToggleConfig: (
    key: "enable_memory_board" | "vibecheck_enabled",
    currentVal: boolean
  ) => void;
}

export function SystemControlPanel({
  hypeBoardMode,
  enableMemoryBoard,
  vibecheckEnabled,
  globalMuteActive,
  handleSetHypeMode,
  handleToggleConfig,
}: SystemControlPanelProps) {
  return (
    <Box
      bg="var(--c-white)"
      border="1px solid"
      borderColor="border.subtle"
      borderRadius="xl"
      boxShadow="sm"
      p={6}
    >
      <Heading size="md" color="gray.700" fontFamily="heading" mb={4}>
        Master Switches
      </Heading>
      <VStack gap={6} align="stretch">
        {/* Hype Board Mode — Tri-State Segmented Control */}
        <Box
          p={4}
          bg="var(--c-ivory)"
          borderRadius="xl"
          border="1px solid"
          borderColor="border.subtle"
        >
          <Flex align="center" justify="space-between" mb={3}>
            <Box>
              <Text
                fontFamily="heading"
                fontWeight="700"
                color="brand.900"
                fontSize="sm"
              >
                Hype Board Mode
              </Text>
              <Text fontSize="xs" color="fg.muted">
                Controls the live chat stream behavior for all connected
                clients.
              </Text>
            </Box>
            <Badge
              colorPalette={
                hypeBoardMode === "active"
                  ? "green"
                  : hypeBoardMode === "slow_3s"
                    ? "yellow"
                    : "red"
              }
              fontSize="xs"
              px={2}
              py={0.5}
              borderRadius="full"
            >
              {hypeBoardMode === "active"
                ? "● LIVE"
                : hypeBoardMode === "slow_3s"
                  ? "◐ SLOW"
                  : "○ LOCKED"}
            </Badge>
          </Flex>
          <Flex
            gap={2}
            bg="var(--c-white)"
            p={1}
            borderRadius="xl"
            border="1px solid"
            borderColor="border.subtle"
            flexDirection={{ base: "column", md: "row" }}
          >
            {[
              {
                mode: "active" as const,
                label: "ACTIVE",
                icon: "stream",
                color: "var(--c-lagoon)",
                desc: "Normal streaming",
              },
              {
                mode: "slow_3s" as const,
                label: "SLOW MODE (3s)",
                icon: "speed",
                color: "#d4a017",
                desc: "3s throttle",
              },
              {
                mode: "read_only" as const,
                label: "READ ONLY",
                icon: "lock",
                color: "#c53030",
                desc: "No input",
              },
            ].map((opt) => (
              <Button
                key={opt.mode}
                type="button"
                flex={1}
                h={{ base: "44px", md: "42px" }}
                py={1.5}
                borderRadius="lg"
                cursor="pointer"
                bg={
                  hypeBoardMode === opt.mode ? opt.color : "transparent"
                }
                color={
                  hypeBoardMode === opt.mode
                    ? "white"
                    : "var(--c-muted)"
                }
                border={
                  hypeBoardMode === opt.mode
                    ? "none"
                    : "1px solid transparent"
                }
                fontWeight="700"
                fontSize="xs"
                _hover={{
                  bg:
                    hypeBoardMode === opt.mode
                      ? opt.color
                      : "color-mix(in srgb, var(--c-ivory) 80%, var(--c-outline))",
                }}
                onClick={() => handleSetHypeMode(opt.mode)}
                transition="all 0.2s ease"
              >
                <HStack gap={1.5}>
                  <Box
                    as="span"
                    className="material-symbols-outlined"
                    fontSize="16px"
                  >
                    {opt.icon}
                  </Box>
                  <Text
                    as="span"
                    display={{ base: "inline", md: "inline" }}
                  >
                    {opt.label}
                  </Text>
                </HStack>
              </Button>
            ))}
          </Flex>
        </Box>

        {/* Memory Board Toggle — Binary Switch */}
        <Flex
          align="center"
          justify="space-between"
          p={4}
          bg="var(--c-ivory)"
          borderRadius="xl"
          border="1px solid"
          borderColor="border.subtle"
        >
          <Box>
            <Text
              fontFamily="heading"
              fontWeight="700"
              color="brand.900"
              fontSize="sm"
            >
              Memory Board
            </Text>
            <Text fontSize="xs" color="fg.muted">
              Shared orientation photo posting canvas. When disabled,
              students are locked out (staff bypass).
            </Text>
          </Box>
          <Button
            type="button"
            bg={
              enableMemoryBoard ? "var(--c-lagoon)" : "var(--c-muted)"
            }
            color="white"
            onClick={() =>
              handleToggleConfig(
                "enable_memory_board",
                enableMemoryBoard,
              )
            }
            cursor="pointer"
            h={{ base: "44px", md: "40px" }}
            py={2}
            px={5}
            borderRadius="lg"
            fontWeight="700"
            fontSize="xs"
            transition="all 0.2s ease"
          >
            <HStack gap={1.5}>
              <Box
                as="span"
                className="material-symbols-outlined"
                fontSize="16px"
              >
                {enableMemoryBoard ? "visibility" : "visibility_off"}
              </Box>
              {enableMemoryBoard ? "ACTIVE" : "DISABLED"}
            </HStack>
          </Button>
        </Flex>

        {/* Vibe Check Toggle — Binary Switch */}
        <Flex
          align="center"
          justify="space-between"
          p={4}
          bg="var(--c-ivory)"
          borderRadius="xl"
          border="1px solid"
          borderColor="border.subtle"
        >
          <Box>
            <Text
              fontFamily="heading"
              fontWeight="700"
              color="brand.900"
              fontSize="sm"
            >
              Vibe Check Feature
            </Text>
            <Text fontSize="xs" color="fg.muted">
              Allows staff members to customize cards and students to
              collect stickers. When disabled, redirects and blocks
              access.
            </Text>
          </Box>
          <Button
            type="button"
            bg={
              vibecheckEnabled ? "var(--c-lagoon)" : "var(--c-muted)"
            }
            color="white"
            onClick={() =>
              handleToggleConfig("vibecheck_enabled", vibecheckEnabled)
            }
            cursor="pointer"
            h={{ base: "44px", md: "40px" }}
            py={2}
            px={5}
            borderRadius="lg"
            fontWeight="700"
            fontSize="xs"
            transition="all 0.2s ease"
          >
            <HStack gap={1.5}>
              <Box
                as="span"
                className="material-symbols-outlined"
                fontSize="16px"
              >
                {vibecheckEnabled ? "check_circle" : "cancel"}
              </Box>
              {vibecheckEnabled ? "ACTIVE" : "DISABLED"}
            </HStack>
          </Button>
        </Flex>

        {/* Global Mute Status Indicator */}
        {globalMuteActive && (
          <Flex
            align="center"
            gap={2}
            p={3}
            bg="color-mix(in srgb, #c53030 8%, transparent)"
            border="1px solid"
            borderColor="red.200"
            borderRadius="xl"
          >
            <Box
              as="span"
              className="material-symbols-outlined"
              fontSize="18px"
              color="red.600"
            >
              volume_off
            </Box>
            <Text fontSize="xs" fontWeight="700" color="red.700">
              GLOBAL MUTE IS ACTIVE — All chat inputs are frozen across
              all clients.
            </Text>
          </Flex>
        )}
      </VStack>
    </Box>
  );
}
