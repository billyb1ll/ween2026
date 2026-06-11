import { Box, Flex, Heading, HStack, Text, VStack, Button, Textarea, Spinner, Badge } from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import { useUser } from '../context/UserContext'
import { supabase } from '../lib/supabase'
import { toaster } from '../components/ui/toaster'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

type BoardTab = 'hype' | 'memory'
type PostCategory = 'all' | 'orientation' | 'events' | 'qa' | 'social'

interface DBPost {
  id: number
  content: string
  createdAt: string
  likes: number
  tags: string
  is_anonymous: boolean
  is_hidden: boolean
  student_id: string
  type: 'hype' | 'memory'
  author: {
    student_id: string
    nickname: string | null
    avatar_color: string
  }
}

const trendingTopics = [
  { category: 'Orientation', tag: '#Baan7Tour', posts: 124 },
  { category: 'Social', tag: 'Game Night Invite', posts: 89 },
  { category: 'Q&A', tag: 'Course Registration', posts: 45 },
]

const activeBaans = [
  { code: 'B7', name: 'Baan 7', count: '+45', active: true },
  { code: 'B3', name: 'Baan 3', count: '+23', active: false },
  { code: 'B12', name: 'Baan 12', count: '+18', active: false },
]

const categories: { label: string; value: PostCategory }[] = [
  { label: 'All', value: 'all' },
  { label: 'Orientation', value: 'orientation' },
  { label: 'Events', value: 'events' },
  { label: 'Q&A', value: 'qa' },
  { label: 'Social', value: 'social' },
]

