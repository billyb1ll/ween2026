import { Box, Flex, HStack, Text, Button, VStack, Portal } from '@chakra-ui/react'
import { NavLink, Link } from 'react-router-dom'
import { type ReactNode, useState, useEffect, useRef, useCallback } from 'react'
import { getImmichConfig } from '../utils/immich'
import { toaster } from './ui/toaster'
import { useUser } from '../context/UserContext'
import type { User } from '../context/UserContext'
import { motion, useReducedMotion } from 'framer-motion'

interface NavItemProps {
  to: string
  children: ReactNode
  icon?: string
}

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function NavItem({ to, children, icon }: NavItemProps) {
  const isGallery = to === '/gallery'
  const immich = getImmichConfig()

  const handleClick = (e: React.MouseEvent) => {
    if (isGallery) {
      if (!immich.isConfigured || !immich.url) {
        e.preventDefault()
        toaster.create({
          title: "Gallery Warming Up",
          description: "Baan 7 Photo Gallery is currently warming up! Check back soon once the event kicks off. 📸",
          type: "info",
          closable: true,
          duration: 5000,
        })
      }
    }
  }

  const navContent = (isActive: boolean) => (
    <Flex
      align="center"
      gap={1}
      px={{ base: 3, md: 4 }}
      py={2}
      borderRadius="full"
      fontSize="sm"
      fontWeight="600"
      letterSpacing="0.05em"
      transition="all 0.3s var(--ease-out-quart)"
      bg={isActive ? 'rgba(var(--c-white-rgb), 0.5)' : 'transparent'}
      color={isActive ? 'accent.solid' : 'fg.subtle'}
      boxShadow={isActive ? 'var(--shadow-ambient)' : 'none'}
      _hover={{
        color: 'accent.solid',
      }}
      position="relative"
    >
      {icon && (
        <Box
          as="span"
          display={{ base: 'block', md: 'none' }}
          className="material-symbols-outlined"
          fontSize="xl"
        >
          {icon}
        </Box>
      )}
      <Text display={{ base: 'none', md: 'block' }}>{children}</Text>
    </Flex>
  )

  if (isGallery && immich.isConfigured && immich.url) {
    return (
      <a
        href={immich.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {navContent(false)}
      </a>
    )
  }

  return (
    <NavLink to={to} onClick={handleClick}>
      {({ isActive }) => navContent(isActive)}
    </NavLink>
  )
}

interface UserDropdownContentProps {
  user: User | null
  logout: () => void
  onClose: () => void
}

const UserDropdownContent = ({ user, logout, onClose }: UserDropdownContentProps) => (
  <VStack align="stretch" gap={3}>
    <Box>
      <Text fontWeight="700" color="var(--c-chocolate)" fontSize="sm">
        {user?.nickname || 'Student'}
      </Text>
      <Text fontSize="xs" color="var(--c-muted)">
        {user?.faculty || user?.major || 'Unassigned'}
      </Text>
      <Text fontSize="2xs" color="var(--c-outline)">
        ID: {user?.student_id}
      </Text>
    </Box>
    <Box h="1px" bg="var(--c-lagoon-light)" />
    {user && user.role !== 'student' && (
      <Link to="/admin" onClick={onClose} style={{ width: '100%' }}>
        <Button
          size="sm"
          variant="ghost"
          color="var(--c-chocolate)"
          justifyContent="start"
          px={2}
          h="32px"
          w="100%"
          borderRadius="8px"
          _hover={{ bg: 'rgba(73, 98, 104, 0.05)', color: 'var(--c-chocolate)' }}
        >
          Admin Dashboard
        </Button>
      </Link>
    )}
    <Button
      size="sm"
      variant="ghost"
      color="var(--c-error)"
      justifyContent="start"
      px={2}
      h="32px"
      borderRadius="8px"
      _hover={{ bg: 'rgba(var(--c-error-rgb), 0.05)' }}
      onClick={() => {
        logout()
        onClose()
      }}
    >
      Log Out
    </Button>
  </VStack>
)

export function Navbar() {
  const { user, logout } = useUser()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false)
  const desktopDropdownRef = useRef<HTMLDivElement>(null)
  const mobileDropdownRef = useRef<HTMLDivElement>(null)
  const desktopPortalRef = useRef<HTMLDivElement>(null)
  const mobilePortalRef = useRef<HTMLDivElement>(null)

  const [desktopCoords, setDesktopCoords] = useState<{ top: number; right: number } | null>(null)
  const [mobileCoords, setMobileCoords] = useState<{ top: number; right: number } | null>(null)

  const updateDesktopCoords = useCallback(() => {
    if (desktopDropdownRef.current) {
      const rect = desktopDropdownRef.current.getBoundingClientRect()
      setDesktopCoords({
        top: rect.bottom + 8,
        right: Math.max(16, window.innerWidth - rect.right),
      })
    }
  }, [])

  const updateMobileCoords = useCallback(() => {
    if (mobileDropdownRef.current) {
      const rect = mobileDropdownRef.current.getBoundingClientRect()
      setMobileCoords({
        top: rect.bottom + 8,
        right: Math.max(16, window.innerWidth - rect.right),
      })
    }
  }, [])

  useEffect(() => {
    if (dropdownOpen) {
      updateDesktopCoords()
      window.addEventListener('resize', updateDesktopCoords)
      window.addEventListener('scroll', updateDesktopCoords, true)
      return () => {
        window.removeEventListener('resize', updateDesktopCoords)
        window.removeEventListener('scroll', updateDesktopCoords, true)
      }
    }
  }, [dropdownOpen, updateDesktopCoords])

  useEffect(() => {
    if (mobileDropdownOpen) {
      updateMobileCoords()
      window.addEventListener('resize', updateMobileCoords)
      window.addEventListener('scroll', updateMobileCoords, true)
      return () => {
        window.removeEventListener('resize', updateMobileCoords)
        window.removeEventListener('scroll', updateMobileCoords, true)
      }
    }
  }, [mobileDropdownOpen, updateMobileCoords])

  // Close dropdown on Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setDropdownOpen(false)
      setMobileDropdownOpen(false)
    }
  }, [])

  // Close dropdown on outside click (exclude portal content)
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    const target = e.target as Node
    const inDesktopTrigger = desktopDropdownRef.current?.contains(target)
    const inDesktopPortal = desktopPortalRef.current?.contains(target)
    if (!inDesktopTrigger && !inDesktopPortal) {
      setDropdownOpen(false)
    }
    const inMobileTrigger = mobileDropdownRef.current?.contains(target)
    const inMobilePortal = mobilePortalRef.current?.contains(target)
    if (!inMobileTrigger && !inMobilePortal) {
      setMobileDropdownOpen(false)
    }
  }, [])

  useEffect(() => {
    if (dropdownOpen || mobileDropdownOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.addEventListener('mousedown', handleOutsideClick)
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
        document.removeEventListener('mousedown', handleOutsideClick)
      }
    }
  }, [dropdownOpen, mobileDropdownOpen, handleKeyDown, handleOutsideClick])



  return (
    <>
      {/* Desktop: Sticky top bar */}
      <Box
        display={{ base: 'none', md: 'block' }}
        position="fixed"
        top={6}
        left="50%"
        transform="translateX(-50%)"
        zIndex={50}
        w="auto"
        maxW="2xl"
      >
        <Flex
          as="nav"
          aria-label="Main navigation"
          align="center"
          bg="rgba(var(--c-ivory-rgb), 0.85)"
          backdropFilter="blur(24px)"
          borderRadius="full"
          px={6}
          py={3}
          border="1px solid"
          borderColor="border.subtle"
          boxShadow="var(--shadow-ambient)"
          gap={2}
        >
          <NavLink to="/">
            <Text
              fontFamily="heading"
              color="accent.solid"
              fontSize="xl"
              fontWeight="700"
              letterSpacing="0.1em"
              mr={8}
              transition="opacity 0.2s"
              _hover={{ opacity: 0.8 }}
            >
              Baan 7
            </Text>
          </NavLink>

          <HStack gap={1}>
            <NavItem to="/">Home</NavItem>
            <NavItem to="/vibe-check">Vibe Check</NavItem>
            <NavItem to="/board">Board</NavItem>
            <NavItem to="/gallery">Gallery</NavItem>
          </HStack>

          {user ? (
            <Box ml={6} position="relative" ref={desktopDropdownRef}>
              <Button
                type="button"
                aria-label="User menu"
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
                w="40px"
                h="40px"
                minW="40px"
                p={0}
                borderRadius="full"
                bg={user.avatar_color}
                color="white"
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontWeight="700"
                fontSize="sm"
                cursor="pointer"
                boxShadow="var(--shadow-ambient)"
                transition="all 0.2s"
                _hover={{ transform: 'scale(1.05)' }}
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                {getInitials(user.nickname || user.student_id)}
              </Button>

              {dropdownOpen && desktopCoords && (
                <Portal>
                  <Box
                    ref={desktopPortalRef}
                    position="fixed"
                    top={`${desktopCoords.top}px`}
                    right={`${desktopCoords.right}px`}
                    bg="var(--c-white)"
                    border="1px solid"
                    borderColor="border.subtle"
                    boxShadow="var(--shadow-lagoon)"
                    borderRadius="16px"
                    p={4}
                    minW="200px"
                    zIndex={1000}
                    animation="scale-in 0.2s var(--ease-out-quart)"
                    role="menu"
                  >
                    <UserDropdownContent user={user} logout={logout} onClose={() => setDropdownOpen(false)} />
                  </Box>
                </Portal>
              )}
            </Box>
          ) : (
            <Box ml={6}>
              <NavLink to="/login">
                <Box
                  as="span"
                  display="inline-flex"
                  alignItems="center"
                  fontSize="sm"
                  fontWeight="600"
                  letterSpacing="0.05em"
                  color="white"
                  bg="accent.solid"
                  px={6}
                  py={2.5}
                  borderRadius="full"
                  transition="all 0.3s var(--ease-out-quart)"
                  boxShadow="0 4px 14px rgba(124, 86, 63, 0.2)"
                  _hover={{
                    transform: 'translateY(-1px)',
                    boxShadow: '0 6px 20px rgba(124, 86, 63, 0.3)',
                  }}
                  _active={{ transform: 'scale(0.97)' }}
                >
                  Join Now
                </Box>
              </NavLink>
            </Box>
          )}
        </Flex>
      </Box>

      {/* Mobile: Dock bottom bar */}
      <Box
        display={{ base: 'block', md: 'none' }}
        position="fixed"
        bottom={0}
        left={0}
        right={0}
        zIndex={50}
        pb="env(safe-area-inset-bottom)"
        bg="rgba(var(--c-ivory-rgb), 0.92)"
        backdropFilter="blur(20px)"
        borderTop="1px solid"
        borderColor="border.subtle"
      >
        <Flex
          as="nav"
          aria-label="Mobile navigation"
          justify="space-around"
          align="center"
          py={2}
          maxW="md"
          mx="auto"
        >
          <MobileDockItem to="/" icon="home" label="Home" />
          <MobileDockItem to="/vibe-check" icon="mood" label="Vibe" />
          <MobileDockItem to="/board" icon="campaign" label="Board" />
          <MobileDockItem to="/gallery" icon="photo_library" label="Gallery" />
        </Flex>
      </Box>

      {/* Mobile top bar with brand */}
      <Box
        display={{ base: 'block', md: 'none' }}
        position="sticky"
        top={0}
        zIndex={40}
        bg="rgba(var(--c-ivory-rgb), 0.92)"
        backdropFilter="blur(12px)"
        borderBottom="1px solid"
        borderColor="border.subtle"
      >
        <Flex align="center" justify="space-between" px={5} py={3}>
          <NavLink to="/">
            <Text
              fontFamily="heading"
              color="accent.solid"
              fontSize="lg"
              fontWeight="700"
              letterSpacing="0.1em"
            >
              Baan 7
            </Text>
          </NavLink>

          {user ? (
            <Box position="relative" ref={mobileDropdownRef}>
              <Button
                type="button"
                aria-label="User menu"
                aria-expanded={mobileDropdownOpen}
                aria-haspopup="true"
                w="44px"
                h="44px"
                minW="44px"
                p={0}
                borderRadius="full"
                bg={user.avatar_color}
                color="white"
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontWeight="700"
                fontSize="sm"
                cursor="pointer"
                boxShadow="var(--shadow-ambient)"
                transition="all 0.2s"
                _hover={{ transform: 'scale(1.05)' }}
                onClick={() => setMobileDropdownOpen(!mobileDropdownOpen)}
              >
                {getInitials(user.nickname || user.student_id)}
              </Button>

              {mobileDropdownOpen && mobileCoords && (
                <Portal>
                  <Box
                    ref={mobilePortalRef}
                    position="fixed"
                    top={`${mobileCoords.top}px`}
                    right={`${mobileCoords.right}px`}
                    bg="var(--c-white)"
                    border="1px solid"
                    borderColor="border.subtle"
                    boxShadow="var(--shadow-lagoon)"
                    borderRadius="16px"
                    p={4}
                    minW="180px"
                    zIndex={1000}
                    animation="scale-in 0.2s var(--ease-out-quart)"
                    role="menu"
                  >
                    <UserDropdownContent user={user} logout={logout} onClose={() => setMobileDropdownOpen(false)} />
                  </Box>
                </Portal>
              )}
            </Box>
          ) : (
            <NavLink to="/login">
              <Box
                className="material-symbols-outlined"
                color="fg.subtle"
                fontSize="xl"
                w="44px"
                h="44px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                borderRadius="full"
                bg="bg.hero"
                transition="background 0.2s"
                _hover={{ bg: 'bg.elevated' }}
              >
                person
              </Box>
            </NavLink>
          )}
        </Flex>
      </Box>
    </>
  )
}

