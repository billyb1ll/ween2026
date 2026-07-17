const fs = require('fs');

const filePath = '/Users/bill/Documents/ween2026/src/pages/AdminDashboardPage.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add compressImage import
const getImmichImport = 'import { getImmichConfig } from "../utils/immich";';
if (content.indexOf(getImmichImport) !== -1) {
  content = content.replace(getImmichImport, `${getImmichImport}\nimport { compressImage } from "../utils/image";`);
}

// 2. Add DBPost and Comment interfaces
const vibeMissionInterface = 'interface VibeMission {\n  id: number;\n  sequence_order: number;\n  target_role: string;\n  required_count: number;\n}';
const postAndCommentInterfaces = `interface DBPost {
  id: number;
  content: string;
  likes: number;
  type: "hype" | "memory";
  is_anonymous: boolean;
  is_hidden: boolean;
  student_id: string;
  tags: string[];
  created_at: string;
  author: {
    student_id: string;
    nickname: string | null;
    avatar_color: string;
    role: string;
  };
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
  };
}`;
if (content.indexOf(vibeMissionInterface) !== -1) {
  content = content.replace(vibeMissionInterface, `${vibeMissionInterface}\n\n${postAndCommentInterfaces}`);
}

// 3. Update activeTab state initialization
const activeTabOld = `  const [activeTab, setActiveTab] = useState<"moderator" | "media">(
    () => {
      if (user?.role === "moderator") return "moderator";
      return "media";
    },
  );`;
const activeTabNew = `  const [activeTab, setActiveTab] = useState<"moderator" | "media" | "staff">(
    () => {
      if (user?.role === "moderator") return "moderator";
      if (user?.role === "staff") return "staff";
      return "media";
    },
  );`;
if (content.indexOf(activeTabOld) !== -1) {
  content = content.replace(activeTabOld, activeTabNew);
} else {
  // Let's try the single-line layout version of activeTab state just in case
  const activeTabOldAlt = `  const [activeTab, setActiveTab] = useState<"moderator" | "media">(() => {
    if (user?.role === "moderator") return "moderator";
    return "media";
  });`;
  if (content.indexOf(activeTabOldAlt) !== -1) {
    content = content.replace(activeTabOldAlt, `  const [activeTab, setActiveTab] = useState<"moderator" | "media" | "staff">(() => {
    if (user?.role === "moderator") return "moderator";
    if (user?.role === "staff") return "staff";
    return "media";
  });`);
  }
}

// 4. Update useUser destructuring
const useUserOld = '  const { user } = useUser();';
const useUserNew = '  const { user, updateProfile } = useUser();';
if (content.indexOf(useUserOld) !== -1) {
  content = content.replace(useUserOld, useUserNew);
}

// 5. Add staff state variables & refs
const maxCooldownState = '  const [maxCooldown, setMaxCooldown] = useState(30);';
const staffStates = `  const [maxCooldown, setMaxCooldown] = useState(30);

  // Staff dashboard states
  const [posts, setPosts] = useState<DBPost[]>([]);
  const [commentsMap, setCommentsMap] = useState<Record<number, Comment[]>>({});
  const [staffLoading, setStaffLoading] = useState(true);
  const [bio, setBio] = useState(user?.bio || "");
  const [photos, setPhotos] = useState<string[]>(user?.photo_pool || []);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const staffPhotoInputRef = useRef<HTMLInputElement>(null);
  const activeFileIdxRef = useRef<number>(0);
  const [vibecheckEnabled, setVibecheckEnabled] = useState(true);`;
if (content.indexOf(maxCooldownState) !== -1) {
  content = content.replace(maxCooldownState, staffStates);
}

// 6. Fetch vibecheck_enabled config on fetchAdminData
const configFetchMarker = `          const memory = configData.find(
            (c) => c.key === "enable_memory_board",
          );
          if (memory) setEnableMemoryBoard(memory.value);`;
const configFetchNew = `          const memory = configData.find(
            (c) => c.key === "enable_memory_board",
          );
          if (memory) setEnableMemoryBoard(memory.value);

          const vibecheck = configData.find(
            (c) => c.key === "vibecheck_enabled",
          );
          if (vibecheck) setVibecheckEnabled(vibecheck.value);`;
if (content.indexOf(configFetchMarker) !== -1) {
  content = content.replace(configFetchMarker, configFetchNew);
}

