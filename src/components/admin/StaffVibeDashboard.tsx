import { useState } from "react";
import { FiShield, FiGrid, FiSearch, FiCpu } from "react-icons/fi";
import {
  Box,
  Flex,
  Heading,
  Text,
  VStack,
  HStack,
  Grid,
  Button,
  Textarea,
  Input,
  Spinner,
  Badge,
} from "@chakra-ui/react";
import { RoughNotation } from "react-rough-notation";
import { useUser } from "../../context/UserContext";
import { UserAvatar } from "../UserAvatar";
import {
  useStaffMetrics,
  useStaffDetectives,
  useUpdateCluesMutation,
} from "../../hooks/useVibeQueries";
import { toaster } from "../ui/toaster";

export function StaffVibeDashboard() {
  const { user } = useUser();
  const staffId = user?.student_id;

  const { data: metrics, isLoading: isMetricsLoading } = useStaffMetrics(staffId);
  const { data: detectives, isLoading: isDetectivesLoading } = useStaffDetectives(staffId);
  const updateCluesMutation = useUpdateCluesMutation(staffId);

  // Clue editor state — initialized from user context on mount
  const [bioInput, setBioInput] = useState(user?.bio || "");
  const [tagsInput, setTagsInput] = useState<string[]>(user?.tags || []);
  const [newTagText, setNewTagText] = useState("");
  const [now] = useState(() => Date.now());

  const handleAddTag = () => {
    const trimmed = newTagText.trim();
    if (trimmed && !tagsInput.includes(trimmed)) {
      setTagsInput([...tagsInput, trimmed]);
      setNewTagText("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTagsInput(tagsInput.filter((t) => t !== tagToRemove));
  };

  const handleSaveClues = async () => {
    try {
      await updateCluesMutation.mutateAsync({
        bio: bioInput.trim(),
        tags: tagsInput,
      });
      toaster.create({
        title: "Secret Intel Clues updated successfully!",
        type: "success",
      });
    } catch (err) {
      console.error(err);
      toaster.create({
        title: "Failed to update intel clues",
        type: "error",
      });
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    const diffMs = now - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <VStack
      align="stretch"
      gap={6}
      w="100%"
      maxW="600px"
      mx="auto"
      p={4}
      style={{ fontFamily: "'Mali', sans-serif" }}
    >
      <Box
        p={5}
        bg="var(--c-ivory)"
        border="2px dashed var(--chakra-colors-accent-solid)"
        borderRadius="2xl"
        boxShadow="var(--shadow-card)"
      >
        <VStack align="stretch" gap={3}>
          <Heading
            as="h2"
            size="md"
            color="brand.900"
            fontWeight="bold"
            textAlign="center"
          >
            <Box display="flex" alignItems="center" justifyContent="center" gap={2}>
              <FiShield size={20} />
              Staff Vibe Check Control Center
            </Box>
          </Heading>
          <Text fontSize="xs" color="var(--c-muted)" textAlign="center">
            Monitor students trying to guess your profile and manage the secret clues you leak to the swipe pool!
          </Text>
        </VStack>
      </Box>

      {/* SECTION A: My Spy Metrics Grid */}
      <Box
        p={5}
        bg="var(--c-ivory)"
        border="2px dashed var(--chakra-colors-accent-solid)"
        borderRadius="2xl"
        boxShadow="var(--shadow-card)"
      >
        <Heading as="h3" size="xs" color="brand.900" mb={4} fontWeight="bold">
          <Box display="flex" alignItems="center" gap={2}>
            <FiGrid size={16} />
            My Spy Metrics Grid
          </Box>
        </Heading>

        {isMetricsLoading ? (
          <Flex py={6} justify="center">
            <Spinner color="brand.900" />
          </Flex>
        ) : (
          <Grid templateColumns="repeat(3, 1fr)" gap={3}>
            {/* Guess Attempts */}
            <VStack
              p={3}
              bg="white"
              borderRadius="xl"
              border="1px solid"
              borderColor="border.subtle"
              gap={1}
            >
              <Text fontSize="2xs" color="fg.muted" fontWeight="600">
                Total Attempts
              </Text>
              <RoughNotation type="box" color="#FBD38D" strokeWidth={2} show={true}>
                <Text fontSize="lg" fontWeight="bold" color="var(--c-ink)" px={2}>
                  {metrics?.totalAttempts ?? 0}
                </Text>
              </RoughNotation>
            </VStack>

            {/* Correct Matches */}
            <VStack
              p={3}
              bg="white"
              borderRadius="xl"
              border="1px solid"
              borderColor="border.subtle"
              gap={1}
            >
              <Text fontSize="2xs" color="fg.muted" fontWeight="600">
                Correct Matches
              </Text>
              <RoughNotation type="box" color="#FBD38D" strokeWidth={2} show={true}>
                <Text fontSize="lg" fontWeight="bold" color="var(--c-lagoon)" px={2}>
                  {metrics?.correctMatches ?? 0}
                </Text>
              </RoughNotation>
            </VStack>

            {/* Accuracy Ratio */}
            <VStack
              p={3}
              bg="white"
              borderRadius="xl"
              border="1px solid"
              borderColor="border.subtle"
              gap={1}
            >
              <Text fontSize="2xs" color="fg.muted" fontWeight="600">
                Accuracy Ratio
              </Text>
              <RoughNotation type="box" color="#FBD38D" strokeWidth={2} show={true}>
                <Text fontSize="lg" fontWeight="bold" color="brand.900" px={2}>
                  {metrics?.accuracyRatio ?? 0}%
                </Text>
              </RoughNotation>
            </VStack>
          </Grid>
        )}
      </Box>

      {/* SECTION B: Top Detectives (Live Student Tracker) */}
      <Box
        p={5}
        bg="var(--c-ivory)"
        border="2px dashed var(--chakra-colors-accent-solid)"
        borderRadius="2xl"
        boxShadow="var(--shadow-card)"
      >
        <Heading as="h3" size="xs" color="brand.900" mb={3} fontWeight="bold">
          <Box display="flex" alignItems="center" gap={2}>
            <FiSearch size={16} />
            Top Detectives (Live Student Tracker)
          </Box>
        </Heading>

        {isDetectivesLoading ? (
          <Flex py={6} justify="center">
            <Spinner color="brand.900" />
          </Flex>
        ) : detectives && detectives.length > 0 ? (
          <VStack align="stretch" gap={3} maxH="300px" overflowY="auto" pr={1}>
            {detectives.map((det) => (
              <Flex
                key={det.student_id}
                p={3}
                bg="white"
                borderRadius="xl"
                border="1px solid"
                borderColor="border.subtle"
                justify="space-between"
                align="center"
              >
                <HStack gap={3}>
                  <UserAvatar
                    src={det.profile_pic_url}
                    name={det.nickname || "Student"}
                    avatarColor={det.avatar_color}
                    size="36px"
                    fontSize="sm"
                  />
                  <VStack align="start" gap={0}>
                    <Text fontSize="xs" fontWeight="bold" color="var(--c-ink)">
                      {det.nickname || "Anonymous Agent"}
                    </Text>
                    <Text fontSize="2xs" color="fg.muted">
                      {det.faculty || "Baan 7"}
                    </Text>
                  </VStack>
                </HStack>
                <Badge size="sm" variant="subtle" colorPalette="orange" borderRadius="full">
                  {formatRelativeTime(det.collected_at)}
                </Badge>
              </Flex>
            ))}
          </VStack>
        ) : (
          <Box py={6} textAlign="center" bg="white" borderRadius="xl" border="1px solid" borderColor="border.subtle">
            <Text fontSize="xs" color="fg.muted" fontStyle="italic">
              No students have successfully guessed you yet. Stay hidden!
            </Text>
          </Box>
        )}
      </Box>

      {/* SECTION C: Intel Clue Controller */}
      <Box
        p={5}
        bg="var(--c-ivory)"
        border="2px dashed var(--chakra-colors-accent-solid)"
        borderRadius="2xl"
        boxShadow="var(--shadow-card)"
      >
        <Heading as="h3" size="xs" color="brand.900" mb={3} fontWeight="bold">
          <Box display="flex" alignItems="center" gap={2}>
            <FiCpu size={16} />
            Intel Clue Controller
          </Box>
        </Heading>

        <VStack align="stretch" gap={4}>
          {/* Edit Bio Clue */}
          <Box>
            <Text fontSize="2xs" fontWeight="700" color="fg.muted" mb={1} textTransform="uppercase">
              Spy Profile Biography Hint
            </Text>
            <Textarea
              value={bioInput}
              onChange={(e) => setBioInput(e.target.value)}
              placeholder="Provide a cryptic description about yourself for the swipe pool..."
              bg="white"
              fontSize="xs"
              borderRadius="xl"
              rows={3}
              _focus={{ borderColor: "accent.solid" }}
            />
          </Box>

          {/* Edit Tag Clues */}
          <Box>
            <Text fontSize="2xs" fontWeight="700" color="fg.muted" mb={2} textTransform="uppercase">
              Secret Intel Clues (Tags)
            </Text>

            <Flex wrap="wrap" gap={2} mb={3} p={3} bg="white" borderRadius="xl" border="1px solid" borderColor="border.subtle">
              {tagsInput.map((tag) => (
                <HStack
                  key={tag}
                  bg="var(--c-ivory)"
                  px={2.5}
                  py={1}
                  borderRadius="full"
                  border="1px solid"
                  borderColor="color-mix(in srgb, var(--chakra-colors-accent-solid) 20%, transparent)"
                  gap={1}
                >
                  <Text fontSize="2xs" fontWeight="600" color="brand.900">
                    {tag}
                  </Text>
                  <Button
                    size="2xs"
                    variant="ghost"
                    h="14px"
                    w="14px"
                    minW="14px"
                    p={0}
                    color="red.500"
                    onClick={() => handleRemoveTag(tag)}
                    cursor="pointer"
                    aria-label={`Remove tag ${tag}`}
                  >
                    ×
                  </Button>
                </HStack>
              ))}
              {tagsInput.length === 0 && (
                <Text fontSize="2xs" color="fg.muted" fontStyle="italic">
                  No clue tags added. Students will only see default Baan information.
                </Text>
              )}
            </Flex>

            {/* Add Tag Row */}
            <HStack gap={2}>
              <Input
                value={newTagText}
                onChange={(e) => setNewTagText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add a new secret hint tag..."
                bg="white"
                fontSize="xs"
                h="36px"
                borderRadius="xl"
                _focus={{ borderColor: "accent.solid" }}
              />
              <Button
                onClick={handleAddTag}
                bg="var(--c-lagoon)"
                color="white"
                fontSize="xs"
                fontWeight="bold"
                h="36px"
                px={4}
                borderRadius="xl"
                cursor="pointer"
              >
                Add Clue
              </Button>
            </HStack>
          </Box>

          <Button
            onClick={handleSaveClues}
            loading={updateCluesMutation.isPending}
            bg="accent.solid"
            color="brand.900"
            fontSize="xs"
            fontWeight="bold"
            h="40px"
            borderRadius="xl"
            cursor="pointer"
            w="100%"
          >
            Save Intel Clues
          </Button>
        </VStack>
      </Box>
    </VStack>
  );
}
