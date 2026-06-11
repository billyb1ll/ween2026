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
  NativeSelect,
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
  'แพทยศาสตร์ศิริราชพยาบาล (SI)',
  'วิทยาศาสตร์ (SC)',
  'แพทยศาสตร์โรงพยาบาลรามาฯ (RA)',
  'ทันตแพทยศาสตร์ (DT)',
  'เทคนิคการแพทย์ (MT)',
  'สาธารณสุขศาสตร์ (PH)',
  'พยาบาลศาสตร์ (NS)',
  'กายภาพบำบัด (PT)',
  'โรงเรียนพยาบาลรามาธิบดี (NR)',
  'วิศวกรรมศาสตร์ (EG)',
  'สิ่งแวดล้อมและทรัพยากรศาสตร์ (EN)',
  'วิทยาเขตกาญจนบุรี (KA)',
  'สัตวแพทยศาสตร์ (VS)',
  'หลักสูตรแพทยศาสตร์บัณฑิต โครงการผลิตแพทย์เพื่อชาวชนบท (PI)',
  'สาขาวิชากิจกรรมบำบัด คณะกายภาพบำบัด (OT)',
  'โครงการจัดตั้งวิทยาเขตนครสวรรค์ (NA)',
  'โครงการจัดตั้งวิทยาเขตอำนาจเจริญ (AM)',
  'ศิลปศาสตร์ (LA)',
  'วิทยาลัยศาสนศึกษา (CRS)',
  'วิทยาลัยนานาชาติ (IC)',
  'เทคโนโลยีสารสนเทศและการสื่อสาร (ICT)',
  'โรงเรียนกายอุปกรณ์สิรินธร (PO)',
  'วิทยาลัยวิทยาศาสตร์และเทคโนโลยี (SS)',
  'คณะสังคมศาสตร์และมนุษย์ศาสตร์ (SH)',
  'วิทยาลับดุริยางคศิลป์ (MS)',
  'วิทยาลัยราชสุดา (RS)',
  'เภสัชศาสตร์ (PY)',
  'เวชศาสตร์เขตร้อน (TM)'
]

const STAFF_ROLES = [
  'ประธาน',
  'เลขา',
  'เหรัญญิก',
  'ประสานงาน',
  'Timer',
  'Creative & Art',
  'โสต',
  'สวัสดิการและพัสดุ',
  'พยาบาล',
  'สถานที่',
  'สันทนาการ',
  'พี่กลุ่ม',
  'ทะเบียน'
]

export function ProfileSetupPage() {
  const navigate = useNavigate()
  const { user, updateProfile } = useUser()
  const isStaff = user?.role && user.role !== 'student'

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

              {/* Faculty Dropdown */}
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
                <NativeSelect.Root width="100%">
                  <NativeSelect.Field
                    id="setup-faculty"
                    aria-label="Faculty (คณะ)"
                    title="Faculty (คณะ)"
                    value={faculty}
                    onChange={(e) => setFaculty(e.currentTarget.value)}
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
                    px={4}
                  >
                    <option value="">Select Faculty...</option>
                    {THAI_FACULTIES.map((fac) => {
                      const cleanVal = fac.split(' (')[0]
                      return (
                        <option key={fac} value={cleanVal}>
                          {fac}
                        </option>
                      )
                    })}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </VStack>

              {/* Major / Staff Position */}
              <VStack align="stretch" gap={1.5}>
                <Box
                  fontSize="xs"
                  fontWeight="700"
                  color="var(--c-chocolate)"
                  textTransform="uppercase"
                  letterSpacing="0.05em"
                >
                  <label htmlFor="setup-major">
                    {isStaff ? 'Staff Position (ตำแหน่ง)' : 'Major (สาขา)'}{' '}
                    <Text as="span" color="var(--c-outline)" fontSize="2xs" fontWeight="normal">
                      (Optional)
                    </Text>
                  </label>
                </Box>
                {isStaff ? (
                  <NativeSelect.Root width="100%">
                    <NativeSelect.Field
                      id="setup-major"
                      aria-label="Staff Position (ตำแหน่ง)"
                      title="Staff Position (ตำแหน่ง)"
                      value={major}
                      onChange={(e) => setMajor(e.currentTarget.value)}
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
                      px={4}
                    >
                      <option value="">Select Position...</option>
                      {STAFF_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                ) : (
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
                )}
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