// 7. Update handleToggleConfig to support vibecheck_enabled
const toggleConfigOld = `  const handleToggleConfig = async (
    key: "enable_memory_board",
    currentVal: boolean,
  ) => {
    const newVal = !currentVal;
    if (key === "enable_memory_board") setEnableMemoryBoard(newVal);`;
const toggleConfigNew = `  const handleToggleConfig = async (
    key: "enable_memory_board" | "vibecheck_enabled",
    currentVal: boolean,
  ) => {
    const newVal = !currentVal;
    if (key === "enable_memory_board") setEnableMemoryBoard(newVal);
    if (key === "vibecheck_enabled") setVibecheckEnabled(newVal);`;
if (content.indexOf(toggleConfigOld) !== -1) {
  content = content.replace(toggleConfigOld, toggleConfigNew);
}

// 8. Insert Vibe Check toggle switch in Master Switches JSX panel
const memoryBoardToggleOld = `                {/* Memory Board Toggle — Binary Switch */}
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
                      fontWeight="700"
                      color="var(--c-chocolate)"
                      fontSize="sm"
                    >
                      Memory Board
                    </Text>
                    <Text fontSize="2xs" color="fg.muted">
                      Shared orientation photo posting canvas. When disabled,
                      students are locked out (staff bypass).
                    </Text>
                  </Box>
                  <Button
                    type="button"
                    bg={
                      enableMemoryBoard ? "var(--c-lagoon)" : "var(--c-outline)"
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
                </Flex>`;

const memoryBoardToggleNew = `${memoryBoardToggleOld}

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
                      fontWeight="700"
                      color="var(--c-chocolate)"
                      fontSize="sm"
                    >
                      Vibe Check Feature
                    </Text>
                    <Text fontSize="2xs" color="fg.muted">
                      Allows staff members to customize cards and students to collect stickers. When disabled, redirects and blocks access.
                    </Text>
                  </Box>
                  <Button
                    type="button"
                    bg={
                      vibecheckEnabled ? "var(--c-lagoon)" : "var(--c-outline)"
                    }
                    color="white"
                    onClick={() =>
                      handleToggleConfig(
                        "vibecheck_enabled",
                        vibecheckEnabled,
                      )
                    }
                    cursor="pointer"
                    h={{ base: "44px", md: "40px" }}
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
                </Flex>`;

if (content.indexOf(memoryBoardToggleOld) !== -1) {
  content = content.replace(memoryBoardToggleOld, memoryBoardToggleNew);
} else {
  console.error("Could not find Memory Board Toggle JSX layout block.");
}

// 9. Insert Staff tab useEffect and all staff helper functions
const whitelistEffectEnd = `    return () => {
      if (highlightTimeoutRef.current)
        clearTimeout(highlightTimeoutRef.current);
      supabase.removeChannel(whitelistSubscription);
    };
  }, [user]);`;

