import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Container,
  Heading,
  Input,
  Text,
  VStack,
  HStack,
  Spinner,
} from '@chakra-ui/react'
import { FacultySelect } from '../components/FacultySelect'
import { SearchableSelect } from '../components/SearchableSelect'
import { useUser } from '../context/UserContext'
import { toaster } from '../components/ui/toaster'
import { STAFF_ROLES, FACULTIES } from '../lib/constants'

const PRESET_COLORS = [
  "var(--c-lagoon)",
  "var(--chakra-colors-accent-solid)",
  "var(--c-warm-muted)",
  "var(--c-light-cocoa)",
  "var(--c-sage-slate)",
  "var(--c-warm-ochre)",
]

export function ProfileSetupPage() {
  const navigate = useNavigate()
  const { user, updateProfile } = useUser()
  const isStaff = user?.role && user.role !== 'student'

  // Initialize state directly from user context
  const [nickname, setNickname] = useState(user?.nickname || '')
  
  const userFac = user?.faculty || "";
  const isKnown =
    userFac === "" ||
    FACULTIES.some(
      (f) =>
        f.short.toLowerCase() === userFac.toLowerCase() ||
        f.en.toLowerCase() === userFac.toLowerCase() ||
        f.th.toLowerCase() === userFac.toLowerCase()
    );
  const [faculty, setFaculty] = useState(isKnown ? userFac : "OTHER");
  const [customFaculty, setCustomFaculty] = useState(isKnown ? "" : userFac);
  
  const [major, setMajor] = useState(user?.major || '')
  const [housePosition, setHousePosition] = useState(user?.house_position || '')
  const [ig, setIg] = useState(user?.ig || '')
  const [avatarColor, setAvatarColor] = useState(user?.avatar_color || PRESET_COLORS[0])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!user) {
      navigate('/login')
    }
  }, [user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!nickname.trim() || !faculty.trim() || (faculty === "OTHER" && !customFaculty.trim())) {
      toaster.create({
        title: 'Required Fields Missing',
        description: 'Please provide both your nickname and faculty.',
        type: 'error',
      })
      return
    }

    if (isStaff && !housePosition.trim()) {
      toaster.create({
        title: 'Staff Position Required',
        description: 'Please select your staff position.',
        type: 'error',
      })
      return
    }

    setSubmitting(true)
    const success = await updateProfile({
      nickname: nickname.trim(),
      faculty: faculty === "OTHER" ? customFaculty.trim() : faculty.trim(),
      major: major.trim(),
      housePosition: housePosition.trim(),
      ig: ig.trim(),
      avatarColor,
    })
    setSubmitting(false)

    if (success) {
      toaster.create({
        title: 'Profile Saved!',
        description: 'Welcome to the Baan 7 community.',
        type: 'success',
      })
      navigate('/')
    } else {
      toaster.create({
        title: 'Update failed',
        description: 'Failed to update profile values. Check connection.',
        type: 'error',
      })
    }
  }

  return (
    <Box
      minH="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      py={{ base: 8, md: 16 }}
      px={4}
      bg="var(--c-ivory)"
    >
      <Container maxW="md">
        <Box
          as="form"
          onSubmit={handleSubmit}
          bg="var(--c-white)"
          p={{ base: 6, md: 10 }}
          borderRadius="2xl"
          border="1px solid"
          borderColor="gray.200"
          boxShadow="0 4px 20px -2px rgba(57, 66, 91, 0.05)"
          animation="fade-in 0.3s ease-out"
        >
          <VStack align="stretch" gap={8}>
            <VStack align="flex-start" gap={1.5}>
              <Heading
                as="h1"
                fontSize="2xl"
                color="var(--c-lagoon)"
                fontWeight="700"
                letterSpacing="-0.02em"
              >
                Complete your profile
              </Heading>
              <Text color="gray.600" fontSize="sm">
                Set up your orientation identity before you join the board.
              </Text>
            </VStack>

            <VStack align="stretch" gap={5}>
              {/* Nickname */}
              <VStack align="stretch" gap={2}>
                <Box fontSize="sm" fontWeight="600" color="var(--c-lagoon)">
                  <label htmlFor="setup-nickname">
                    Nickname <Box as="span" color="var(--c-error)">*</Box>
                  </label>
                </Box>
                <Input
                  id="setup-nickname"
                  placeholder="e.g. billy"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="gray.300"
                  bg="transparent"
                  _focus={{
                    borderColor: 'var(--c-lagoon)',
                    boxShadow: '0 0 0 1px var(--c-lagoon)',
                  }}
                  h="44px"
                  fontSize="md"
                  required
                />
              </VStack>

              {/* Faculty Dropdown */}
              <VStack align="stretch" gap={2}>
                <Box fontSize="sm" fontWeight="600" color="var(--c-lagoon)">
                  <label htmlFor="setup-faculty">
                    Faculty <Box as="span" color="var(--c-error)">*</Box>
                  </label>
                </Box>
                <FacultySelect
                  value={faculty}
                  onChange={(val) => {
                    setFaculty(val)
                    if (val !== "OTHER") setCustomFaculty("")
                  }}
                />
                {faculty === "OTHER" && (
                  <Input
                    placeholder="Type your faculty..."
                    value={customFaculty}
                    onChange={(e) => setCustomFaculty(e.target.value)}
                    borderRadius="lg"
                    border="1px solid"
                    borderColor="gray.300"
                    bg="transparent"
                    _focus={{
                      borderColor: 'var(--c-lagoon)',
                      boxShadow: '0 0 0 1px var(--c-lagoon)',
                    }}
                    h="44px"
                    fontSize="md"
                    mt={1}
                  />
                )}
              </VStack>

              {/* Staff Position (for Staff/Moderators) */}
              {isStaff && (
                <VStack align="stretch" gap={2}>
                  <Box fontSize="sm" fontWeight="600" color="var(--c-lagoon)">
                    <label htmlFor="setup-house-position">
                      Staff Position <Box as="span" color="var(--c-error)">*</Box>
                    </label>
                  </Box>
                  <SearchableSelect
                    id="setup-house-position"
                    value={housePosition}
                    onChange={(val) => setHousePosition(val)}
                    options={STAFF_ROLES.map((role) => ({
                      value: role,
                      primaryText: role,
                    }))}
                    placeholder="Select Position..."
                    searchPlaceholder="Type to search..."
                  />
                </VStack>
              )}

              {/* Major (Field of Study) */}
              <VStack align="stretch" gap={2}>
                <Box fontSize="sm" fontWeight="600" color="var(--c-lagoon)">
                  <label htmlFor="setup-major">
                    Major (Field of Study){' '}
                    <Text as="span" color="gray.500" fontSize="xs" fontWeight="normal">
                      (Optional)
                    </Text>
                  </label>
                </Box>
                <Input
                  id="setup-major"
                  placeholder="e.g. Computer Science"
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="gray.300"
                  bg="transparent"
                  _focus={{
                    borderColor: 'var(--c-lagoon)',
                    boxShadow: '0 0 0 1px var(--c-lagoon)',
                  }}
                  h="44px"
                  fontSize="md"
                />
              </VStack>

              {/* Instagram Account */}
              <VStack align="stretch" gap={2}>
                <Box fontSize="sm" fontWeight="600" color="var(--c-lagoon)">
                  <label htmlFor="setup-ig">
                    Instagram Account{' '}
                    <Text as="span" color="gray.500" fontSize="xs" fontWeight="normal">
                      (Optional)
                    </Text>
                  </label>
                </Box>
                <Input
                  id="setup-ig"
                  placeholder="e.g. chula.freshman"
                  value={ig}
                  onChange={(e) => setIg(e.target.value)}
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="gray.300"
                  bg="transparent"
                  _focus={{
                    borderColor: 'var(--c-lagoon)',
                    boxShadow: '0 0 0 1px var(--c-lagoon)',
                  }}
                  h="44px"
                  fontSize="md"
                />
              </VStack>

              {/* Avatar Color Choice */}
              <VStack align="stretch" gap={3} pt={2}>
                <Box fontSize="sm" fontWeight="600" color="var(--c-lagoon)">
                  Avatar Background Color
                </Box>
                <HStack gap={3}>
                  {PRESET_COLORS.map((c) => (
                    <Button
                      key={c}
                      type="button"
                      aria-label={`Select color ${c}`}
                      w="36px"
                      h="36px"
                      minW="36px"
                      borderRadius="full"
                      bg={c}
                      cursor="pointer"
                      border={avatarColor === c ? '2.5px solid var(--c-lagoon)' : '1px solid rgba(0,0,0,0.1)'}
                      transform={avatarColor === c ? 'scale(1.15)' : 'none'}
                      transition="all 0.2s ease"
                      _hover={{ transform: 'scale(1.15)', bg: c }}
                      _active={{ bg: c }}
                      onClick={() => setAvatarColor(c)}
                      p={0}
                    />
                  ))}
                </HStack>
              </VStack>
            </VStack>

            <Button
              type="submit"
              bg="var(--c-lagoon)"
              color="white"
              borderRadius="lg"
              h="48px"
              fontSize="md"
              fontWeight="600"
              _hover={{
                bg: '#2d3446',
              }}
              _active={{ transform: 'translateY(1px)' }}
              transition="all 0.15s ease-out"
              disabled={submitting}
              w="100%"
              mt={4}
            >
              {submitting ? <Spinner size="sm" color="white" /> : 'Save Profile'}
            </Button>
          </VStack>
        </Box>
      </Container>
    </Box>
  )
}
