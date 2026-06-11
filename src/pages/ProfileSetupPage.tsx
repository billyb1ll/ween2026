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
} from '@chakra-ui/react'
import { useUser } from '../context/UserContext'
import { toaster } from '../components/ui/toaster'

const PRESET_COLORS = [
  '#496268', // Lagoon
  '#7c563f', // Chocolate
  '#8c7b74', // Warm Muted Brown
  '#9d806c', // Light Cocoa
  '#5b6c6b', // Sage Slate
  '#a38c75', // Warm Ochre
]

const THAI_FACULTIES = [
  'วิศวกรรมศาสตร์ (Engineering)',
  'วิทยาศาสตร์ (Science)',
  'อักษรศาสตร์ (Arts)',
  'รัฐศาสตร์ (Political Science)',
  'พาณิชยศาสตร์และการบัญชี (Business/Accounting)',
  'สถาปัตยกรรมศาสตร์ (Architecture)',
  'ศิลปกรรมศาสตร์ (Fine Arts)',
  'นิเทศศาสตร์ (Communication Arts)',
  'เศรษฐศาสตร์ (Economics)',
  'นิติศาสตร์ (Law)',
  'เวชศาสตร์ / แพทยศาสตร์ (Medicine)',
  'สัตวแพทยศาสตร์ (Veterinary Science)',
  'ทันตแพทยศาสตร์ (Dentistry)',
  'เภสัชศาสตร์ (Pharmaceutical Sciences)',
  'ครุศาสตร์ (Education)',
  'พยาบาลศาสตร์ (Nursing)',
  'สหเวชศาสตร์ (Allied Health Sciences)',
  'จิตวิทยา (Psychology)',
]