const staffEffectAndHelpers = `    return () => {
      if (highlightTimeoutRef.current)
        clearTimeout(highlightTimeoutRef.current);
      supabase.removeChannel(whitelistSubscription);
    };
  }, [user]);

  // Staff moderation and VibeCheck data loading
  useEffect(() => {
    if (!user || activeTab !== "staff") return;

    let active = true;
    const fetchDashboardData = async () => {
      if (active) setStaffLoading(true);
      try {
        const { data: postsData, error: postsError } = await supabase
          .from("posts")
          .select("*, author:users(student_id, nickname, avatar_color, role)")
          .order("created_at", { ascending: false });

        if (postsError) throw postsError;

        if (active && postsData) {
          setPosts(postsData as unknown as DBPost[]);

          const postIds = postsData.map((p) => p.id);
          if (postIds.length > 0) {
            const { data: commentsData, error: commentsError } = await supabase
              .from("post_comments")
              .select(
                "*, author:users(student_id, nickname, avatar_color, role)",
              )
              .in("post_id", postIds)
              .order("created_at", { ascending: true });

            if (commentsError) throw commentsError;

            const mapped: Record<number, Comment[]> = {};
            if (commentsData) {
              (commentsData as unknown as Comment[]).forEach((c) => {
                if (!mapped[c.post_id]) mapped[c.post_id] = [];
                mapped[c.post_id].push(c);
              });
            }
            setCommentsMap(mapped);
          }
        }
      } catch (err) {
        console.error("Error fetching staff moderation data:", err);
        if (active) {
          toaster.create({
            title: "Error loading dashboard data",
            type: "error",
          });
        }
      } finally {
        if (active) setStaffLoading(false);
      }
    };

    fetchDashboardData();

    // Realtime channel setup for Staff Moderation
    const channelName = "staff-moderation";
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        async (payload) => {
          const { data, error } = await supabase
            .from("posts")
            .select("*, author:users(student_id, nickname, avatar_color, role)")
            .eq("id", payload.new.id)
            .single();

          if (!error && data && active) {
            setPosts((prev) => {
              if (prev.some((p) => p.id === data.id)) return prev;
              return [data as unknown as DBPost, ...prev];
            });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "posts" },
        (payload) => {
          const updated = payload.new;
          if (active) {
            setPosts((prev) =>
              prev.map((p) =>
                p.id === updated.id
                  ? {
                      ...p,
                      content: updated.content ?? p.content,
                      is_hidden: updated.is_hidden ?? p.is_hidden,
                      likes: updated.likes ?? p.likes,
                      tags: Array.isArray(updated.tags) ? updated.tags : p.tags,
                    }
                  : p,
              ),
            );
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "posts" },
        (payload) => {
          if (active) {
            setPosts((prev) => prev.filter((p) => p.id !== payload.old.id));
            setCommentsMap((prev) => {
              const next = { ...prev };
              delete next[payload.old.id];
              return next;
            });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "post_comments" },
        async (payload) => {
          const { data, error } = await supabase
            .from("post_comments")
            .select("*, author:users(student_id, nickname, avatar_color, role)")
            .eq("id", payload.new.id)
            .single();

          if (!error && data && active) {
            setCommentsMap((prev) => {
              const postId = data.post_id;
              const existing = prev[postId] || [];
              if (existing.some((c) => c.id === data.id)) return prev;
              return {
                ...prev,
                [postId]: [...existing, data as unknown as Comment],
              };
            });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "post_comments" },
        (payload) => {
          if (active) {
            setCommentsMap((prev) => {
              const next = { ...prev };
              for (const postId in next) {
                next[postId] = next[postId].filter(
                  (c) => c.id !== payload.old.id,
                );
              }
              return next;
            });
          }
        },
      );

    channel.subscribe((status, err) => {
      if (err) {
        console.error("[Staff Moderation Realtime Error]:", err);
      }
      console.log("[Staff Moderation Realtime Status]:", status);
    });

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user, activeTab]);

  // Delete Post secure RPC call
  const handleDeletePost = async (postId: number) => {
    if (!user) return;
    try {
      const { error } = await supabase.rpc("delete_post_secure", {
        p_post_id: postId,
        p_student_id: user.student_id,
        p_pin_hash: user.pin_hash || "",
      });

      if (error) throw error;

      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toaster.create({ title: "Post Deleted!", type: "success" });
    } catch (err) {
      console.error("Delete post error:", err);
      toaster.create({ title: "Failed to delete post", type: "error" });
    }
  };

  // Delete Comment secure RPC call
  const handleDeleteComment = async (commentId: number, postId: number) => {
    if (!user) return;
    try {
      const { error } = await supabase.rpc("delete_comment_secure", {
        p_comment_id: commentId,
        p_student_id: user.student_id,
        p_pin_hash: user.pin_hash || "",
      });

      if (error) throw error;

      setCommentsMap((prev) => {
        const list = prev[postId] || [];
        return {
          ...prev,
          [postId]: list.filter((c) => c.id !== commentId),
        };
      });
      toaster.create({ title: "Comment Deleted!", type: "success" });
    } catch (err) {
      console.error("Delete comment error:", err);
      toaster.create({ title: "Failed to delete comment", type: "error" });
    }
  };

  // Handle vibe check photo upload to Supabase Storage
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const idx = activeFileIdxRef.current;
    setUploadingIdx(idx);
    try {
      const compressedBlob = await compressImage(file);
      const fileName = \`staff-\${user.student_id}-\${idx}-\${Date.now()}.jpg\`;
      const filePath = \`\${fileName}\`;

      const { error: uploadError } = await supabase.storage
        .from("profiles")
        .upload(filePath, compressedBlob, {
          contentType: "image/jpeg",
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("profiles").getPublicUrl(filePath);

      const updated = [...photos];
      updated[idx] = publicUrl;
      setPhotos(updated);

      toaster.create({ title: \`Photo \${idx + 1} uploaded!\`, type: "success" });
    } catch (err) {
      console.error("Staff photo upload failed:", err);
      toaster.create({ title: "Upload failed", type: "error" });
    } finally {
      setUploadingIdx(null);
    }
  };

  const triggerUploadClick = (idx: number) => {
    activeFileIdxRef.current = idx;
    staffPhotoInputRef.current?.click();
  };

  const triggerUrlPrompt = (idx: number) => {
    const url = prompt(\`Enter image URL for Photo \${idx + 1}:\`);
    if (url) {
      const updated = [...photos];
      updated[idx] = url.trim();
      setPhotos(updated);
    }
  };

  const removePhoto = (idx: number) => {
    const updated = [...photos];
    updated[idx] = "";
    setPhotos(updated);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSavingProfile(true);
    // Filter out empty slots
    const photoPool = photos.filter((p) => p && p.trim());

    try {
      const success = await updateProfile({
        nickname: user.nickname || "",
        faculty: user.faculty || "",
        major: user.major || undefined,
        ig: user.ig || undefined,
        avatarColor: user.avatar_color,
        bio: bio.trim(),
        profilePicUrl: user.profile_pic_url || undefined,
        photoPool,
      });

      if (success) {
        toaster.create({ title: "VibeCheck Profile Saved!", type: "success" });
      } else {
        throw new Error("Save failed");
      }
    } catch (err) {
      console.error("Save staff vibe profile error:", err);
      toaster.create({ title: "Failed to save profile", type: "error" });
    } finally {
      setSavingProfile(false);
    }
  };`;

