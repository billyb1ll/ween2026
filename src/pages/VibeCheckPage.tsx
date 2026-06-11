import { Box, Flex, Heading, HStack, Text, VStack, Button, Input, Portal, Image, Spinner } from '@chakra-ui/react'
import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, useMotionValue, useTransform, AnimatePresence, useReducedMotion, animate } from 'framer-motion'
import { useUser } from '../context/UserContext'
import { supabase } from '../lib/supabase'
import { toaster } from '../components/ui/toaster'

interface Profile {
  id: string // student_id
  name: string
  age: number
  major: string
  bio: string
  images: string[]
  tags: string[]
  isStaff?: boolean
}

interface Message {
  id: number
  sender: 'user' | 'match'
  text: string
  timestamp: string
}

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface SwipedItem {
  profileId: string
  direction: 'left' | 'right'
}

export function VibeCheckPage() {
  const { user } = useUser()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [animatingDir, setAnimatingDir] = useState<'left' | 'right' | 'rewind-left' | 'rewind-right' | null>(null)
  const [matchCount, setMatchCount] = useState(3)
  const [statusMessage, setStatusMessage] = useState('')
  const [activePhotoIndex, setActivePhotoIndex] = useState(0)
  const [swipedHistory, setSwipedHistory] = useState<SwipedItem[]>([])

  // Match celebration state
  const [matchedProfile, setMatchedProfile] = useState<Profile | null>(null)
  const [chatMessage, setChatMessage] = useState('')
  const [confetti, setConfetti] = useState<{ id: number; left: number; size: number; color: string; duration: number; delay: number }[]>([])

  // Slide-up Chat Drawer state
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<Message[]>([])
  const [isTyping, setIsTyping] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)
  const shouldReduceMotion = useReducedMotion() ?? false

  // Drag Gesture Physics Motion Values
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 200], [-20, 20])
  const likeOpacity = useTransform(x, [0, 80], [0, 1])
  const nopeOpacity = useTransform(x, [-80, 0], [1, 0])

  // Fetch profiles from database on load
  useEffect(() => {
    let active = true
    const fetchProfiles = async () => {
      setLoading(true)
      try {
        let query = supabase
          .from('users')
          .select('*')
          .not('nickname', 'is', null)
          .not('faculty', 'is', null)

        if (user) {
          query = query.neq('student_id', user.student_id)
        }

        const { data, error } = await query
        if (error) throw error

        if (!active) return

        if (data) {
          const mapped: Profile[] = data.map((u) => ({
            id: u.student_id,
            name: u.nickname || 'Student',
            age: 18, // Default age or derived
            major: u.major || 'Freshman',
            bio: u.ig ? `IG: @${u.ig}` : 'Excited to attend Baan 7 Orientation! 🚀',
            images: u.images && u.images.length > 0 ? u.images : [
              'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500&h=700&fit=crop'
            ],
            tags: u.tags && u.tags.length > 0 ? u.tags : [u.faculty || 'Baan 7', 'Freshman'],
            isStaff: u.role === 'staff' || u.role === 'superadmin'
          }))
          setProfiles(mapped)
        }
      } catch (err) {
        console.error('Error fetching swipeable profiles:', err)
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchProfiles()
    return () => {
      active = false
    }
  }, [user])



  const currentProfile = currentIndex < profiles.length ? profiles[currentIndex] : null

  // Auto-scroll chat drawer
  useEffect(() => {
    if (isChatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages, isChatOpen, isTyping])

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    const profile = profiles[currentIndex]
    if (!profile) return

    // Add to rewind history
    setSwipedHistory((prev) => [...prev, { profileId: profile.id, direction }])

    // Match probability trigger
    let isMatch = false
    if (direction === 'right') {
      const isStaff = profile.isStaff || false
      const randomMatch = Math.random() < 0.25
      if (isStaff || randomMatch) {
        isMatch = true
      }
    }

    const targetX = direction === 'right' ? 300 : -300
    setAnimatingDir(direction)
    setStatusMessage(
      direction === 'right'
        ? `Liked ${profile.name}!`
        : `Passed on ${profile.name}`
    )

    if (shouldReduceMotion) {
      x.set(targetX)
      if (isMatch) {
        setMatchedProfile(profile)
        setMatchCount((prev) => prev + 1)

        // Generate pure static confetti parameters on trigger
        const newConfetti = Array.from({ length: 30 }).map((_, i) => ({
          id: i,
          left: Math.random() * 100,
          size: Math.random() * 8 + 6,
          color: ['#496268', '#7c563f', '#fdcaad', '#c5e0e6', '#c0392b'][i % 5],
          duration: Math.random() * 2 + 2,
          delay: Math.random() * 0.5,
        }))
        setConfetti(newConfetti)
      } else {
        setCurrentIndex((prev) => prev + 1)
        setAnimatingDir(null)
        setActivePhotoIndex(0)
        x.set(0)
      }
    } else {
      // Smoothly animate the card to its target swipe position
      const anim = animate(x, targetX, { duration: 0.2 })

      if (isMatch) {
        anim.then(() => {
          setMatchedProfile(profile)
          setMatchCount((prev) => prev + 1)

          const newConfetti = Array.from({ length: 30 }).map((_, i) => ({
            id: i,
            left: Math.random() * 100,
            size: Math.random() * 8 + 6,
            color: ['#496268', '#7c563f', '#fdcaad', '#c5e0e6', '#c0392b'][i % 5],
            duration: Math.random() * 2 + 2,
            delay: Math.random() * 0.5,
          }))
          setConfetti(newConfetti)
        })
      } else {
        anim.then(() => {
          setCurrentIndex((prev) => prev + 1)
          setAnimatingDir(null)
          setActivePhotoIndex(0)
          x.set(0)
        })
      }
    }
  }, [currentIndex, profiles, x, shouldReduceMotion])

  // Keyboard navigation for desktop swiping
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger swipe if user is typing in chat or match dialog is open
      if (isChatOpen || matchedProfile || loading || currentIndex >= profiles.length) {
        return
      }

      if (e.key === 'ArrowLeft') {
        handleSwipe('left')
      } else if (e.key === 'ArrowRight') {
        handleSwipe('right')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isChatOpen, matchedProfile, loading, currentIndex, profiles.length, handleSwipe])

  const handleRewind = useCallback(() => {
    if (swipedHistory.length === 0) {
      toaster.create({
        title: 'Nothing to rewind',
        description: 'You have not swiped on any profiles yet.',
        type: 'info',
      })
      return
    }

    const nextHistory = [...swipedHistory]
    const lastSwipe = nextHistory.pop()!
    setSwipedHistory(nextHistory)

    // Inverse flight path: Slide card back in from correct boundary
    setAnimatingDir(lastSwipe.direction === 'right' ? 'rewind-right' : 'rewind-left')
    setCurrentIndex((prev) => prev - 1)
    setActivePhotoIndex(0) // Reset photo index back to 0 on profile rewind
  }, [swipedHistory])

  const dismissMatchAndAdvance = useCallback(() => {
    setMatchedProfile(null)
    setIsChatOpen(false)
    setChatMessages([])

    // Now advance deck index
    setCurrentIndex((prev) => prev + 1)
    setAnimatingDir(null)
    setActivePhotoIndex(0)
    x.set(0)
  }, [x])

  const handleSendMessage = () => {
    if (!chatMessage.trim() || !matchedProfile || isTyping) return

    const userMsgText = chatMessage
    setChatMessage('')

    // Add user message
    const userMsg: Message = {
      id: Date.now(),
      sender: 'user',
      text: userMsgText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    setChatMessages((prev) => [...prev, userMsg])

    // Trigger typing simulation
    setIsTyping(true)

    // Customize reply text based on profile
    let replyText = "Hey! Nice to meet you! Can't wait for orientation! 😊"
    const name = matchedProfile.name
    if (name.includes('Elena')) {
      replyText = "Hey! I'm actually just drawing some designs right now. Do you want to go grab a coffee at the campus café tomorrow? ☕"
    } else if (name.includes('Marcus')) {
      replyText = "Hey there! Always down for a new coding partner or jamming together. What kind of music are you into? 🎸"
    } else if (name.includes('Sophia')) {
      replyText = "Hi! Nice to meet you. I'm sketching near the main gallery. We should definitely explore the art scene together! 🎨"
    } else if (name.includes('Kai')) {
      replyText = "Hey! Awesome to connect. If you love the outdoors, we should definitely hit some trails soon! 🌿"
    } else if (name.includes("Bell") || matchedProfile.isStaff) {
      replyText = "Welcome to orientation! 🧡 I'm so excited to guide you and answer any questions you have about campus life or housing. Let's make this year amazing!"
    }

    setTimeout(() => {
      setIsTyping(false)
      const matchMsg: Message = {
        id: Date.now() + 1,
        sender: 'match',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      setChatMessages((prev) => [...prev, matchMsg])
    }, 1500)
  }

  if (loading) {
    return (
      <Flex minH="80vh" align="center" justify="center">
        <Spinner size="xl" color="var(--c-lagoon)" />
      </Flex>
    )
  }

  return (
    <Box
      position="relative"
      zIndex={10}
      maxW="var(--container-max)"
      mx="auto"
      px={{ base: 4, md: 16 }}
      pt={{ base: 4, md: 28 }}
      pb={{ base: 4, md: 20 }}
      height={{ base: 'calc(100dvh - 72px)', md: 'auto' }}
      minHeight={{ base: 'auto', md: '100vh' }}
      display="flex"
      flexDirection="column"
      overflow={{ base: 'hidden', md: 'visible' }}
    >
      {/* Screen reader status announcements */}
      <Box
        ref={statusRef}
        aria-live="polite"
        aria-atomic="true"
        position="absolute"
        w="1px"
        h="1px"
        overflow="hidden"
        clipPath="inset(50%)"
      >
        {statusMessage}
      </Box>

      {/* Page Header (Desktop) */}
      <VStack
        gap={2}
        mb={{ base: 2, md: 8 }}
        display={{ base: 'none', md: 'flex' }}
        animation="fade-in-up 0.6s var(--ease-out-expo) both"
      >
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
          Vibe Check
        </Heading>
        <Text color="fg.muted" fontSize={{ base: 'sm', md: 'lg' }} textAlign="center">
          Find your squad before orientation begins.
        </Text>
        <HStack
          bg="bg.surface"
          border="1px solid"
          borderColor="border.subtle"
          px={4}
          py={2}
          borderRadius="full"
          gap={2}
          mt={2}
        >
          <Box
            className="material-symbols-outlined"
            color="accent.solid"
            fontSize="lg"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            favorite
          </Box>
          <Text fontSize="sm" fontWeight="600" color="fg.default">
            {matchCount} Matches Today
          </Text>
        </HStack>
      </VStack>

      {/* Compact Page Header (Mobile) */}
      <Flex
        display={{ base: 'flex', md: 'none' }}
        align="center"
        justify="space-between"
        w="100%"
        mb={3}
        animation="fade-in-up 0.4s var(--ease-out-expo) both"
      >
        <Heading
          as="h1"
          fontFamily="heading"
          fontSize="xl"
          fontWeight={700}
          color="accent.solid"
        >
          Vibe Check
        </Heading>
        <HStack
          bg="bg.surface"
          border="1px solid"
          borderColor="border.subtle"
          px={3}
          py={1}
          borderRadius="full"
          gap={1.5}
        >
          <Box
            className="material-symbols-outlined"
            color="accent.solid"
            fontSize="xs"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            favorite
          </Box>
          <Text fontSize="2xs" fontWeight="600" color="fg.default">
            {matchCount} Matches
          </Text>
        </HStack>
      </Flex>

      {/* Swipe Deck Viewport */}
      <Flex
        position="relative"
        justify="center"
        align="center"
        py={{ base: 1, md: 4 }}
        flex={{ base: 1, md: 'none' }}
        h={{ base: 'auto', md: '520px' }}
        minH={{ base: 'auto', md: '520px' }}
        w="100%"
      >
        <AnimatePresence mode="wait">
          {currentProfile ? (
            <Box
              position="relative"
              w={{ base: '100%', sm: '360px', md: '400px' }}
              maxW="400px"
              h={{ base: '100%', md: '500px' }}
            >
              <motion.div
                key={currentProfile.id}
                style={{
                  x,
                  rotate,
                  touchAction: 'none',
                  width: '100%',
                  height: '100%',
                  cursor: shouldReduceMotion || !!matchedProfile ? 'auto' : 'grab',
                }}
                drag={shouldReduceMotion || !!matchedProfile ? false : 'x'}
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={(_, info) => {
                  if (shouldReduceMotion || !!matchedProfile) return
                  const threshold = 120
                  const velocity = info.velocity.x
                  if (info.offset.x > threshold || velocity > 500) {
                    handleSwipe('right')
                  } else if (info.offset.x < -threshold || velocity < -500) {
                    handleSwipe('left')
                  } else {
                    x.set(0)
                  }
                }}
                initial={
                  animatingDir === 'rewind-left' ? { x: -300, opacity: 0, rotate: -15 } :
                  animatingDir === 'rewind-right' ? { x: 300, opacity: 0, rotate: 15 } :
                  { scale: 0.95, opacity: 0 }
                }
                animate={{ x: 0, opacity: 1, scale: 1, rotate: 0 }}
                exit={
                  animatingDir === 'left' ? { x: -300, opacity: 0, rotate: -15 } :
                  animatingDir === 'right' ? { x: 300, opacity: 0, rotate: 15 } :
                  { opacity: 0 }
                }
                transition={
                  shouldReduceMotion ? { duration: 0.2 } : { type: 'spring', stiffness: 300, damping: 25 }
                }
                onAnimationComplete={() => {
                  setAnimatingDir(null)
                }}
              >
                {/* Card Container */}
                <Box
                  position="relative"
                  borderRadius="2xl"
                  overflow="hidden"
                  bg="bg.surface"
                  boxShadow="var(--shadow-card)"
                  border="1px solid"
                  borderColor="border.subtle"
                  h="100%"
                  display="flex"
                  flexDirection="column"
                  userSelect="none"
                >
                  {/* LIKE Stamp overlay */}
                  <motion.div
                    style={{
                      opacity: likeOpacity,
                      position: 'absolute',
                      top: '40px',
                      left: '40px',
                      rotate: '-12deg',
                      border: '4px solid #2ecc71',
                      color: '#2ecc71',
                      fontSize: '2rem',
                      fontWeight: 'bold',
                      padding: '4px 16px',
                      borderRadius: '8px',
                      zIndex: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                    }}
                  >
                    LIKE
                  </motion.div>

                  {/* NOPE Stamp overlay */}
                  <motion.div
                    style={{
                      opacity: nopeOpacity,
                      position: 'absolute',
                      top: '40px',
                      right: '40px',
                      rotate: '12deg',
                      border: '4px solid #e74c3c',
                      color: '#e74c3c',
                      fontSize: '2rem',
                      fontWeight: 'bold',
                      padding: '4px 16px',
                      borderRadius: '8px',
                      zIndex: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                    }}
                  >
                    NOPE
                  </motion.div>

                  {/* Profile Images Story Carousel */}
                  <Box
                    position="relative"
                    h={{ base: '100%', md: '360px' }}
                    overflow="hidden"
                  >
                    {/* Story indicators */}
                    <HStack position="absolute" top={3} left={3} right={3} gap={1.5} zIndex={10}>
                      {currentProfile.images.map((_, idx) => (
                        <Box
                          key={idx}
                          flex={1}
                          h="3px"
                          bg="rgba(255, 255, 255, 0.35)"
                          borderRadius="full"
                          overflow="hidden"
                        >
                          <Box
                            w={idx < activePhotoIndex ? '100%' : idx === activePhotoIndex ? '100%' : '0%'}
                            h="100%"
                            bg="white"
                            transition={idx === activePhotoIndex ? 'width 0.2s' : 'none'}
                          />
                        </Box>
                      ))}
                    </HStack>

                    {/* Split Touch Zones */}
                    <motion.div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: '30%',
                        zIndex: 8,
                        cursor: 'pointer',
                      }}
                      onTap={(e) => {
                        e.stopPropagation()
                        setActivePhotoIndex((prev) => Math.max(0, prev - 1))
                      }}
                    />
                    <motion.div
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: '70%',
                        zIndex: 8,
                        cursor: 'pointer',
                      }}
                      onTap={(e) => {
                        e.stopPropagation()
                        if (activePhotoIndex < currentProfile.images.length - 1) {
                          setActivePhotoIndex((prev) => prev + 1)
                        }
                      }}
                    />

                    {/* Image Viewport */}
                    <Image
                      src={currentProfile.images[activePhotoIndex]}
                      alt={`${currentProfile.name}`}
                      w="100%"
                      h="100%"
                      objectFit="cover"
                      draggable="false"
                      loading="lazy"
                      decoding="async"
                    />
                  </Box>

                  {/* Combined Profile Metadata Box */}
                  <Box
                    position={{ base: 'absolute', md: 'static' }}
                    bottom={{ base: 0, md: 'auto' }}
                    left={{ base: 0, md: 'auto' }}
                    right={{ base: 0, md: 'auto' }}
                    zIndex={{ base: 6, md: 'auto' }}
                    w="100%"
                    p={{ base: 5, md: 5 }}
                    pt={{ base: 12, md: 5 }}
                    bg={{ base: 'transparent', md: 'bg.surface' }}
                    bgGradient={{
                      base: 'to-t',
                      md: 'none',
                    }}
                    gradientFrom="rgba(0,0,0,0.85)"
                    gradientTo="transparent"
                    display="flex"
                    flexDirection="column"
                    userSelect="none"
                    pointerEvents="none"
                  >
                    <VStack align="start" gap={1} mb={2} pointerEvents="auto">
                      <Heading
                        as="h2"
                        fontFamily="heading"
                        fontSize={{ base: '1.5rem', md: '1.6rem' }}
                        fontWeight={700}
                        color={{ base: 'white', md: 'fg.default' }}
                        lineHeight={1.2}
                      >
                        {currentProfile.name}, {currentProfile.age}
                      </Heading>
                      <Text
                        color={{ base: 'var(--c-chocolate-light)', md: 'var(--c-chocolate)' }}
                        fontWeight="600"
                        fontSize="sm"
                      >
                        {currentProfile.major}
                      </Text>
                    </VStack>

                    <Text
                      color={{ base: 'rgba(255, 255, 255, 0.85)', md: 'fg.muted' }}
                      fontSize={{ base: 'xs', md: 'sm' }}
                      lineHeight={1.5}
                      mb={3}
                      pointerEvents="auto"
                    >
                      {currentProfile.bio}
                    </Text>

                    {/* Interest tags */}
                    <HStack gap={2} flexWrap="wrap" pointerEvents="auto">
                      {currentProfile.tags.map((tag) => (
                        <Box
                          key={tag}
                          bg={{ base: 'rgba(255, 255, 255, 0.15)', md: 'rgba(73, 98, 104, 0.08)' }}
                          color={{ base: 'white', md: 'brand.fg' }}
                          px={2.5}
                          py={0.5}
                          borderRadius="full"
                          fontSize="2xs"
                          fontWeight="600"
                        >
                          {tag}
                        </Box>
                      ))}
                    </HStack>
                  </Box>
                </Box>
              </motion.div>
            </Box>
          ) : (
            /* Pulsing Radar Search Empty State */
            <VStack justify="center" align="center" py={12} gap={6} animation="scale-in 0.4s var(--ease-out-expo)">
              <Box position="relative" w="120px" h="120px" display="flex" alignItems="center" justifyContent="center">
                <Box
                  position="absolute"
                  w="100%"
                  h="100%"
                  borderRadius="full"
                  border="2px solid var(--c-lagoon)"
                  opacity={0.3}
                  animation="pulse-dot 2s infinite"
                />
                <Box
                  position="absolute"
                  w="150%"
                  h="150%"
                  borderRadius="full"
                  border="2px solid var(--c-lagoon)"
                  opacity={0.15}
                  animation="pulse-dot 2s infinite 0.6s"
                />
                <Box
                  position="absolute"
                  w="200%"
                  h="200%"
                  borderRadius="full"
                  border="2px solid var(--c-lagoon)"
                  opacity={0.07}
                  animation="pulse-dot 2s infinite 1.2s"
                />
                {user ? (
                  <Box
                    w="70px"
                    h="70px"
                    borderRadius="full"
                    bg={user.avatar_color}
                    color="white"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    fontSize="xl"
                    fontWeight="bold"
                    boxShadow="var(--shadow-lagoon)"
                    zIndex={1}
                  >
                    {getInitials(user.nickname || user.student_id)}
                  </Box>
                ) : (
                  <Box
                    w="70px"
                    h="70px"
                    borderRadius="full"
                    bg="var(--c-chocolate)"
                    color="white"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    fontSize="xl"
                    zIndex={1}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>person</span>
                  </Box>
                )}
              </Box>
              <VStack gap={1} textAlign="center">
                <Text fontWeight="700" color="var(--c-chocolate)" fontSize="lg">
                  Finding more freshmen nearby...
                </Text>
                <Text fontSize="sm" color="fg.subtle" maxW="280px">
                  You have swiped on all available profiles. Reset the deck to browse again!
                </Text>
              </VStack>
              <Button
                type="button"
                onClick={() => {
                  setCurrentIndex(0)
                  setSwipedHistory([])
                }}
                bg="accent.solid"
                color="white"
                borderRadius="full"
                px={6}
                py={2}
                fontSize="xs"
                fontWeight="600"
                _hover={{ boxShadow: 'var(--shadow-card-hover)' }}
                minH="44px"
              >
                Reset Deck
              </Button>
            </VStack>
          )}
        </AnimatePresence>

        {/* Floating Controls Row */}
        {currentProfile && (
          <Flex
            display={{ base: 'flex', md: 'none' }}
            position="absolute"
            bottom="-16px"
            left={0}
            right={0}
            justify="center"
            gap={6}
            zIndex={10}
          >
            <ActionButton
              icon="undo"
              color="var(--c-chocolate-light)"
              iconColor="var(--c-chocolate)"
              onClick={handleRewind}
              size="md"
              label="Rewind"
              disabled={swipedHistory.length === 0 || !!matchedProfile}
            />
            <ActionButton
              icon="close"
              color="var(--c-state-liked-bg)"
              iconColor="var(--c-state-liked)"
              onClick={() => handleSwipe('left')}
              size="lg"
              label="Pass"
              disabled={!currentProfile || !!matchedProfile}
            />
            <ActionButton
              icon="favorite"
              color="var(--c-lagoon-light)"
              iconColor="var(--c-lagoon)"
              onClick={() => handleSwipe('right')}
              size="lg"
              label="Like"
              disabled={!currentProfile || !!matchedProfile}
            />
          </Flex>
        )}
      </Flex>

      {/* Swipe Action controls deck (Desktop Split Layout spacing below card) */}
      {currentProfile && (
        <Flex
          display={{ base: 'none', md: 'flex' }}
          justify="center"
          gap={5}
          mt={6}
          mb={8}
        >
          <ActionButton
            icon="undo"
            color="var(--c-chocolate-light)"
            iconColor="var(--c-chocolate)"
            onClick={handleRewind}
            size="md"
            label="Rewind"
            disabled={swipedHistory.length === 0 || !!matchedProfile}
          />
          <ActionButton
            icon="close"
            color="var(--c-state-liked-bg)"
            iconColor="var(--c-state-liked)"
            onClick={() => handleSwipe('left')}
            size="lg"
            label="Pass"
            disabled={!currentProfile || !!matchedProfile}
          />
          <ActionButton
            icon="favorite"
            color="var(--c-lagoon-light)"
            iconColor="var(--c-lagoon)"
            onClick={() => handleSwipe('right')}
            size="lg"
            label="Like"
            disabled={!currentProfile || !!matchedProfile}
          />
        </Flex>
      )}

      {/* celebratory It's a Match modal overlay */}
      {matchedProfile && !isChatOpen && (
        <Portal>
          <Flex
            position="fixed"
            inset={0}
            bg="rgba(27, 28, 28, 0.85)"
            backdropFilter="blur(16px)"
            zIndex={1100}
            align="center"
            justify="center"
            p={4}
          >
            <VStack
              gap={8}
              maxW="md"
              w="100%"
              textAlign="center"
              animation="scale-in 0.4s var(--ease-out-expo)"
            >
              {/* Confetti floats */}
              <Box position="absolute" inset={0} pointerEvents="none" overflow="hidden">
                {confetti.map((c) => (
                  <motion.div
                    key={c.id}
                    initial={{ y: -50, x: `${c.left}vw`, opacity: 1, rotate: 0 }}
                    animate={{ y: '100vh', rotate: 360, opacity: 0 }}
                    transition={{ duration: c.duration, delay: c.delay, repeat: Infinity, ease: 'linear' }}
                    style={{
                      position: 'absolute',
                      top: 0,
                      width: `${c.size}px`,
                      height: `${c.size}px`,
                      borderRadius: c.id % 2 === 0 ? '50%' : '2px',
                      backgroundColor: c.color,
                    }}
                  />
                ))}
              </Box>

              {/* Title group */}
              <VStack gap={2}>
                <Heading
                  as="h2"
                  fontFamily="heading"
                  fontSize="4xl"
                  color="white"
                  fontWeight="bold"
                  letterSpacing="0.05em"
                >
                  It's a Match!
                </Heading>
                <Text color="var(--c-chocolate-light)" fontSize="md" fontWeight="600">
                  You and {matchedProfile.name} liked each other.
                </Text>
              </VStack>

              {/* Overlapping avatar view */}
              <HStack gap={-4} justify="center" align="center" py={4} position="relative" w="100%">
                <motion.div
                  initial={{ x: -100, opacity: 0 }}
                  animate={{ x: 15, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                  style={{ zIndex: 2 }}
                >
                  <Box
                    w="110px"
                    h="110px"
                    borderRadius="full"
                    border="4px solid white"
                    bg={user?.avatar_color || 'var(--c-chocolate)'}
                    color="white"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    fontSize="3xl"
                    fontWeight="bold"
                    boxShadow="var(--shadow-lagoon)"
                  >
                    {user ? getInitials(user.nickname || user.student_id) : 'U'}
                  </Box>
                </motion.div>

                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.5 }}
                  style={{
                    zIndex: 3,
                    position: 'absolute',
                    backgroundColor: 'var(--c-chocolate)',
                    color: 'white',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid white',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>favorite</span>
                </motion.div>

                <motion.div
                  initial={{ x: 100, opacity: 0 }}
                  animate={{ x: -15, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                  style={{ zIndex: 1 }}
                >
                  <Image
                    src={matchedProfile.images[0]}
                    alt={matchedProfile.name}
                    w="110px"
                    h="110px"
                    borderRadius="full"
                    border="4px solid white"
                    objectFit="cover"
                    boxShadow="var(--shadow-lagoon)"
                  />
                </motion.div>
              </HStack>

              {/* Chat CTA buttons */}
              <VStack w="100%" gap={4} mt={4}>
                <Button
                  bg="var(--c-lagoon)"
                  color="white"
                  borderRadius="full"
                  w="100%"
                  py={6}
                  fontSize="md"
                  fontWeight="700"
                  onClick={() => setIsChatOpen(true)}
                  _hover={{ bg: '#3c5156' }}
                  minH="48px"
                >
                  Send Message
                </Button>

                <Button
                  type="button"
                  w="100%"
                  py={3}
                  bg="transparent"
                  border="1px solid"
                  borderColor="white"
                  borderRadius="full"
                  fontSize="sm"
                  fontWeight="600"
                  color="white"
                  _hover={{ bg: 'rgba(255,255,255,0.1)' }}
                  onClick={dismissMatchAndAdvance}
                  minH="44px"
                >
                  Keep Swiping
                </Button>
              </VStack>
            </VStack>
          </Flex>
        </Portal>
      )}

      {/* Slide-up Bottom Chat Drawer */}
      <AnimatePresence>
        {isChatOpen && matchedProfile && (
          <Portal>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(27, 28, 28, 0.4)',
                backdropFilter: 'blur(8px)',
                zIndex: 1200,
              }}
              onClick={dismissMatchAndAdvance}
            />

            {/* Chat Drawer Panel */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                height: '80vh',
                maxHeight: '700px',
                backgroundColor: 'white',
                borderTopLeftRadius: '32px',
                borderTopRightRadius: '32px',
                boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.15)',
                zIndex: 1201,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <Flex
                align="center"
                justify="space-between"
                px={6}
                py={4}
                borderBottom="1px solid"
                borderColor="border.subtle"
                bg="bg.surface"
              >
                <HStack gap={3}>
                  <Box position="relative">
                    <Image
                      src={matchedProfile.images[0]}
                      alt={matchedProfile.name}
                      w="48px"
                      h="48px"
                      borderRadius="full"
                      objectFit="cover"
                      border="2px solid"
                      borderColor="var(--c-lagoon)"
                    />
                    <Box
                      position="absolute"
                      bottom="1px"
                      right="1px"
                      w="12px"
                      h="12px"
                      borderRadius="full"
                      bg="#2ecc71"
                      border="2px solid white"
                    />
                  </Box>
                  <VStack align="start" gap={0}>
                    <Text fontWeight="700" color="var(--c-chocolate)" fontSize="md" lineHeight="1.2">
                      {matchedProfile.name}
                    </Text>
                    <Text fontSize="2xs" color="fg.muted" fontWeight="600">
                      {matchedProfile.major}
                    </Text>
                  </VStack>
                </HStack>
                <Button
                  type="button"
                  onClick={dismissMatchAndAdvance}
                  variant="ghost"
                  h="40px"
                  w="40px"
                  minW="40px"
                  borderRadius="full"
                  _hover={{ bg: 'bg.hero' }}
                  cursor="pointer"
                  aria-label="Close Chat"
                >
                  <span className="material-symbols-outlined">close</span>
                </Button>
              </Flex>

              {/* Chat Messages Log */}
              <Box flex={1} p={6} overflowY="auto" bg="var(--c-ivory)">
                <VStack gap={4} align="stretch">
                  <Text fontSize="2xs" color="fg.subtle" textAlign="center" fontWeight="600" py={2}>
                    Match created on {new Date().toLocaleDateString()}
                  </Text>
                  
                  {chatMessages.map((msg) => (
                    <Flex
                      key={msg.id}
                      justify={msg.sender === 'user' ? 'flex-end' : 'flex-start'}
                    >
                      <Box
                        maxW="70%"
                        bg={msg.sender === 'user' ? 'var(--c-lagoon)' : 'white'}
                        color={msg.sender === 'user' ? 'white' : 'var(--c-ink)'}
                        px={4}
                        py={2.5}
                        borderRadius="2xl"
                        borderTopRightRadius={msg.sender === 'user' ? '4px' : '2xl'}
                        borderTopLeftRadius={msg.sender === 'match' ? '4px' : '2xl'}
                        boxShadow="var(--shadow-ambient)"
                        border="1px solid"
                        borderColor={msg.sender === 'user' ? 'var(--c-lagoon)' : 'border.subtle'}
                      >
                        <Text fontSize="sm" lineHeight={1.5}>
                          {msg.text}
                        </Text>
                        <Text
                          fontSize="3xs"
                          textAlign="right"
                          mt={1}
                          color={msg.sender === 'user' ? 'rgba(255,255,255,0.7)' : 'fg.subtle'}
                        >
                          {msg.timestamp}
                        </Text>
                      </Box>
                    </Flex>
                  ))}
                  
                  {isTyping && (
                    <Flex justify="flex-start">
                      <Box
                        bg="white"
                        px={4}
                        py={3}
                        borderRadius="2xl"
                        borderTopLeftRadius="4px"
                        boxShadow="var(--shadow-ambient)"
                        border="1px solid"
                        borderColor="border.subtle"
                      >
                        <HStack gap={1.5}>
                          <Box w="6px" h="6px" borderRadius="full" bg="fg.subtle" style={{ animation: 'breath 1s infinite' }} />
                          <Box w="6px" h="6px" borderRadius="full" bg="fg.subtle" style={{ animation: 'breath 1s infinite 0.2s' }} />
                          <Box w="6px" h="6px" borderRadius="full" bg="fg.subtle" style={{ animation: 'breath 1s infinite 0.4s' }} />
                        </HStack>
                      </Box>
                    </Flex>
                  )}
                  <div ref={messagesEndRef} />
                </VStack>
              </Box>

              {/* Chat Input Footer */}
              <Box p={4} borderTop="1px solid" borderColor="border.subtle" bg="bg.surface">
                <HStack gap={3}>
                  <Input
                    placeholder={`Message ${matchedProfile.name}...`}
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendMessage()
                    }}
                    disabled={isTyping}
                    h="44px"
                    borderRadius="xl"
                    border="1.5px solid var(--c-outline)"
                    bg="var(--c-ivory)"
                    _focus={{ borderColor: 'var(--c-lagoon)', bg: 'white' }}
                  />
                  <Button
                    type="button"
                    onClick={handleSendMessage}
                    bg="var(--c-lagoon)"
                    color="white"
                    h="44px"
                    px={5}
                    borderRadius="xl"
                    cursor="pointer"
                    _hover={{ bg: '#3c5156' }}
                    disabled={!chatMessage.trim() || isTyping}
                    aria-label="Send"
                  >
                    <span className="material-symbols-outlined">send</span>
                  </Button>
                </HStack>
              </Box>
            </motion.div>
          </Portal>
        )}
      </AnimatePresence>
    </Box>
  )
}