function MobileDockItem({ to, icon, label }: { to: string; icon: string; label: string }) {
  const isGallery = to === '/gallery'
  const immich = getImmichConfig()
  const shouldReduceMotion = useReducedMotion() ?? false

  const handleClick = (e: React.MouseEvent) => {
    if (isGallery) {
      if (!immich.isConfigured || !immich.url) {
        e.preventDefault()
        toaster.create({
          title: "Gallery Warming Up",
          description: "Baan 7 Photo Gallery is currently warming up! Check back soon once the event kicks off. 📸",
          type: "info",
          closable: true,
          duration: 5000,
        })
      }
    }
  }

  const dockContent = (isActive: boolean) => (
    <Flex
      direction="column"
      align="center"
      gap={0.5}
      px={4}
      py={1}
      borderRadius="xl"
      transition="all 0.2s"
      color={isActive ? 'accent.solid' : 'fg.subtle'}
      bg="transparent"
      /* Touch target: min 44x44 */
      minW="44px"
      minH="44px"
      justifyContent="center"
      position="relative"
    >
      {isActive && (
        <motion.div
          layoutId="activeGlow"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'var(--chakra-colors-accent-subtle)',
            borderRadius: '12px',
            zIndex: 0,
          }}
          transition={shouldReduceMotion ? { duration: 0.1 } : {
            type: "spring",
            stiffness: 380,
            damping: 30,
          }}
        />
      )}
      <VStack align="center" gap={0.5} zIndex={1} position="relative">
        <motion.div
          animate={isActive && !shouldReduceMotion ? { scale: [1, 1.25, 1] } : { scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Box
            className="material-symbols-outlined"
            fontSize="xl"
            fontVariationSettings={isActive ? "'FILL' 1" : undefined}
          >
            {icon}
          </Box>
        </motion.div>
        <Text fontSize="2xs" fontWeight="600">{label}</Text>
      </VStack>
    </Flex>
  )

  if (isGallery && immich.isConfigured && immich.url) {
    return (
      <a
        href={immich.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {dockContent(false)}
      </a>
    )
  }

  return (
    <NavLink to={to} onClick={handleClick}>
      {({ isActive }) => dockContent(isActive)}
    </NavLink>
  )
}