export function ProfileSetupPage() {
  const navigate = useNavigate()
  const { user, updateProfile } = useUser()

  // Initialize state directly from user context to avoid useEffect cascade renders
  const [nickname, setNickname] = useState(user?.nickname || '')
  const [faculty, setFaculty] = useState(user?.faculty || '')
  const [major, setMajor] = useState(user?.major || '')
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

    if (!nickname.trim() || !faculty.trim()) {
      toaster.create({
        title: 'Nickname and Faculty are required',
        type: 'error',
      })
      return
    }

    setSubmitting(true)
    const success = await updateProfile({
      nickname: nickname.trim(),
      faculty: faculty.trim(),
      major: major.trim(),
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
      minH="90vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      py={{ base: 6, md: 12 }}
      px={4}
      position="relative"
    >
      <Container maxW="md">
        <Box
          bg="var(--c-white)"
          border="1px solid"
          borderColor="border.subtle"
          borderRadius="2xl"
          p={{ base: 5, md: 8 }}
          boxShadow="var(--shadow-lagoon)"
          animation="scale-in 0.4s var(--ease-out-quart)"
        >
          <VStack align="stretch" gap={6} as="form" onSubmit={handleSubmit}>
            <VStack align="center" textAlign="center" gap={1}>
              <Heading
                as="h1"
                fontSize="2xl"
                color="var(--c-chocolate)"
                fontFamily="'Playfair Display', serif"
                fontWeight="700"
              >
                Complete Profile
              </Heading>
              <Text color="var(--c-muted)" fontSize="sm">
                Set up your orientation identity. Let's make connections!
              </Text>
            </VStack>

            <VStack align="stretch" gap={4}>
              {/* Nickname */}
              <VStack align="stretch" gap={1.5}>
                <Box
                  fontSize="xs"
                  fontWeight="700"
                  color="var(--c-chocolate)"
                  textTransform="uppercase"
                  letterSpacing="0.05em"
                >
                  <label htmlFor="setup-nickname">Nickname (ชื่อเล่น) <Box as="span" color="var(--c-error)">*</Box></label>
                </Box>
                <Input
                  id="setup-nickname"
                  placeholder="e.g. บิล"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  borderRadius="xl"
                  border="1.5px solid var(--c-outline)"
                  bg="var(--c-ivory)"
                  _focus={{
                    borderColor: 'var(--c-lagoon)',
                    boxShadow: '0 0 0 3px var(--c-lagoon-light)',
                    bg: 'var(--c-white)',
                  }}
                  h="48px"
                  fontSize="sm"
                  required
                />
              </VStack>

              {/* Faculty Dropdown/Input */}
              <VStack align="stretch" gap={1.5}>
                <Box
                  fontSize="xs"
                  fontWeight="700"
                  color="var(--c-chocolate)"
                  textTransform="uppercase"
                  letterSpacing="0.05em"
                >
                  <label htmlFor="setup-faculty">Faculty (คณะ) <Box as="span" color="var(--c-error)">*</Box></label>
                </Box>
                <Input
                  id="setup-faculty"
                  placeholder="e.g. วิศวกรรมศาสตร์"
                  list="faculties-list"
                  value={faculty}
                  onChange={(e) => setFaculty(e.target.value)}
                  borderRadius="xl"
                  border="1.5px solid var(--c-outline)"
                  bg="var(--c-ivory)"
                  _focus={{
                    borderColor: 'var(--c-lagoon)',
                    boxShadow: '0 0 0 3px var(--c-lagoon-light)',
                    bg: 'var(--c-white)',
                  }}
                  h="48px"
                  fontSize="sm"
                  required
                />
                <datalist id="faculties-list">
                  {THAI_FACULTIES.map((fac) => (
                    <option key={fac} value={fac.split(' (')[0]} />
                  ))}
                </datalist>
              </VStack>

              {/* Major */}
              <VStack align="stretch" gap={1.5}>
                <Box
                  fontSize="xs"
                  fontWeight="700"
                  color="var(--c-chocolate)"
                  textTransform="uppercase"
                  letterSpacing="0.05em"
                >
                  <label htmlFor="setup-major">Major (สาขา) <Text as="span" color="var(--c-outline)" fontSize="2xs" fontWeight="normal">(Optional)</Text></label>
                </Box>
                <Input
                  id="setup-major"
                  placeholder="e.g. วิทยาการคอมพิวเตอร์"
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  borderRadius="xl"
                  border="1.5px solid var(--c-outline)"
                  bg="var(--c-ivory)"
                  _focus={{
                    borderColor: 'var(--c-lagoon)',
                    boxShadow: '0 0 0 3px var(--c-lagoon-light)',
                    bg: 'var(--c-white)',
                  }}
                  h="48px"
                  fontSize="sm"
                />
              </VStack>

              {/* Instagram Account */}
              <VStack align="stretch" gap={1.5}>
                <Box
                  fontSize="xs"
                  fontWeight="700"
                  color="var(--c-chocolate)"
                  textTransform="uppercase"
                  letterSpacing="0.05em"
                >
                  <label htmlFor="setup-ig">Instagram Account (IG) <Text as="span" color="var(--c-outline)" fontSize="2xs" fontWeight="normal">(Optional)</Text></label>
                </Box>
                <Input
                  id="setup-ig"
                  placeholder="e.g. chula.freshman"
                  value={ig}
                  onChange={(e) => setIg(e.target.value)}
                  borderRadius="xl"
                  border="1.5px solid var(--c-outline)"
                  bg="var(--c-ivory)"
                  _focus={{
                    borderColor: 'var(--c-lagoon)',
                    boxShadow: '0 0 0 3px var(--c-lagoon-light)',
                    bg: 'var(--c-white)',
                  }}
                  h="48px"
                  fontSize="sm"
                />
              </VStack>

              {/* Avatar Color Choice */}
              <VStack align="stretch" gap={2}>
                <Text fontSize="xs" fontWeight="700" color="var(--c-chocolate)" textTransform="uppercase" letterSpacing="0.05em">
                  Avatar Background Color
                </Text>
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
                      border={avatarColor === c ? '2.5px solid var(--c-chocolate)' : '1px solid rgba(0,0,0,0.1)'}
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
              borderRadius="xl"
              h="50px"
              fontSize="md"
              fontWeight="700"
              boxShadow="0 4px 12px rgba(73, 98, 104, 0.2)"
              _hover={{
                bg: '#3c5156',
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 16px rgba(73, 98, 104, 0.3)',
              }}
              _active={{ transform: 'translateY(0)' }}
              transition="all 0.2s var(--ease-out-quart)"
              loading={submitting}
              w="100%"
            >
              Save & Start Exploring
            </Button>
          </VStack>
        </Box>
      </Container>
    </Box>
  )
}
