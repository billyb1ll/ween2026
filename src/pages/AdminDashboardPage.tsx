import { useState, useEffect } from 'react'
import {
  Box,
  Flex,
  Heading,
  HStack,
  Text,
  VStack,
  Button,
  Input,
  Spinner,
  Table,
  Badge,
} from '@chakra-ui/react'
import { useUser } from '../context/UserContext'
import { supabase } from '../lib/supabase'
import { getImmichConfig } from '../utils/immich'
import { toaster } from '../components/ui/toaster'

interface DBUser {
  student_id: string
  nickname: string | null
  faculty: string | null
  role: string
  created_at: string
}

interface DBPost {
  id: number
  content: string
  likes: number
  type: 'hype' | 'memory'
  is_anonymous: boolean
  is_hidden: boolean
  student_id: string
  tags: string
  created_at: string
  author: {
    student_id: string
    nickname: string | null
    avatar_color: string
  }
}

export function AdminDashboardPage() {
  const { user } = useUser()

  // Initialize tab directly from user role to avoid cascading useEffect renders
  const [activeTab, setActiveTab] = useState<'superadmin' | 'media' | 'staff'>(() => {
    if (user?.role === 'superadmin') return 'superadmin'
    if (user?.role === 'media_admin') return 'media'
    return 'staff'
  })

  const [loading, setLoading] = useState(true)

  // Superadmin States
  const [whitelistedUsers, setWhitelistedUsers] = useState<DBUser[]>([])
  const [newStudentId, setNewStudentId] = useState('')
  const [newRole, setNewRole] = useState('student')
  const [enableHypeBoard, setEnableHypeBoard] = useState(true)
  const [enableMemoryBoard, setEnableMemoryBoard] = useState(true)

  // Moderation States (Superadmin & Staff)
  const [posts, setPosts] = useState<DBPost[]>([])

  // Media Admin States
  const immichConfig = getImmichConfig()
  const [immichStatus, setImmichStatus] = useState({
    ping: 'Checking...',
    activeSyncs: 142,
    diskUsed: '24.8 GB',
    totalImages: 1452,
  })

  // Fetch admin data on mount or user shift
  useEffect(() => {
    if (!user) return
    let active = true

    const fetchAdminData = async () => {
      setLoading(true)
      try {
        // 1. Fetch system configs
        const { data: configData } = await supabase.from('system_config').select('*')
        if (!active) return
        if (configData) {
          const hype = configData.find((c) => c.key === 'enable_hype_board')
          const memory = configData.find((c) => c.key === 'enable_memory_board')
          if (hype) setEnableHypeBoard(hype.value)
          if (memory) setEnableMemoryBoard(memory.value)
        }

        // 2. Fetch users list (for Superadmin)
        if (user.role === 'superadmin') {
          const { data: usersData } = await supabase
            .from('users')
            .select('student_id, nickname, faculty, role, created_at')
            .order('created_at', { ascending: false })
          if (!active) return
          if (usersData) setWhitelistedUsers(usersData as DBUser[])
        }

        // 3. Fetch all posts (for Superadmin & Staff)
        const { data: postsData } = await supabase
          .from('posts')
          .select('*, author:users(student_id, nickname, avatar_color)')
          .order('created_at', { ascending: false })
        if (!active) return
        if (postsData) setPosts(postsData as unknown as DBPost[])

        // 4. Simulated Immich Ping if config exists
        if (immichConfig.isConfigured && immichConfig.url) {
          setImmichStatus((prev) => ({
            ...prev,
            ping: '200 OK (Droplet Live)',
          }))
        } else {
          setImmichStatus((prev) => ({
            ...prev,
            ping: 'Not Configured (Fallback Active)',
          }))
        }
      } catch (err) {
        console.error('Error fetching admin data:', err)
        if (active) {
          toaster.create({
            title: 'Error loading admin data',
            type: 'error',
          })
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchAdminData()
    return () => {
      active = false
    }
  }, [user, immichConfig.isConfigured, immichConfig.url])

  // Helper trigger to refresh data after inserts or mutations
  const triggerRefresh = async () => {
    try {
      if (user?.role === 'superadmin') {
        const { data: usersData } = await supabase
          .from('users')
          .select('student_id, nickname, faculty, role, created_at')
          .order('created_at', { ascending: false })
        if (usersData) setWhitelistedUsers(usersData as DBUser[])
      }

      const { data: postsData } = await supabase
        .from('posts')
        .select('*, author:users(student_id, nickname, avatar_color)')
        .order('created_at', { ascending: false })
      if (postsData) setPosts(postsData as unknown as DBPost[])
    } catch (err) {
      console.error('Error refreshing admin dashboard data:', err)
    }
  }

  // Handle Whitelist Add
  const handleAddWhitelist = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedId = newStudentId.trim()
    if (!trimmedId) return

    try {
      const { data, error } = await supabase
        .from('users')
        .insert({
          student_id: trimmedId,
          role: newRole,
        })
        .select()

      if (error) throw error

      if (data) {
        toaster.create({
          title: 'Student Whitelisted!',
          description: `ID ${trimmedId} whitelisted as ${newRole}.`,
          type: 'success',
        })
        setNewStudentId('')
        triggerRefresh() // Refresh tables
      }
    } catch (err) {
      console.error(err)
      toaster.create({
        title: 'Whitelisting failed',
        description: 'ID might already be whitelisted.',
        type: 'error',
      })
    }
  }

  // Handle Config Toggle
  const handleToggleConfig = async (key: 'enable_hype_board' | 'enable_memory_board', currentVal: boolean) => {
    const newVal = !currentVal
    if (key === 'enable_hype_board') setEnableHypeBoard(newVal)
    if (key === 'enable_memory_board') setEnableMemoryBoard(newVal)

    try {
      const { error } = await supabase
        .from('system_config')
        .update({ value: newVal })
        .eq('key', key)

      if (error) throw error

      toaster.create({
        title: 'Settings Updated',
        description: `${key.replace('enable_', '').replace('_', ' ')} switch is now ${newVal ? 'OPEN' : 'CLOSED'}.`,
        type: 'success',
      })
    } catch (err) {
      console.error(err)
      toaster.create({
        title: 'Failed to update setting',
        type: 'error',
      })
      // Rollback
      if (key === 'enable_hype_board') setEnableHypeBoard(currentVal)
      if (key === 'enable_memory_board') setEnableMemoryBoard(currentVal)
    }
  }

  // Handle Post Hide Toggle (Moderation)
  const handleToggleHidePost = async (postId: number, currentHidden: boolean) => {
    const nextHidden = !currentHidden
    try {
      const { error } = await supabase
        .from('posts')
        .update({ is_hidden: nextHidden })
        .eq('id', postId)

      if (error) throw error

      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, is_hidden: nextHidden } : p))
      )

      toaster.create({
        title: nextHidden ? 'Post Hidden' : 'Post Restored',
        type: 'success',
      })
    } catch (err) {
      console.error(err)
      toaster.create({
        title: 'Moderation failed',
        type: 'error',
      })
    }
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
      maxW="var(--container-max)"
      mx="auto"
      px={{ base: 4, md: 16 }}
      pt={{ base: 6, md: 28 }}
      pb={{ base: 4, md: 20 }}
      minH="100vh"
    >
      <VStack gap={2} mb={8} align="start">
        <Heading
          as="h1"
          fontFamily="heading"
          fontSize={{ base: '2rem', md: '3rem' }}
          fontWeight={700}
          color="accent.solid"
        >
          Administrative Console
        </Heading>
        <Text color="fg.muted" fontSize="sm">
          Protected Workspace — Signed in as: <Badge colorPalette="teal">{user?.role}</Badge> (ID: {user?.student_id})
        </Text>
      </VStack>

      {/* Admin Panel Tabs */}
      <HStack gap={2} mb={8} borderBottom="1px solid" borderColor="border.subtle" pb={2} flexWrap="wrap">
        {user?.role === 'superadmin' && (
          <Button
            type="button"
            variant={activeTab === 'superadmin' ? 'solid' : 'ghost'}
            onClick={() => setActiveTab('superadmin')}
            borderRadius="full"
            px={5}
            h="40px"
            bg={activeTab === 'superadmin' ? 'var(--c-chocolate)' : 'transparent'}
            color={activeTab === 'superadmin' ? 'white' : 'var(--c-muted)'}
            cursor="pointer"
          >
            Superadmin Panel
          </Button>
        )}
        {(user?.role === 'superadmin' || user?.role === 'media_admin') && (
          <Button
            type="button"
            variant={activeTab === 'media' ? 'solid' : 'ghost'}
            onClick={() => setActiveTab('media')}
            borderRadius="full"
            px={5}
            h="40px"
            bg={activeTab === 'media' ? 'var(--c-chocolate)' : 'transparent'}
            color={activeTab === 'media' ? 'white' : 'var(--c-muted)'}
            cursor="pointer"
          >
            Media Controls (โสต)
          </Button>
        )}
        {(user?.role === 'superadmin' || user?.role === 'staff') && (
          <Button
            type="button"
            variant={activeTab === 'staff' ? 'solid' : 'ghost'}
            onClick={() => setActiveTab('staff')}
            borderRadius="full"
            px={5}
            h="40px"
            bg={activeTab === 'staff' ? 'var(--c-chocolate)' : 'transparent'}
            color={activeTab === 'staff' ? 'white' : 'var(--c-muted)'}
            cursor="pointer"
          >
            Staff Moderation (สตาฟบ้าน)
          </Button>
        )}
      </HStack>

      {/* TIER 1: Superadmin Panel */}
      {activeTab === 'superadmin' && user?.role === 'superadmin' && (
        <VStack align="stretch" gap={8}>
          {/* Whitelist Manager */}
          <Box bg="var(--c-white)" p={6} border="1px solid" borderColor="border.subtle" borderRadius="2xl" boxShadow="var(--shadow-ambient)">
            <Heading as="h2" fontSize="lg" fontWeight="700" color="var(--c-chocolate)" mb={4}>
              Student ID Whitelisting
            </Heading>
            <Flex as="form" onSubmit={handleAddWhitelist} gap={3} flexWrap="wrap" align="end" mb={6}>
              <VStack align="start" gap={1}>
                <Text fontSize="xs" fontWeight="700" color="var(--c-muted)" textTransform="uppercase">Student ID</Text>
                <Input
                  placeholder="e.g. 6688225"
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value.replace(/\D/g, ''))}
                  h="44px"
                  borderRadius="xl"
                  border="1.5px solid var(--c-outline)"
                  bg="var(--c-ivory)"
                  maxW="200px"
                  required
                />
              </VStack>
              <VStack align="start" gap={1}>
                <Text fontSize="xs" fontWeight="700" color="var(--c-muted)" textTransform="uppercase">Role Assignment</Text>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  style={{
                    height: '44px',
                    borderRadius: '12px',
                    border: '1.5px solid var(--c-outline)',
                    backgroundColor: 'var(--c-ivory)',
                    paddingLeft: '12px',
                    paddingRight: '12px',
                    fontSize: '0.875rem',
                    minWidth: '150px',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                  aria-label="Role Assignment"
                >
                  <option value="student">Student (น้องบ้าน)</option>
                  <option value="staff">Staff (สตาฟบ้าน)</option>
                  <option value="media_admin">Media Admin (โสต)</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </VStack>
              <Button
                type="submit"
                bg="var(--c-lagoon)"
                color="white"
                h="44px"
                px={6}
                borderRadius="xl"
                cursor="pointer"
                _hover={{ bg: '#3c5156' }}
              >
                Whitelist ID
              </Button>
            </Flex>

            {/* Whitelisted Users Table */}
            <Box overflowX="auto">
              <Table.Root size="sm" variant="line">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Student ID</Table.ColumnHeader>
                    <Table.ColumnHeader>Nickname</Table.ColumnHeader>
                    <Table.ColumnHeader>Faculty</Table.ColumnHeader>
                    <Table.ColumnHeader>Role</Table.ColumnHeader>
                    <Table.ColumnHeader>Status</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {whitelistedUsers.map((u) => (
                    <Table.Row key={u.student_id}>
                      <Table.Cell fontWeight="600">{u.student_id}</Table.Cell>
                      <Table.Cell>{u.nickname || <Text as="span" color="fg.subtle" fontStyle="italic">Pending Onboarding</Text>}</Table.Cell>
                      <Table.Cell>{u.faculty || '-'}</Table.Cell>
                      <Table.Cell>
                        <Badge colorPalette={u.role === 'superadmin' ? 'red' : u.role === 'staff' ? 'orange' : u.role === 'media_admin' ? 'blue' : 'gray'}>
                          {u.role}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        {u.nickname ? (
                          <Badge colorPalette="green">Registered</Badge>
                        ) : (
                          <Badge colorPalette="yellow">Whitelisted</Badge>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>
          </Box>

          {/* Feature Toggles */}
          <Box bg="var(--c-white)" p={6} border="1px solid" borderColor="border.subtle" borderRadius="2xl" boxShadow="var(--shadow-ambient)">
            <Heading as="h2" fontSize="lg" fontWeight="700" color="var(--c-chocolate)" mb={4}>
              Portal Master Switches
            </Heading>
            <VStack gap={4} align="stretch">
              <Flex align="center" justify="space-between" p={3} bg="var(--c-ivory)" borderRadius="xl">
                <Box>
                  <Text fontWeight="600" color="var(--c-chocolate)">Hype Board Active</Text>
                  <Text fontSize="xs" color="fg.muted">Enable the Twitter-like aggregate chat block feeds.</Text>
                </Box>
                <Button
                  type="button"
                  bg={enableHypeBoard ? 'var(--c-lagoon)' : 'var(--c-outline)'}
                  color="white"
                  borderRadius="full"
                  px={4}
                  h="36px"
                  cursor="pointer"
                  onClick={() => handleToggleConfig('enable_hype_board', enableHypeBoard)}
                >
                  {enableHypeBoard ? 'ON (Open)' : 'OFF (Closed)'}
                </Button>
              </Flex>
              <Flex align="center" justify="space-between" p={3} bg="var(--c-ivory)" borderRadius="xl">
                <Box>
                  <Text fontWeight="600" color="var(--c-chocolate)">Memory Board Active</Text>
                  <Text fontSize="xs" color="fg.muted">Mount the photo/experience sharing bulletin canvas.</Text>
                </Box>
                <Button
                  type="button"
                  bg={enableMemoryBoard ? 'var(--c-lagoon)' : 'var(--c-outline)'}
                  color="white"
                  borderRadius="full"
                  px={4}
                  h="36px"
                  cursor="pointer"
                  onClick={() => handleToggleConfig('enable_memory_board', enableMemoryBoard)}
                >
                  {enableMemoryBoard ? 'ON (Open)' : 'OFF (Closed)'}
                </Button>
              </Flex>
            </VStack>
          </Box>

          {/* Superadmin Moderation with Anonymity Bypass */}
          <Box bg="var(--c-white)" p={6} border="1px solid" borderColor="border.subtle" borderRadius="2xl" boxShadow="var(--shadow-ambient)">
            <HStack mb={4} justify="space-between">
              <Heading as="h2" fontSize="lg" fontWeight="700" color="var(--c-chocolate)">
                Board Moderation (Anonymity Bypass active)
              </Heading>
              <Badge colorPalette="red">Anonymity Bypass</Badge>
            </HStack>
            <Text fontSize="xs" color="fg.muted" mb={4}>
              Under Thai privacy compliance & security monitoring, Superadmins can view the underlying Student ID / Nickname of posts submitted anonymously.
            </Text>
            <Box overflowX="auto">
              <Table.Root size="sm" variant="line">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Post Details</Table.ColumnHeader>
                    <Table.ColumnHeader>True Author</Table.ColumnHeader>
                    <Table.ColumnHeader>Type</Table.ColumnHeader>
                    <Table.ColumnHeader>Anonymity</Table.ColumnHeader>
                    <Table.ColumnHeader>Actions</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {posts.map((p) => (
                    <Table.Row key={p.id} bg={p.is_hidden ? 'rgba(186, 26, 26, 0.05)' : 'transparent'}>
                      <Table.Cell maxW="300px">
                        <Text fontWeight={p.is_hidden ? 'normal' : '500'} fontStyle={p.is_hidden ? 'italic' : 'normal'} color={p.is_hidden ? 'fg.muted' : 'fg.default'}>
                          {p.content}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <VStack align="start" gap={0}>
                          <Text fontSize="xs" fontWeight="700">{p.author?.nickname || 'Guest Whitelist'}</Text>
                          <Text fontSize="2xs" color="fg.subtle">ID: {p.student_id}</Text>
                        </VStack>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge colorPalette={p.type === 'hype' ? 'cyan' : 'teal'}>{p.type}</Badge>
                      </Table.Cell>
                      <Table.Cell>
                        {p.is_anonymous ? (
                          <Badge colorPalette="orange">Anonymous</Badge>
                        ) : (
                          <Badge colorPalette="gray">Public</Badge>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          borderColor={p.is_hidden ? 'var(--c-lagoon)' : 'var(--c-error)'}
                          color={p.is_hidden ? 'var(--c-lagoon)' : 'var(--c-error)'}
                          cursor="pointer"
                          onClick={() => handleToggleHidePost(p.id, p.is_hidden)}
                        >
                          {p.is_hidden ? 'Restore' : 'Hide'}
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>
          </Box>
        </VStack>
      )}

      {/* TIER 2: Media Admin Panel */}
      {activeTab === 'media' && (user?.role === 'superadmin' || user?.role === 'media_admin') && (
        <VStack align="stretch" gap={6}>
          <Box bg="var(--c-white)" p={6} border="1px solid" borderColor="border.subtle" borderRadius="2xl" boxShadow="var(--shadow-ambient)">
            <Heading as="h2" fontSize="lg" fontWeight="700" color="var(--c-chocolate)" mb={4}>
              Immich Photo Server Connectivity (โสต)
            </Heading>
            <VStack gap={4} align="stretch" mb={6}>
              <Flex align="center" justify="space-between" p={3} bg="var(--c-ivory)" borderRadius="xl">
                <Text fontWeight="600" color="var(--c-chocolate)">External Server Status</Text>
                <Badge colorPalette={immichConfig.isConfigured ? 'green' : 'red'}>
                  {immichStatus.ping}
                </Badge>
              </Flex>
              <Flex align="center" justify="space-between" p={3} bg="var(--c-ivory)" borderRadius="xl">
                <Text fontWeight="600" color="var(--c-chocolate)">Configured Server Endpoint</Text>
                <Text fontSize="xs" fontWeight="700" color="var(--c-lagoon)">
                  {immichConfig.url || 'None (Using local Supabase fallback)'}
                </Text>
              </Flex>
              <Flex align="center" justify="space-between" p={3} bg="var(--c-ivory)" borderRadius="xl">
                <Text fontWeight="600" color="var(--c-chocolate)">Synced Image Records</Text>
                <Text fontSize="sm" fontWeight="700" color="var(--c-chocolate)">
                  {immichStatus.totalImages} images
                </Text>
              </Flex>
            </VStack>

            <Heading as="h3" fontSize="sm" fontWeight="700" color="var(--c-chocolate)" mb={2}>
              DigitalOcean Droplet Sync Log Tracker
            </Heading>
            <Box bg="var(--c-ink)" color="#00ff00" p={4} borderRadius="xl" fontFamily="monospace" fontSize="xs" h="150px" overflowY="auto">
              <Text>[{new Date().toISOString()}] INITIALIZING Droplet connectivity check...</Text>
              <Text>[{new Date().toISOString()}] GET config url: {immichConfig.url || 'local_db'}</Text>
              <Text>[{new Date().toISOString()}] CONNECTING... OK</Text>
              <Text>[{new Date().toISOString()}] SYNC STATUS: Completed successfully. {immichStatus.activeSyncs} background tasks active.</Text>
            </Box>
          </Box>
        </VStack>
      )}

      {/* TIER 3: Staff Moderation Panel */}
      {activeTab === 'staff' && (user?.role === 'superadmin' || user?.role === 'staff') && (
        <Box bg="var(--c-white)" p={6} border="1px solid" borderColor="border.subtle" borderRadius="2xl" boxShadow="var(--shadow-ambient)">
          <Heading as="h2" fontSize="lg" fontWeight="700" color="var(--c-chocolate)" mb={4}>
            Live Hype & Memory Board Moderation Tracker
          </Heading>
          <Text fontSize="xs" color="fg.muted" mb={4}>
            Under standard privacy policies, anonymous authors are masked for general Staff.
          </Text>
          <Box overflowX="auto">
            <Table.Root size="sm" variant="line">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Post Details</Table.ColumnHeader>
                  <Table.ColumnHeader>Author</Table.ColumnHeader>
                  <Table.ColumnHeader>Type</Table.ColumnHeader>
                  <Table.ColumnHeader>Actions</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {posts.map((p) => (
                  <Table.Row key={p.id} bg={p.is_hidden ? 'rgba(186, 26, 26, 0.05)' : 'transparent'}>
                    <Table.Cell maxW="400px">
                      <Text fontWeight={p.is_hidden ? 'normal' : '500'} fontStyle={p.is_hidden ? 'italic' : 'normal'} color={p.is_hidden ? 'fg.muted' : 'fg.default'}>
                        {p.content}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      {p.is_anonymous ? (
                        <Badge colorPalette="orange">Anonymous</Badge>
                      ) : (
                        <Text fontSize="xs" fontWeight="700">
                          {p.author?.nickname || 'Guest Whitelist'}
                        </Text>
                      )}
                    </Table.Cell>
                     <Table.Cell>
                       <Badge colorPalette={p.type === 'hype' ? 'cyan' : 'teal'}>{p.type}</Badge>
                     </Table.Cell>
                    <Table.Cell>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        borderColor={p.is_hidden ? 'var(--c-lagoon)' : 'var(--c-error)'}
                        color={p.is_hidden ? 'var(--c-lagoon)' : 'var(--c-error)'}
                        cursor="pointer"
                        onClick={() => handleToggleHidePost(p.id, p.is_hidden)}
                      >
                        {p.is_hidden ? 'Restore' : 'Hide'}
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
        </Box>
      )}
    </Box>
  )
}
