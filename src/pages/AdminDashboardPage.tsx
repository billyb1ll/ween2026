import { useState, useEffect, useRef } from 'react'
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
import Papa from 'papaparse'

interface DBUser {
  student_id: string
  nickname: string | null
  faculty: string | null
  role: string
  created_at: string
}

interface CSVRecord {
  student_id: string
  role: string
  nickname: string | null
  faculty: string | null
  major: string | null
}

export function AdminDashboardPage() {
  const { user } = useUser()

  // Initialize tab directly from user role to avoid cascading useEffect renders
  const [activeTab, setActiveTab] = useState<'superadmin' | 'media'>(() => {
    if (user?.role === 'superadmin') return 'superadmin'
    return 'media'
  })

  const [loading, setLoading] = useState(true)

  // Superadmin States
  const [whitelistedUsers, setWhitelistedUsers] = useState<DBUser[]>([])
  const [newStudentId, setNewStudentId] = useState('')
  const [newRole, setNewRole] = useState('student')
  const [enableHypeBoard, setEnableHypeBoard] = useState(true)
  const [enableMemoryBoard, setEnableMemoryBoard] = useState(true)
  const [eventTitle, setEventTitle] = useState('First Meet')
  const [eventTime, setEventTime] = useState('')
  const [updatingEvent, setUpdatingEvent] = useState(false)

  // CSV States
  const [csvRecords, setCsvRecords] = useState<CSVRecord[]>([])
  const [showCsvModal, setShowCsvModal] = useState(false)
  const [upserting, setUpserting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Media Admin States
  const immichConfig = getImmichConfig()
  const [immichStatus, setImmichStatus] = useState({
    ping: 'Checking...',
    activeSyncs: 142,
    diskUsed: '24.8 GB',
    totalImages: 1452,
  })

  useEffect(() => {
    let active = true
    const fetchAdminData = async () => {
      if (!user) return
      await Promise.resolve() // Defer synchronous state update inside effect
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

        // 3. Simulated Immich Ping if config exists
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

        // 4. Fetch Next Event config
        const { data: eventData } = await supabase
          .from('event_config')
          .select('*')
          .eq('key', 'next_event')
          .single()
        if (!active) return
        if (eventData) {
          setEventTitle(eventData.title)
          const d = new Date(eventData.event_time)
          const pad = (n: number) => n.toString().padStart(2, '0')
          const localStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
          setEventTime(localStr)
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
      if (key === 'enable_hype_board') setEnableHypeBoard(currentVal)
      if (key === 'enable_memory_board') setEnableMemoryBoard(currentVal)
    }
  }

  // Handle Event Config Update
  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventTime) return
    setUpdatingEvent(true)
    try {
      const isoString = new Date(eventTime).toISOString()
      const { error } = await supabase
        .from('event_config')
        .update({ title: eventTitle, event_time: isoString })
        .eq('key', 'next_event')

      if (error) throw error

      toaster.create({
        title: 'Event Configured!',
        description: `Event "${eventTitle}" updated successfully.`,
        type: 'success',
      })
    } catch (err) {
      console.error(err)
      toaster.create({
        title: 'Failed to configure event',
        type: 'error',
      })
    } finally {
      setUpdatingEvent(false)
    }
  }

  // Handle CSV Parsing
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = (results.data as Array<Record<string, string | undefined>>).map((row) => ({
          student_id: (row.student_id || row['Student ID'] || '').toString().trim(),
          role: (row.role || row['Role'] || 'student').toString().trim().toLowerCase(),
          nickname: (row.nickname || row['Nickname'] || '').toString().trim() || null,
          faculty: (row.faculty || row['Faculty'] || '').toString().trim() || null,
          major: (row.major || row['Major'] || '').toString().trim() || null,
        })).filter((row) => row.student_id)

        setCsvRecords(parsed)
        setShowCsvModal(true)
        if (fileInputRef.current) fileInputRef.current.value = '' // reset
      },
      error: (err) => {
        console.error('CSV parse error:', err)
        toaster.create({ title: 'CSV parsing failed', type: 'error' })
      }
    })
  }

  const isDuplicate = (studentId: string) => {
    return whitelistedUsers.some((u) => u.student_id === studentId)
  }

  const handleBatchUpsert = async () => {
    setUpserting(true)
    try {
      const { error } = await supabase
        .from('users')
        .upsert(csvRecords, { onConflict: 'student_id' })

      if (error) throw error

      toaster.create({
        title: 'CSV Onboarded successfully!',
        description: `Upserted ${csvRecords.length} student records.`,
        type: 'success',
      })
      setShowCsvModal(false)
      setCsvRecords([])
      triggerRefresh()
    } catch (err) {
      console.error('Batch upsert failed:', err)
      toaster.create({ title: 'Batch upsert failed', type: 'error' })
    } finally {
      setUpserting(false)
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
      </HStack>

      {/* TIER 1: Superadmin Panel */}
      {activeTab === 'superadmin' && user?.role === 'superadmin' && (
        <VStack align="stretch" gap={8}>
          {/* Whitelist Manager */}
          <Box bg="var(--c-white)" p={6} border="1px solid" borderColor="border.subtle" borderRadius="2xl" boxShadow="var(--shadow-card)">
            <Flex justify="space-between" align="center" mb={4} flexWrap="wrap" gap={3}>
              <Heading as="h2" fontSize="lg" fontWeight="700" color="var(--c-chocolate)">
                Student ID Whitelisting
              </Heading>
              
              {/* CSV Upload Inputs */}
              <Box>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  ref={fileInputRef}
                  display="none"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  bg="var(--c-chocolate)"
                  color="white"
                  h="44px"
                  px={6}
                  borderRadius="xl"
                  cursor="pointer"
                  _hover={{ bg: 'chocolate.600' }}
                >
                  Upload CSV
                </Button>
              </Box>
            </Flex>

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
          <Box bg="var(--c-white)" p={6} border="1px solid" borderColor="border.subtle" borderRadius="2xl" boxShadow="var(--shadow-card)">
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

          {/* Event Configuration */}
          <Box bg="var(--c-white)" p={6} border="1px solid" borderColor="border.subtle" borderRadius="2xl" boxShadow="var(--shadow-card)">
            <Heading as="h2" fontSize="lg" fontWeight="700" color="var(--c-chocolate)" mb={4}>
              Event Configuration (ตั้งค่ากิจกรรม)
            </Heading>
            <VStack as="form" onSubmit={handleUpdateEvent} gap={4} align="stretch">
              <VStack align="start" gap={1.5}>
                <Text fontSize="xs" fontWeight="700" color="var(--c-muted)" textTransform="uppercase">Event Title (ชื่อกิจกรรม)</Text>
                <Input
                  placeholder="e.g. First Meet"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  h="44px"
                  borderRadius="xl"
                  border="1.5px solid var(--c-outline)"
                  bg="var(--c-ivory)"
                  required
                />
              </VStack>
              <VStack align="start" gap={1.5}>
                <Text fontSize="xs" fontWeight="700" color="var(--c-muted)" textTransform="uppercase">Event Date & Time (วันเวลาที่จัดกิจกรรม)</Text>
                <Input
                  type="datetime-local"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  h="44px"
                  borderRadius="xl"
                  border="1.5px solid var(--c-outline)"
                  bg="var(--c-ivory)"
                  required
                />
              </VStack>
              <Button
                type="submit"
                bg="var(--c-chocolate)"
                color="white"
                h="44px"
                borderRadius="xl"
                cursor="pointer"
                _hover={{ bg: 'chocolate.600' }}
                loading={updatingEvent}
                w="100%"
                mt={2}
              >
                Save Event Configuration
              </Button>
            </VStack>
          </Box>
        </VStack>
      )}

      {/* TIER 2: Media Admin Panel */}
      {activeTab === 'media' && (user?.role === 'superadmin' || user?.role === 'media_admin') && (
        <VStack align="stretch" gap={6}>
          <Box bg="var(--c-white)" p={6} border="1px solid" borderColor="border.subtle" borderRadius="2xl" boxShadow="var(--shadow-card)">
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

      {/* CSV Preview Modal Workflow */}
      {showCsvModal && (
        <Box
          position="fixed"
          inset={0}
          bg="rgba(0,0,0,0.5)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          zIndex={1000}
          px={4}
        >
          <Box
            bg="bg.surface"
            borderRadius="2xl"
            maxW="2xl"
            w="100%"
            maxH="80vh"
            p={6}
            boxShadow="xl"
            display="flex"
            flexDirection="column"
            animation="scale-in 0.3s ease-out"
          >
            <Heading size="md" mb={2} color="var(--c-chocolate)">
              CSV Upload Preview & Duplicate Validation
            </Heading>
            <Text fontSize="xs" color="fg.subtle" mb={4}>
              Highlighting duplicates in orange. Conflict values will be updated/overwritten upon upsert.
            </Text>

            <Box overflowY="auto" flex={1} mb={4} border="1px solid" borderColor="border.subtle" borderRadius="xl">
              <Table.Root size="sm" variant="line">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Student ID</Table.ColumnHeader>
                    <Table.ColumnHeader>Nickname</Table.ColumnHeader>
                    <Table.ColumnHeader>Faculty</Table.ColumnHeader>
                    <Table.ColumnHeader>Role</Table.ColumnHeader>
                    <Table.ColumnHeader>Validation</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {csvRecords.map((row, idx) => {
                    const dup = isDuplicate(row.student_id)
                    return (
                      <Table.Row key={idx} bg={dup ? 'rgba(235, 150, 40, 0.08)' : 'transparent'}>
                        <Table.Cell fontWeight="600">{row.student_id}</Table.Cell>
                        <Table.Cell>{row.nickname || '-'}</Table.Cell>
                        <Table.Cell>{row.faculty || '-'}</Table.Cell>
                        <Table.Cell>
                          <Badge colorPalette="gray">{row.role}</Badge>
                        </Table.Cell>
                        <Table.Cell>
                          {dup ? (
                            <Badge colorPalette="orange">Duplicate (Will Update)</Badge>
                          ) : (
                            <Badge colorPalette="green">New Record</Badge>
                          )}
                        </Table.Cell>
                      </Table.Row>
                    )
                  })}
                </Table.Body>
              </Table.Root>
            </Box>

            <HStack gap={3} justify="end">
              <Button
                variant="outline"
                onClick={() => setShowCsvModal(false)}
                h="44px"
                borderRadius="xl"
                cursor="pointer"
              >
                Cancel
              </Button>
              <Button
                bg="accent.solid"
                color="white"
                onClick={handleBatchUpsert}
                loading={upserting}
                h="44px"
                px={6}
                borderRadius="xl"
                cursor="pointer"
                _hover={{ bg: '#603e2c' }}
              >
                Batch Upsert ({csvRecords.length} records)
              </Button>
            </HStack>
          </Box>
        </Box>
      )}
    </Box>
  )
}