if (content.indexOf(whitelistEffectEnd) !== -1) {
  content = content.replace(whitelistEffectEnd, staffEffectAndHelpers);
} else {
  // Try with spaces or formatting differences
  const whitelistEffectEndAlt = `    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      supabase.removeChannel(whitelistSubscription);
    };
  }, [user]);`;
  if (content.indexOf(whitelistEffectEndAlt) !== -1) {
    content = content.replace(whitelistEffectEndAlt, staffEffectAndHelpers);
  } else {
    console.error("Could not find Whitelist Effect End block.");
  }
}

// 10. Insert Staff tab panel render block (under TIER 3) with VibeCheck disabled state checks
const mediaPanelEnd = `          </VStack>
        )}`;

const staffPanelJSX = `${mediaPanelEnd}

      {/* TIER 3: Staff Moderation Panel */}
      {activeTab === "staff" && (user?.role === "moderator" || user?.role === "staff") && (
        <VStack align="stretch" gap={6}>
          {staffLoading ? (
            <Flex minH="40vh" align="center" justify="center">
              <Spinner size="xl" color="var(--c-chocolate)" />
            </Flex>
          ) : (
            <>
              {/* VibeCheck Setup Card */}
              <Box
                bg="var(--c-white)"
                p={6}
                border="1px solid"
                borderColor="border.subtle"
                borderRadius="xl"
                boxShadow="sm"
              >
                <Heading size="md" color="gray.700" mb={4}>
                  My VibeCheck Profile (Staff Card)
                </Heading>

                {!vibecheckEnabled && (
                  <Flex
                    align="center"
                    gap={3}
                    p={4}
                    bg="color-mix(in srgb, #B91A1A 8%, transparent)"
                    border="1px solid"
                    borderColor="red.200"
                    borderRadius="xl"
                    mb={4}
                  >
                    <Box
                      as="span"
                      className="material-symbols-outlined"
                      fontSize="20px"
                      color="red.600"
                    >
                      warning
                    </Box>
                    <Text fontSize="sm" fontWeight="700" color="red.700">
                      Vibe Check feature is currently disabled by moderators.
                    </Text>
                  </Flex>
                )}

                <VStack
                  as="form"
                  onSubmit={handleSaveProfile}
                  align="stretch"
                  gap={5}
                >
                  <VStack align="stretch" gap={1.5}>
                    <Text
                      fontSize="xs"
                      fontWeight="700"
                      color="var(--c-muted)"
                      textTransform="uppercase"
                    >
                      Bio / Intro Phrase (Staff Intro)
                    </Text>
                    <Input
                      placeholder="e.g. Apple, Recreation Staff of Baan 7, nice to meet you all! 🧡"
                      aria-label="Bio / Intro Phrase (Staff Intro)"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      h="44px"
                      borderRadius="xl"
                      border="1.5px solid var(--c-outline)"
                      bg="var(--c-ivory)"
                      disabled={!vibecheckEnabled || savingProfile}
                    />
                  </VStack>

                  <VStack align="stretch" gap={3}>
                    <Text
                      fontSize="xs"
                      fontWeight="700"
                      color="var(--c-muted)"
                      textTransform="uppercase"
                    >
                      Vibe Check Photos (Max exactly 3 photos)
                    </Text>
                    <Input
                      type="file"
                      accept="image/*"
                      aria-label="Upload photo"
                      onChange={handlePhotoUpload}
                      ref={staffPhotoInputRef}
                      display="none"
                    />
                    <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
                      {[0, 1, 2].map((idx) => {
                        const url = photos[idx] || "";
                        const isUploading = uploadingIdx === idx;

                        return (
                          <Box
                            key={idx}
                            p={4}
                            bg="bg.hero"
                            border="1px dashed"
                            borderColor="border.subtle"
                            borderRadius="xl"
                            display="flex"
                            flexDirection="column"
                            alignItems="center"
                            justifyContent="center"
                            minH="180px"
                            opacity={!vibecheckEnabled ? 0.6 : 1}
                          >
                            {url ? (
                              <VStack gap={2} w="100%">
                                <Box
                                  h="100px"
                                  w="100%"
                                  borderRadius="lg"
                                  overflow="hidden"
                                >
                                  <Image
                                    src={url}
                                    alt={\`Uploaded staff orientation activity photo preview \${idx + 1}\`}
                                    w="100%"
                                    h="100%"
                                    objectFit="cover"
                                  />
                                </Box>
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="outline"
                                  colorPalette="red"
                                  onClick={() => removePhoto(idx)}
                                  w="100%"
                                  minH="32px"
                                  cursor="pointer"
                                  disabled={!vibecheckEnabled}
                                >
                                  Remove
                                </Button>
                              </VStack>
                            ) : (
                              <VStack gap={2}>
                                <Text fontSize="2xs" color="fg.subtle">
                                  Slot {idx + 1} (Empty)
                                </Text>
                                {isUploading ? (
                                  <Spinner size="xs" color="var(--c-lagoon)" />
                                ) : (
                                  <Flex gap={2}>
                                    <Button
                                      type="button"
                                      size="xs"
                                      onClick={() => triggerUploadClick(idx)}
                                      minH="44px"
                                      cursor="pointer"
                                      disabled={!vibecheckEnabled}
                                    >
                                      Upload
                                    </Button>
                                    <Button
                                      type="button"
                                      size="xs"
                                      variant="outline"
                                      onClick={() => triggerUrlPrompt(idx)}
                                      minH="44px"
                                      cursor="pointer"
                                      disabled={!vibecheckEnabled}
                                    >
                                      URL
                                    </Button>
                                  </Flex>
                                )}
                              </VStack>
                            )}
                          </Box>
                        );
                      })}
                    </SimpleGrid>
                  </VStack>

                  <Button
                    type="submit"
                    bg="var(--c-chocolate)"
                    color="white"
                    h="44px"
                    borderRadius="xl"
                    cursor="pointer"
                    _hover={{ bg: "chocolate.600" }}
                    loading={savingProfile}
                    disabled={!vibecheckEnabled}
                  >
                    Save Vibe Profile
                  </Button>
                </VStack>
              </Box>

              {/* Hype & Memory Board Moderation Card */}
              <Box
                bg="var(--c-white)"
                p={6}
                border="1px solid"
                borderColor="border.subtle"
                borderRadius="xl"
                boxShadow="sm"
              >
                <Heading size="md" color="gray.700" mb={2}>
                  Live Hype & Memory Board Moderation Tracker
                </Heading>
                <Text fontSize="xs" color="fg.muted" mb={4}>
                  Under standard privacy policies, anonymous authors are masked for
                  general Staff. Action buttons execute database permissions contexts
                  directly.
                </Text>

                <Box
                  overflowY="auto"
                  maxH="400px"
                  border="1px solid"
                  borderColor="border.subtle"
                  borderRadius="xl"
                >
                  <TableScrollArea bg="white" borderRadius="xl" borderWidth="1px" overflow="hidden">
                    <Table.Root size="sm" variant="line">
                      <Table.Header bg="var(--c-ivory)">
                        <Table.Row>
                          <Table.ColumnHeader>Post Details & Comments</Table.ColumnHeader>
                          <Table.ColumnHeader>Author</Table.ColumnHeader>
                          <Table.ColumnHeader>Type</Table.ColumnHeader>
                          <Table.ColumnHeader>Actions</Table.ColumnHeader>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {posts.map((p) => {
                          const comments = commentsMap[p.id] || [];
                          return (
                            <Table.Row
                              key={p.id}
                              bg={p.is_hidden ? "rgba(186, 26, 26, 0.05)" : "transparent"}
                              _hover={{ bg: "gray.50" }}
                              transition="background 0.2s"
                            >
                              <Table.Cell maxW="400px">
                                <VStack align="stretch" gap={3}>
                                  <Box>
                                    <Text
                                      fontWeight={p.is_hidden ? "normal" : "600"}
                                      fontStyle={p.is_hidden ? "italic" : "normal"}
                                      color={p.is_hidden ? "fg.muted" : "fg.default"}
                                    >
                                      {p.content}
                                    </Text>
                                    <Text fontSize="3xs" color="fg.subtle" mt={1}>
                                      Tags: {p.tags?.join(", ") || "None"} | Created:{" "}
                                      {new Date(p.created_at).toLocaleString()}
                                    </Text>
                                  </Box>

                                  {/* Nested Comments Table for Moderation */}
                                  {comments.length > 0 && (
                                    <Box
                                      pl={4}
                                      borderLeft="2px solid"
                                      borderColor="border.subtle"
                                    >
                                      <Text
                                        fontSize="2xs"
                                        fontWeight="700"
                                        color="fg.muted"
                                        mb={2}
                                      >
                                        Comments ({comments.length}):
                                      </Text>
                                      <VStack align="stretch" gap={2}>
                                        {comments.map((comment) => (
                                          <Flex
                                            key={comment.id}
                                            justify="space-between"
                                            bg="bg.hero"
                                            p={2}
                                            borderRadius="md"
                                            align="center"
                                          >
                                            <Box>
                                              <Text fontSize="xs" color="fg.default">
                                                {comment.content}
                                              </Text>
                                              <Text fontSize="3xs" color="fg.subtle">
                                                By{" "}
                                                {comment.author?.nickname || "Student"}{" "}
                                                ({comment.author?.role})
                                              </Text>
                                            </Box>
                                            <Button
                                              size="2xs"
                                              variant="ghost"
                                              colorPalette="red"
                                              onClick={() =>
                                                handleDeleteComment(comment.id, p.id)
                                              }
                                              minH="32px"
                                              cursor="pointer"
                                            >
                                              Delete
                                            </Button>
                                          </Flex>
                                        ))}
                                      </VStack>
                                    </Box>
                                  )}
                                </VStack>
                              </Table.Cell>
                              <Table.Cell>
                                {p.is_anonymous ? (
                                  <Badge colorPalette="orange">Anonymous</Badge>
                                ) : (
                                  <Text fontSize="xs" fontWeight="700">
                                    {p.author?.nickname || "Guest Whitelist"}
                                  </Text>
                                )}
                              </Table.Cell>
                              <Table.Cell>
                                <Badge
                                  colorPalette={p.type === "hype" ? "cyan" : "teal"}
                                >
                                  {p.type}
                                </Badge>
                              </Table.Cell>
                              <Table.Cell>
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="outline"
                                  colorPalette="red"
                                  cursor="pointer"
                                  onClick={() => handleDeletePost(p.id)}
                                  minH="40px"
                                >
                                  Delete Post
                                </Button>
                              </Table.Cell>
                            </Table.Row>
                          );
                        })}
                        {posts.length === 0 && (
                          <Table.Row>
                            <Table.Cell
                              colSpan={4}
                              textAlign="center"
                              py={4}
                              color="fg.subtle"
                              fontStyle="italic"
                            >
                              No posts recorded yet.
                            </Table.Cell>
                          </Table.Row>
                        )}
                      </Table.Body>
                    </Table.Root>
                  </TableScrollArea>
                </Box>
              </Box>
            </>
          )}
        </VStack>
      )}`;

if (content.indexOf(mediaPanelEnd) !== -1) {
  content = content.replace(mediaPanelEnd, staffPanelJSX);
} else {
  console.error("Could not find media panel end marker.");
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Programmatic refactoring completed successfully.');