interface ActionButtonProps {
  icon: string
  color: string
  iconColor: string
  onClick: () => void
  size: 'md' | 'lg'
  label: string
  disabled?: boolean
}

function ActionButton({
  icon,
  color,
  iconColor,
  onClick,
  size,
  label,
  disabled = false,
}: ActionButtonProps) {
  const dimension = size === 'lg' ? { base: 14, md: 16 } : { base: 11, md: 12 }
  const iconSize = size === 'lg' ? '2xl' : 'xl'

  return (
    <Button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      w={dimension}
      h={dimension}
      minW={dimension}
      borderRadius="full"
      bg={disabled ? 'bg.disabled' : color}
      color={disabled ? 'fg.disabled' : iconColor}
      border="1px solid"
      borderColor={disabled ? 'border.subtle' : 'transparent'}
      boxShadow={disabled ? 'none' : 'var(--shadow-ambient)'}
      cursor={disabled ? 'not-allowed' : 'pointer'}
      transition="all 0.2s var(--ease-out-quart)"
      _hover={
        disabled
          ? {}
          : {
              transform: 'scale(1.1)',
              boxShadow: 'var(--shadow-card-hover)',
            }
      }
      _active={disabled ? {} : { transform: 'scale(0.95)' }}
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={0}
    >
      <span className="material-symbols-outlined" style={{ fontSize: iconSize }}>
        {icon}
      </span>
    </Button>
  )
}
