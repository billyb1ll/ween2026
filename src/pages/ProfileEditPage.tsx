import { useState, useEffect, useRef } from 'react'
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
  Flex,
  Image,
} from '@chakra-ui/react'
import { useUser } from '../context/UserContext'
import { supabase } from '../lib/supabase'
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

export function ProfileEditPage() {
  const navigate = useNavigate()
  const { user, updateProfile } = useUser()
  const isStaff = user?.role && user.role !== 'student'

  const [nickname, setNickname] = useState(user?.nickname || '')
  const [faculty, setFaculty] = useState(user?.faculty || '')
  const [major, setMajor] = useState(user?.major || '')
  const [ig, setIg] = useState(user?.ig || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [avatarColor, setAvatarColor] = useState(user?.avatar_color || PRESET_COLORS[0])
  const [profilePicUrl, setProfilePicUrl] = useState(user?.profile_pic_url || '')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) {
      navigate('/login')
    }
  }, [user, navigate])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.student_id}-${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, file, { cacheControl: '3600', upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath)

      setProfilePicUrl(publicUrl)
      toaster.create({
        title: 'Image uploaded!',
        description: 'Successfully saved profile picture.',
        type: 'success',
      })
    } catch (err) {
      console.error('File upload failed:', err)
      toaster.create({
        title: 'Upload failed',
        description: 'Please try again.',
        type: 'error',
      })
    } finally {
      setUploading(false)
    }
  }

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
      bio: bio.trim(),
      profilePicUrl: profilePicUrl.trim(),
      photoPool: user?.photo_pool || [], // keep photo pool intact
    })
    setSubmitting(false)

    if (success) {
      toaster.create({
        title: 'Profile Saved!',
        type: 'success',
      })
      navigate('/')
    } else {
      toaster.create({
        title: 'Save failed',
        type: 'error',
      })
    }
  }

  return (
    <Box minH="90vh" display="flex" alignItems="center" justifyContent="center" py={{ base: 6, md: 12 }} px={4}>
      <Container maxW="md">
        <Box
          bg="bg.surface"
          border="1px solid"
          borderColor="border.subtle"
          borderRadius="2xl"
          p={{ base: 5, md: 8 }}
          boxShadow="var(--shadow-card)"
          animation="scale-in 0.4s var(--ease-out-quart)"
        >
          <VStack align="stretch" gap={6} as="form" onSubmit={handleSubmit}>
            <VStack align="center" textAlign="center" gap={1}>
              <Heading as="h1" fontSize="2xl" color="accent.solid" fontWeight="700">
                Manage Profile
              </Heading>
              <Text color="fg.muted" fontSize="sm">
                Set up your orientation identity. Let's make connections!
              </Text>
            </VStack>

            <VStack align="stretch" gap={4}>
              {/* Nickname */}
              <VStack align="stretch" gap={1.5}>
                <Box fontSize="xs" fontWeight="700" color="accent.solid" textTransform="uppercase" letterSpacing="0.05em">
                  <label htmlFor="edit-nickname">Nickname (ชื่อเล่น) <Box as="span" color="var(--c-error)">*</Box></label>
                </Box>
                <Input
                  id="edit-nickname"
                  placeholder="e.g. บิล"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  borderRadius="xl"
                  border="1.5px solid var(--c-outline)"
                  bg="bg.hero"
                  _focus={{ borderColor: 'accent.solid' }}
                  h="48px"
                  fontSize="sm"
                  required
                />
              </VStack>

              {/* Faculty */}
              <VStack align="stretch" gap={1.5}>
                <Box fontSize="xs" fontWeight="700" color="accent.solid" textTransform="uppercase" letterSpacing="0.05em">
                  <label htmlFor="edit-faculty">Faculty (คณะ) <Box as="span" color="var(--c-error)">*</Box></label>
                </Box>
                <Input
                  id="edit-faculty"
                  placeholder="e.g. วิศวกรรมศาสตร์"
                  list="faculties-list"
                  value={faculty}
                  onChange={(e) => setFaculty(e.target.value)}
                  borderRadius="xl"
                  border="1.5px solid var(--c-outline)"
                  bg="bg.hero"
                  _focus={{ borderColor: 'accent.solid' }}
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

              {/* Major / Staff Position */}
              <VStack align="stretch" gap={1.5}>
                <Box fontSize="xs" fontWeight="700" color="accent.solid" textTransform="uppercase" letterSpacing="0.05em">
                  <label htmlFor="edit-major">
                    {isStaff ? 'Staff Position (ตำแหน่ง)' : 'Major (สาขา)'}{' '}
                    <Text as="span" color="fg.subtle" fontSize="2xs" fontWeight="normal">
                      (Optional)
                    </Text>
                  </label>
                </Box>
                <Input
                  id="edit-major"
                  placeholder={isStaff ? 'e.g. พี่กลุ่ม, Creative & Art' : 'e.g. วิทยาการคอมพิวเตอร์'}
                  list={isStaff ? 'staff-roles-list' : undefined}
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  borderRadius="xl"
                  border="1.5px solid var(--c-outline)"
                  bg="bg.hero"
                  _focus={{ borderColor: 'accent.solid' }}
                  h="48px"
                  fontSize="sm"
                />
                {isStaff && (
                  <datalist id="staff-roles-list">
                    {STAFF_ROLES.map((role) => (
                      <option key={role} value={role} />
                    ))}
                  </datalist>
                )}
                <Text fontSize="2xs" color="fg.subtle" mt={1}>
                  Only visible to verified Baan 7 freshmen
                </Text>
              </VStack>

              {/* Instagram */}
              <VStack align="stretch" gap={1.5}>
                <Box fontSize="xs" fontWeight="700" color="accent.solid" textTransform="uppercase" letterSpacing="0.05em">
                  <label htmlFor="edit-ig">Instagram Account (IG) <Text as="span" color="fg.subtle" fontSize="2xs" fontWeight="normal">(Optional)</Text></label>
                </Box>
                <Input
                  id="edit-ig"
                  placeholder="e.g. chula.freshman"
                  value={ig}
                  onChange={(e) => setIg(e.target.value)}
                  borderRadius="xl"
                  border="1.5px solid var(--c-outline)"
                  bg="bg.hero"
                  _focus={{ borderColor: 'accent.solid' }}
                  h="48px"
                  fontSize="sm"
                />
                <Text fontSize="2xs" color="fg.subtle" mt={1}>
                  Only visible to verified Baan 7 freshmen
                </Text>
              </VStack>

              {/* Bio */}
              <VStack align="stretch" gap={1.5}>
                <Box fontSize="xs" fontWeight="700" color="accent.solid" textTransform="uppercase" letterSpacing="0.05em">
                  <label htmlFor="edit-bio">Bio (คำโปรย) <Text as="span" color="fg.subtle" fontSize="2xs" fontWeight="normal">(Optional)</Text></label>
                </Box>
                <Input
                  id="edit-bio"
                  placeholder="e.g. สนใจเรื่องสิ่งแวดล้อม ชอบฟังเพลงอินดี้"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  borderRadius="xl"
                  border="1.5px solid var(--c-outline)"
                  bg="bg.hero"
                  _focus={{ borderColor: 'accent.solid' }}
                  h="48px"
                  fontSize="sm"
                />
              </VStack>

              {/* Avatar Color Picker */}
              <VStack align="stretch" gap={2}>
                <Text fontSize="xs" fontWeight="700" color="accent.solid" textTransform="uppercase" letterSpacing="0.05em">
                  Avatar Background Color
                </Text>
                <HStack gap={3}>
                  {PRESET_COLORS.map((c) => (
                    <Button
                      key={c}
                      type="button"
                      aria-label={`Select color ${c}`}
                      w="44px"
                      h="44px"
                      minW="44px"
                      borderRadius="full"
                      bg={c}
                      cursor="pointer"
                      border={avatarColor === c ? '2.5px solid var(--c-chocolate)' : '1px solid rgba(0,0,0,0.1)'}
                      transform={avatarColor === c ? 'scale(1.15)' : 'none'}
                      transition="all 0.2s ease"
                      _hover={{ transform: 'scale(1.15)', bg: c }}
                      onClick={() => setAvatarColor(c)}
                      p={0}
                    />
                  ))}
                </HStack>
              </VStack>

              {/* Profile Image Uploader */}
              <VStack align="stretch" gap={2}>
                <Text fontSize="xs" fontWeight="700" color="accent.solid" textTransform="uppercase" letterSpacing="0.05em">
                  Profile Picture
                </Text>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  ref={fileInputRef}
                  display="none"
                />
                <Flex gap={2}>
                  <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    loading={uploading}
                    bg="bg.hero"
                    color="accent.solid"
                    border="1px solid"
                    borderColor="border.subtle"
                    h="44px"
                    borderRadius="xl"
                    cursor="pointer"
                    _hover={{ bg: 'bg.surface' }}
                    flex={1}
                  >
                    Upload Photo
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      const url = prompt('Enter image URL:')
                      if (url) setProfilePicUrl(url)
                    }}
                    h="44px"
                    borderRadius="xl"
                    cursor="pointer"
                    _hover={{ bg: 'bg.hero' }}
                  >
                    URL
                  </Button>
                </Flex>
                {profilePicUrl && (
                  <Box mt={2} borderRadius="xl" overflow="hidden" maxH="120px" w="100%" border="1px solid" borderColor="border.subtle">
                    <Image src={profilePicUrl} alt="Preview" w="100%" h="100%" objectFit="cover" />
                  </Box>
                )}
              </VStack>
            </VStack>

            <HStack w="100%" gap={3}>
              <Button
                type="button"
                variant="outline"
                borderColor="border.subtle"
                color="accent.solid"
                borderRadius="xl"
                h="50px"
                flex={1}
                fontSize="md"
                fontWeight="600"
                cursor="pointer"
                onClick={() => navigate('/')}
                _hover={{ bg: 'bg.hero' }}
              >
                Cancel (ยกเลิก)
              </Button>
              <Button
                type="submit"
                bg="accent.solid"
                color="white"
                borderRadius="xl"
                h="50px"
                flex={2}
                fontSize="md"
                fontWeight="700"
                _hover={{ bg: 'chocolate.600' }}
                loading={submitting}
              >
                Save Settings
              </Button>
            </HStack>
          </VStack>
        </Box>
      </Container>
    </Box>
  )
}