const getRelativeTime = (isoString: string) => {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function BoardPage() {
  const { user } = useUser()
  const [activeTab, setActiveTab] = useState<BoardTab>('hype')
  const [activeCategory, setActiveCategory] = useState<PostCategory>('all')
  const [newPostText, setNewPostText] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [posts, setPosts] = useState<DBPost[]>([])

  // Feature Toggle configurations
  const [hypeActive, setHypeActive] = useState(true)
  const [memoryActive, setMemoryActive] = useState(true)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [visibleCount, setVisibleCount] = useState(6)
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const [prevVisibleCount, setPrevVisibleCount] = useState(6)
  const shouldReduceMotion = useReducedMotion() ?? false

  // Fetch Board Posts & Configs from Supabase
  useEffect(() => {
    let active = true

    const fetchData = async () => {
      setLoading(true)
      try {
        // Fetch feature toggles
        const { data: configData } = await supabase.from('system_config').select('*')
        if (!active) return

        let finalHype = true
        let finalMemory = true

        if (configData) {
          const hype = configData.find((c) => c.key === 'enable_hype_board')
          const memory = configData.find((c) => c.key === 'enable_memory_board')
          if (hype) {
            setHypeActive(hype.value)
            finalHype = hype.value
          }
          if (memory) {
            setMemoryActive(memory.value)
            finalMemory = memory.value
          }
        }

        // Adjust default tab based on toggles
        if (!finalHype && finalMemory) {
          setActiveTab('memory')
        } else {
          setActiveTab('hype')
        }

        // Fetch posts
        const { data: postsData, error: postsError } = await supabase
          .from('posts')
          .select('*, author:users(student_id, nickname, avatar_color)')
          .eq('is_hidden', false)
          .order('created_at', { ascending: false })

        if (postsError) throw postsError
        if (!active) return

        if (postsData) {
          // Map properties to fit interface
          const mapped: DBPost[] = postsData.map((p) => ({
            id: Number(p.id),
            content: p.content,
            createdAt: p.created_at,
            likes: p.likes,
            tags: p.tags,
            is_anonymous: p.is_anonymous,
            is_hidden: p.is_hidden,
            student_id: p.student_id,
            type: p.type as 'hype' | 'memory',
            author: {
              student_id: p.author?.student_id || '',
              nickname: p.author?.nickname || 'Guest Whitelist',
              avatar_color: p.author?.avatar_color || '#496268',
            },
          }))
          setPosts(mapped)
        }
      } catch (err) {
        console.error('Error fetching board data:', err)
        toaster.create({
          title: 'Error loading posts',
          description: 'Failed to fetch board entries from Supabase.',
          type: 'error',
        })
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchData()
    return () => {
      active = false
    }
  }, [])

  // Create Board Post
  const handleCreatePost = async () => {
    if (!user) {
      toaster.create({
        title: 'Sign In Required',
        description: 'Please sign in or register to share your orientation vibes!',
        type: 'warning',
      })
      return
    }

    if (!newPostText.trim()) {
      return
    }

    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('posts')
        .insert({
          content: newPostText.trim(),
          student_id: user.student_id,
          tags: activeCategory === 'all' ? 'orientation' : activeCategory,
          type: activeTab,
          is_anonymous: isAnonymous,
        })
        .select('*, author:users(student_id, nickname, avatar_color)')
        .single()

      if (error) throw error

      if (data) {
        const createdPost: DBPost = {
          id: Number(data.id),
          content: data.content,
          createdAt: data.created_at,
          likes: data.likes,
          tags: data.tags,
          is_anonymous: data.is_anonymous,
          is_hidden: data.is_hidden,
          student_id: data.student_id,
          type: data.type as 'hype' | 'memory',
          author: {
            student_id: data.author?.student_id || '',
            nickname: data.author?.nickname || 'Guest Whitelist',
            avatar_color: data.author?.avatar_color || '#496268',
          },
        }

        setPosts((prev) => [createdPost, ...prev])
        setNewPostText('')
        setIsAnonymous(false) // Reset
        toaster.create({
          title: 'Posted!',
          description: 'Your message has been posted on the Board.',
          type: 'success',
        })
      }
    } catch (err) {
      console.error(err)
      toaster.create({
        title: 'Error posting message',
        type: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Like Board Post
  const handleLikePost = async (postId: number) => {
    try {
      const match = posts.find((p) => p.id === postId)
      if (!match) return

      const nextLikes = match.likes + 1
      const { error } = await supabase
        .from('posts')
        .update({ likes: nextLikes })
        .eq('id', postId)

      if (error) throw error

      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, likes: nextLikes } : p))
      )
    } catch (err) {
      console.error('Liking post failed:', err)
    }
  }

  const handleLoadMore = () => {
    setIsFetchingMore(true)
    setTimeout(() => {
      setPrevVisibleCount(visibleCount)
      setVisibleCount((prev) => prev + 6)
      setIsFetchingMore(false)
    }, 1500)
  }

  // Filter posts by active tab and active category
  const filteredPosts = posts
    .filter((p) => p.type === activeTab)
    .filter((p) => (activeCategory === 'all' ? true : p.tags === activeCategory))

  const visiblePosts = filteredPosts.slice(0, visibleCount)
  const hasMore = filteredPosts.length > visibleCount

  return (
    <Box
      position="relative"
      zIndex={10}
      maxW="var(--container-max)"
      mx="auto"
      px={{ base: 4, md: 16 }}
      pt={{ base: 2, md: 28 }}
      pb={{ base: 4, md: 20 }}
      minH="100vh"
    >
      {/* Page Header */}
      <VStack gap={2} mb={{ base: 4, md: 8 }} animation="fade-in-up 0.6s var(--ease-out-expo) both">
        <Heading
          as="h1"
          fontFamily="heading"
          fontSize={{ base: '2rem', md: '3.5rem' }}
          fontWeight={700}
          lineHeight={1.1}
          letterSpacing="-0.02em"
          color="accent.solid"
          textAlign="center"
        >
          {!hypeActive && !memoryActive
            ? 'Boards Closed'
            : `The ${activeTab === 'hype' ? 'Hype' : 'Memory'} Board`}
        </Heading>
        <Text color="fg.muted" fontSize={{ base: 'sm', md: 'lg' }} textAlign="center" maxW="lg">
          {!hypeActive && !memoryActive
            ? 'Orientation boards are currently closed by staff. Check back soon!'
            : 'Share the excitement, cheer on your peers, and build the Baan 7 community spirit!'}
        </Text>
      </VStack>

      {/* Tab Toggle (Only visible if BOTH are active) */}
      {hypeActive && memoryActive && (
        <Flex justify="center" mb={{ base: 4, md: 8 }}>
          <HStack
            role="tablist"
            aria-label="Board selection"
            bg="bg.surface"
            border="1px solid"
            borderColor="border.subtle"
            borderRadius="full"
            p={1}
            gap={0}
          >
            <TabButton
              active={activeTab === 'hype'}
              onClick={() => {
                setActiveTab('hype')
                setVisibleCount(6)
                setPrevVisibleCount(6)
              }}
              icon="campaign"
              label="Hype Board"
            />
            <TabButton
              active={activeTab === 'memory'}
              onClick={() => {
                setActiveTab('memory')
                setVisibleCount(6)
                setPrevVisibleCount(6)
              }}
              icon="push_pin"
              label="Memory Board"
            />
          </HStack>
        </Flex>
      )}

      {/* Mobile: Trending Topics — horizontal scroll */}
      {hypeActive && (
        <Box display={{ base: 'block', lg: 'none' }} mb={4} mx={-4} px={4}>
          <Flex
            overflowX="auto"
            gap={2}
            pb={2}
            css={{
              '&::-webkit-scrollbar': { display: 'none' },
              scrollbarWidth: 'none',
            }}
          >
            {trendingTopics.map((topic) => (
              <Box
                key={topic.tag}
                flexShrink={0}
                bg="bg.surface"
                border="1px solid"
                borderColor="border.subtle"
                borderRadius="xl"
                px={3}
                py={2}
                minW="140px"
              >
                <Text
                  fontSize="2xs"
                  fontWeight="600"
                  color="fg.subtle"
                  textTransform="uppercase"
                  letterSpacing="0.05em"
                >
                  {topic.category}
                </Text>
                <Text fontSize="xs" fontWeight="700" color="fg.default">
                  {topic.tag}
                </Text>
                <Text fontSize="2xs" color="fg.subtle">
                  {topic.posts} posts
                </Text>
              </Box>
            ))}
            {activeBaans
              .filter((b) => b.active)
              .map((baan) => (
                <Box
                  key={baan.code}
                  flexShrink={0}
                  bg="accent.subtle"
                  border="1px solid"
                  borderColor="accent.muted"
                  borderRadius="xl"
                  px={3}
                  py={2}
                  minW="100px"
                >
                  <Flex align="center" gap={2}>
                    <Box
                      w={6}
                      h={6}
                      borderRadius="md"
                      bg="accent.solid"
                      color="white"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      fontSize="2xs"
                      fontWeight="700"
                    >
                      {baan.code}
                    </Box>
                    <VStack align="start" gap={0}>
                      <Text fontSize="xs" fontWeight="600" color="fg.default">
                        {baan.name}
                      </Text>
                      <Text fontSize="2xs" color="fg.subtle">
                        {baan.count} online
                      </Text>
                    </VStack>
                  </Flex>
                </Box>
              ))}
          </Flex>
        </Box>
      )}

      {/* Categories filters */}
      {(hypeActive || memoryActive) && (
        <Box
          bg="bg.hero"
          border="1px solid"
          borderColor="border.subtle"
          borderRadius="xl"
          px={{ base: 3, md: 5 }}
          py={3}
          mb={{ base: 4, md: 6 }}
          animation="fade-in-up 0.6s var(--ease-out-expo) 0.1s both"
        >
          <Flex align="center" gap={{ base: 2, md: 3 }} flexWrap="wrap">
            <Text
              fontSize="xs"
              fontWeight="600"
              letterSpacing="0.05em"
              color="fg.subtle"
              display={{ base: 'none', md: 'block' }}
            >
              Filter by:
            </Text>
            <HStack gap={2} flexWrap="wrap">
              {categories.map((cat) => (
                <Button
                  key={cat.value}
                  type="button"
                  aria-pressed={activeCategory === cat.value}
                  onClick={() => {
                    setActiveCategory(cat.value)
                    setVisibleCount(6)
                    setPrevVisibleCount(6)
                  }}
                  px={4}
                  py={2}
                  h="auto"
                  borderRadius="full"
                  fontSize="xs"
                  fontWeight="600"
                  letterSpacing="0.03em"
                  cursor="pointer"
                  transition="all 0.2s"
                  bg={activeCategory === cat.value ? 'accent.solid' : 'bg.surface'}
                  color={activeCategory === cat.value ? 'white' : 'fg.default'}
                  border="1px solid"
                  borderColor={activeCategory === cat.value ? 'accent.solid' : 'border.subtle'}
                  _hover={{
                    bg: activeCategory === cat.value ? 'accent.solid' : 'bg.hero',
                  }}
                  minH="44px"
                >
                  {cat.label}
                </Button>
              ))}
            </HStack>
          </Flex>
        </Box>
      )}

      {/* Main Grid */}
      {(hypeActive || memoryActive) && (
        <Box
          display="grid"
          gridTemplateColumns={{ base: '1fr', lg: '1fr 280px' }}
          gap={{ base: 4, md: 8 }}
        >
          {/* Posts Column */}
          <VStack align="stretch" gap={{ base: 4, md: 6 }}>
            {/* Composer */}
            <Box
              bg="bg.surface"
              border="1px solid"
              borderColor="border.subtle"
              borderRadius="2xl"
              p={{ base: 4, md: 6 }}
              animation="fade-in-up 0.6s var(--ease-out-expo) 0.15s both"
            >
              <Flex gap={{ base: 3, md: 4 }} align="start">
                {user ? (
                  <Box
                    w={{ base: 10, md: 12 }}
                    h={{ base: 10, md: 12 }}
                    borderRadius="full"
                    bg={user.avatar_color}
                    color="white"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    fontWeight="700"
                    fontSize="sm"
                    flexShrink={0}
                  >
                    {getInitials(user.nickname || user.student_id)}
                  </Box>
                ) : (
                  <Box
                    w={{ base: 10, md: 12 }}
                    h={{ base: 10, md: 12 }}
                    borderRadius="full"
                    bg="brand.muted"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    flexShrink={0}
                  >
                    <Box className="material-symbols-outlined" fontSize="xl" color="brand.fg">
                      person
                    </Box>
                  </Box>
                )}
                <Box flex={1}>
                  <label htmlFor="board-composer" className="sr-only">
                    {activeTab === 'hype' ? 'Share the hype' : 'Pin something new'}
                  </label>
                  <Textarea
                    id="board-composer"
                    placeholder={
                      !user
                        ? 'Sign in to post orientation hype...'
                        : activeTab === 'hype'
                        ? "Share the hype! What's exciting today?"
                        : 'Pin something new to the board...'
                    }
                    value={newPostText}
                    onChange={(e) => setNewPostText(e.target.value)}
                    disabled={!user || submitting}
                    maxLength={activeTab === 'hype' ? 280 : 150}
                    variant="flushed"
                    resize="none"
                    fontSize="md"
                    color="var(--c-ink)"
                    _focus={{ borderColor: 'var(--c-lagoon)' }}
                    minH="60px"
                    p={0}
                    mb={2}
                  />

                  {/* Anonymous Posting check & submission controls */}
                  <Flex justify="space-between" align="center" mt={2} flexWrap="wrap" gap={3}>
                    <HStack gap={3}>
                      {user && activeTab === 'hype' && (
                        <HStack gap={2}>
                          <input
                            type="checkbox"
                            id="anon-checkbox"
                            checked={isAnonymous}
                            onChange={(e) => setIsAnonymous(e.target.checked)}
                            style={{
                              width: '18px',
                              height: '18px',
                              accentColor: 'var(--c-lagoon)',
                              cursor: 'pointer',
                            }}
                          />
                          <label
                            htmlFor="anon-checkbox"
                            style={{ fontSize: '12px', fontWeight: 600, color: 'var(--c-muted)', cursor: 'pointer' }}
                          >
                            Post Anonymously
                          </label>
                        </HStack>
                      )}
                    </HStack>
                    <HStack gap={4} align="center">
                      {user && (
                        <Text fontSize="xs" color="fg.subtle" fontWeight="600">
                          {newPostText.length} / {activeTab === 'hype' ? 280 : 150}
                        </Text>
                      )}
                      <Button
                        bg="accent.solid"
                        color="white"
                        px={6}
                        py={2}
                        borderRadius="xl"
                        fontSize="sm"
                        fontWeight="600"
                        cursor="pointer"
                        onClick={handleCreatePost}
                        loading={submitting}
                        disabled={!user || !newPostText.trim()}
                        _hover={{ boxShadow: '0 4px 14px rgba(124, 86, 63, 0.25)' }}
                        minH="44px"
                      >
                        {activeTab === 'hype' ? 'Post' : 'Pin it!'}
                      </Button>
                    </HStack>
                  </Flex>
                </Box>
              </Flex>
            </Box>

            {/* Posts Grid */}
            {loading ? (
              <Flex justify="center" py={12}>
                <Spinner size="lg" color="var(--c-lagoon)" />
              </Flex>
            ) : filteredPosts.length === 0 ? (
              <Flex
                justify="center"
                py={12}
                bg="bg.surface"
                border="1px dashed"
                borderColor="border.subtle"
                borderRadius="2xl"
              >
                <Text color="fg.subtle">No posts in this category yet. Be the first to post!</Text>
              </Flex>
            ) : activeTab === 'memory' ? (
              /* Memory Cards */
              <Box
                position="relative"
                display="grid"
                gridTemplateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)' }}
                gap={{ base: 4, md: 5 }}
              >
                {visiblePosts.map((post, i) => {
                  const card = (
                    <MemoryCard post={post} index={i} onLike={handleLikePost} currentUserRole={user?.role} />
                  )
                  if (i >= prevVisibleCount) {
                    return (
                      <motion.div
                        key={post.id}
                        initial={shouldReduceMotion ? { opacity: 0 } : { y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={
                          shouldReduceMotion
                            ? { duration: 0.2 }
                            : {
                                type: 'spring',
                                stiffness: 300,
                                damping: 20,
                                delay: (i - prevVisibleCount) * 0.05,
                              }
                        }
                        style={{ height: '100%' }}
                      >
                        {card}
                      </motion.div>
                    )
                  }
                  return (
                    <Box key={post.id} style={{ height: '100%' }}>
                      {card}
                    </Box>
                  )
                })}
              </Box>
            ) : (
              /* Hype Cards */
              <Box
                display="grid"
                gridTemplateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }}
                gap={{ base: 3, md: 5 }}
              >
                {visiblePosts.map((post, i) => {
                  const card = (
                    <HypeCard post={post} index={i} onLike={handleLikePost} currentUserRole={user?.role} />
                  )
                  if (i >= prevVisibleCount) {
                    return (
                      <motion.div
                        key={post.id}
                        initial={shouldReduceMotion ? { opacity: 0 } : { y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={
                          shouldReduceMotion
                            ? { duration: 0.2 }
                            : {
                                type: 'spring',
                                stiffness: 300,
                                damping: 20,
                                delay: (i - prevVisibleCount) * 0.05,
                              }
                        }
                        style={{ height: '100%' }}
                      >
                        {card}
                      </motion.div>
                    )
                  }
                  return (
                    <Box key={post.id} style={{ height: '100%' }}>
                      {card}
                    </Box>
                  )
                })}
              </Box>
            )}
          </VStack>

          {/* Sidebar */}
          <VStack
            align="stretch"
            gap={6}
            display={{ base: 'none', lg: 'flex' }}
            animation="slide-in-right 0.6s var(--ease-out-expo) 0.3s both"
          >
            {/* Trending topics */}
            <Box bg="bg.surface" border="1px solid" borderColor="border.subtle" borderRadius="2xl" p={5}>
              <Flex align="center" gap={2} mb={4}>
                <Box className="material-symbols-outlined" fontSize="lg" color="accent.solid">
                  push_pin
                </Box>
                <Heading as="h2" fontFamily="heading" fontSize="lg" fontWeight="600" color="fg.default">
                  Trending Topics
                </Heading>
              </Flex>
              <VStack align="stretch" gap={3}>
                {trendingTopics.map((topic, i) => (
                  <Box key={topic.tag}>
                    <Text
                      fontSize="2xs"
                      fontWeight="600"
                      letterSpacing="0.05em"
                      color="fg.subtle"
                      textTransform="uppercase"
                    >
                      {i + 1}. {topic.category}
                    </Text>
                    <Text fontSize="sm" fontWeight="700" color="fg.default">
                      {topic.tag}
                    </Text>
                    <Text fontSize="2xs" color="fg.subtle">
                      {topic.posts} posts
                    </Text>
                  </Box>
                ))}
              </VStack>
            </Box>

            {/* Active baans */}
            <Box bg="bg.surface" border="1px solid" borderColor="border.subtle" borderRadius="2xl" p={5}>
              <Flex align="center" gap={2} mb={4}>
                <Box className="material-symbols-outlined" fontSize="lg" color="accent.solid">
                  local_fire_department
                </Box>
                <Heading as="h2" fontFamily="heading" fontSize="lg" fontWeight="600" color="fg.default">
                  Active Baans
                </Heading>
              </Flex>
              <VStack align="stretch" gap={2}>
                {activeBaans.map((baan) => (
                  <Flex
                    key={baan.code}
                    align="center"
                    justify="space-between"
                    p={3}
                    borderRadius="xl"
                    bg={baan.active ? 'accent.subtle' : 'transparent'}
                    border={baan.active ? '1px solid' : '1px solid transparent'}
                    borderColor={baan.active ? 'accent.muted' : 'transparent'}
                  >
                    <HStack gap={3}>
                      <Box
                        w={8}
                        h={8}
                        borderRadius="lg"
                        bg={baan.active ? 'accent.solid' : 'bg.elevated'}
                        color={baan.active ? 'white' : 'fg.default'}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        fontSize="xs"
                        fontWeight="700"
                      >
                        {baan.code}
                      </Box>
                      <Text fontSize="sm" fontWeight="600" color="fg.default">
                        {baan.name}
                      </Text>
                    </HStack>
                    <Text fontSize="xs" fontWeight="600" color="fg.subtle">
                      {baan.count}
                    </Text>
                  </Flex>
                ))}
              </VStack>
            </Box>
          </VStack>
        </Box>
      )}

      {/* Pagination */}
      {(hypeActive || memoryActive) && (hasMore || isFetchingMore) && (
        <Flex justify="center" mt={{ base: 6, md: 12 }} minH="60px">
          <AnimatePresence mode="wait">
            {isFetchingMore ? (
              <motion.div
                key="loader"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <JellyScrollLoader />
              </motion.div>
            ) : (
              <motion.div
                key="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Button
                  type="button"
                  onClick={handleLoadMore}
                  display="inline-flex"
                  alignItems="center"
                  gap={2}
                  bg="bg.surface"
                  border="1px solid"
                  borderColor="border.subtle"
                  px={{ base: 6, md: 8 }}
                  py={3}
                  borderRadius="full"
                  fontSize="sm"
                  fontWeight="600"
                  color="fg.default"
                  cursor="pointer"
                  transition="all 0.2s"
                  _hover={{ bg: 'bg.hero', boxShadow: 'var(--shadow-card-hover)' }}
                  minH="44px"
                >
                  Load More {activeTab === 'hype' ? 'Hype' : 'Memories'}
                  <Box className="material-symbols-outlined" fontSize="md">
                    expand_more
                  </Box>
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </Flex>
      )}
    </Box>
  )
}

function JellyScrollLoader() {
  const shouldReduceMotion = useReducedMotion() ?? false

  return (
    <VStack gap={3} align="center" py={4}>
      <motion.div
        animate={shouldReduceMotion ? {} : { scale: [0.95, 1.05, 0.95] }}
        transition={
          shouldReduceMotion
            ? {}
            : {
                repeat: Infinity,
                duration: 1.5,
                ease: 'easeInOut',
              }
        }
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
      >
        <Box
          w="36px"
          h="36px"
          borderRadius="full"
          border="4px solid rgba(197, 224, 230, 0.3)"
          borderTopColor="var(--c-chocolate)"
          style={{
            animation: 'spin 0.8s linear infinite',
          }}
        />
      </motion.div>

      <motion.div
        animate={shouldReduceMotion ? {} : { opacity: [0.4, 1, 0.4] }}
        transition={
          shouldReduceMotion
            ? {}
            : {
                repeat: Infinity,
                duration: 1.5,
                ease: 'easeInOut',
              }
        }
      >
        <Text fontSize="xs" fontWeight="600" color="var(--c-chocolate)" fontFamily="body">
          Fetching more vibes...
        </Text>
      </motion.div>
    </VStack>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: string
  label: string
}) {
  return (
    <Button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      display="inline-flex"
      alignItems="center"
      gap={2}
      px={{ base: 4, md: 6 }}
      py={2.5}
      borderRadius="full"
      fontSize="sm"
      fontWeight="600"
      letterSpacing="0.03em"
      cursor="pointer"
      transition="all 0.3s var(--ease-out-quart)"
      bg={active ? 'accent.solid' : 'transparent'}
      color={active ? 'white' : 'fg.subtle'}
      _hover={{
        bg: active ? 'accent.solid' : 'bg.hero',
      }}
      minH="44px"
    >
      <Box className="material-symbols-outlined" fontSize="lg">
        {icon}
      </Box>
      <Text display={{ base: 'none', sm: 'block' }}>{label}</Text>
    </Button>
  )
}

interface HypeCardProps {
  post: DBPost
  index: number
  onLike: (id: number) => void
  currentUserRole?: string
}

function HypeCard({ post, index, onLike, currentUserRole }: HypeCardProps) {
  const [liked, setLiked] = useState(false)

  const handleLike = () => {
    setLiked(!liked)
    onLike(post.id)
  }

  // Anonymity check: If anonymous and not Superadmin, mask author data
  const isAnon = post.is_anonymous
  const displayAuthorName =
    isAnon && currentUserRole !== 'superadmin' ? 'Anonymous' : post.author.nickname || 'Guest Whitelist'
  const displayAuthorInitials = isAnon && currentUserRole !== 'superadmin' ? '?' : getInitials(displayAuthorName)
  const displayAvatarColor = isAnon && currentUserRole !== 'superadmin' ? '#8c7b74' : post.author.avatar_color

  return (
    <Box
      bg="bg.surface"
      border="1px solid"
      borderColor="border.subtle"
      borderRadius="2xl"
      p={{ base: 4, md: 5 }}
      transition="all 0.3s var(--ease-out-quart)"
      animation={`fade-in-up 0.5s var(--ease-out-expo) ${Math.min(0.1 + index * 0.05, 0.4)}s both`}
      _hover={{
        transform: 'translateY(-2px)',
        boxShadow: 'var(--shadow-card-hover)',
      }}
    >
      {/* Author row */}
      <Flex align="center" gap={3} mb={3}>
        <Box
          w={{ base: 8, md: 10 }}
          h={{ base: 8, md: 10 }}
          borderRadius="full"
          bg={displayAvatarColor}
          display="flex"
          alignItems="center"
          justifyContent="center"
          fontSize="sm"
          fontWeight="700"
          color="white"
        >
          {displayAuthorInitials}
        </Box>
        <VStack align="start" gap={0} flex={1}>
          <Text fontSize="sm" fontWeight="700" color="fg.default" display="inline-flex" gap={1} flexWrap="wrap">
            {displayAuthorName}
            {isAnon && currentUserRole === 'superadmin' && (
              <Badge colorPalette="orange" fontSize="3xs" alignSelf="center">
                Anonymous (ID: {post.student_id})
              </Badge>
            )}
          </Text>
          <Text fontSize="2xs" color="fg.subtle">
            {getRelativeTime(post.createdAt)}
          </Text>
        </VStack>
        <Box
          px={2.5}
          py={0.5}
          borderRadius="full"
          fontSize="2xs"
          fontWeight="600"
          bg={
            post.tags === 'orientation'
              ? 'brand.muted'
              : post.tags === 'events'
              ? 'bg.hero'
              : post.tags === 'qa'
              ? 'brand.subtle'
              : 'accent.subtle'
          }
          color={post.tags === 'orientation' ? 'brand.fg' : 'fg.default'}
        >
          {post.tags.charAt(0).toUpperCase() + post.tags.slice(1)}
        </Box>
      </Flex>

      {/* Content */}
      <Text fontSize="sm" color="fg.default" lineHeight={1.6} mb={3}>
        {post.content}
      </Text>

      {/* Actions */}
      <Flex gap={4} align="center">
        <Button
          type="button"
          aria-label={liked ? 'Unlike post' : 'Like post'}
          gap={1}
          cursor="pointer"
          onClick={handleLike}
          transition="color 0.2s"
          color={liked ? 'var(--c-state-liked)' : 'fg.subtle'}
          bg="transparent"
          border="none"
          p={1}
          minH="44px"
          minW="44px"
          display="flex"
          alignItems="center"
        >
          <Box
            className="material-symbols-outlined"
            fontSize="lg"
            fontVariationSettings={liked ? "'FILL' 1" : undefined}
            transition="transform 0.2s"
            _hover={{ transform: 'scale(1.2)' }}
          >
            favorite
          </Box>
          <Text fontSize="xs" fontWeight="600">
            {post.likes}
          </Text>
        </Button>
      </Flex>
    </Box>
  )
}

interface MemoryCardProps {
  post: DBPost
  index: number
  onLike: (id: number) => void
  currentUserRole?: string
}

function MemoryCard({ post, index, onLike, currentUserRole }: MemoryCardProps) {
  const [liked, setLiked] = useState(false)

  const handleLike = () => {
    setLiked(!liked)
    onLike(post.id)
  }

  const rotations = [-2, 1.5, -1, 2, -0.5]
  const rotation = rotations[index % rotations.length]

  // Anonymity check: If anonymous and not Superadmin, mask author data
  const isAnon = post.is_anonymous
  const displayAuthorName =
    isAnon && currentUserRole !== 'superadmin' ? 'Anonymous' : post.author.nickname || 'Guest Whitelist'
  const displayAuthorInitials = isAnon && currentUserRole !== 'superadmin' ? '?' : getInitials(displayAuthorName)
  const displayAvatarColor = isAnon && currentUserRole !== 'superadmin' ? '#8c7b74' : post.author.avatar_color

  return (
    <Box
      bg="bg.surface"
      border="1px dashed"
      borderColor="border.default"
      borderRadius="xl"
      p={{ base: 4, md: 5 }}
      position="relative"
      transform={{ base: 'none', md: `rotate(${rotation}deg)` }}
      transition="all 0.3s var(--ease-out-quart)"
      animation={`fade-in-up 0.5s var(--ease-out-expo) ${Math.min(0.1 + index * 0.05, 0.5)}s both`}
      _hover={{
        transform: 'rotate(0deg) translateY(-4px)',
        boxShadow: 'var(--shadow-card-hover)',
        zIndex: 10,
      }}
    >
      {/* Push Pin */}
      <Box
        position="absolute"
        top={-2}
        left="50%"
        transform="translateX(-50%)"
        w={4}
        h={4}
        borderRadius="full"
        bg={index % 2 === 0 ? 'var(--c-state-pin-a)' : 'var(--c-state-pin-b)'}
        boxShadow="0 2px 4px rgba(0,0,0,0.2)"
        zIndex={2}
      />

      {/* Author */}
      <Flex align="center" gap={2} mb={3}>
        <Box
          w={8}
          h={8}
          borderRadius="full"
          bg={displayAvatarColor}
          display="flex"
          alignItems="center"
          justifyContent="center"
          fontSize="xs"
          fontWeight="700"
          color="white"
        >
          {displayAuthorInitials}
        </Box>
        <VStack align="start" gap={0} flex={1}>
          <Text fontSize="xs" fontWeight="700" color="fg.default" display="inline-flex" gap={1} flexWrap="wrap">
            {displayAuthorName}
            {isAnon && currentUserRole === 'superadmin' && (
              <Badge colorPalette="orange" fontSize="3xs" alignSelf="center">
                Anonymous (ID: {post.student_id})
              </Badge>
            )}
          </Text>
          <Text fontSize="2xs" color="fg.subtle">
            {getRelativeTime(post.createdAt)}
          </Text>
        </VStack>
      </Flex>

      {/* Content */}
      <Text
        fontSize="sm"
        color="fg.default"
        lineHeight={1.6}
        fontStyle={index % 3 === 0 ? 'italic' : 'normal'}
        fontFamily={index % 3 === 0 ? 'heading' : 'body'}
        mb={3}
      >
        {post.content}
      </Text>

      {/* Actions */}
      <Flex gap={3} align="center">
        <Button
          type="button"
          aria-label={liked ? 'Unlike post' : 'Like post'}
          gap={1}
          cursor="pointer"
          onClick={handleLike}
          color={liked ? 'var(--c-state-liked)' : 'fg.subtle'}
          bg="transparent"
          border="none"
          p={1}
          minH="44px"
          minW="44px"
          display="flex"
          alignItems="center"
        >
          <Box className="material-symbols-outlined" fontSize="md" fontVariationSettings={liked ? "'FILL' 1" : undefined}>
            favorite
          </Box>
          <Text fontSize="2xs" fontWeight="600">
            {post.likes}
          </Text>
        </Button>
      </Flex>
    </Box>
  )
}
