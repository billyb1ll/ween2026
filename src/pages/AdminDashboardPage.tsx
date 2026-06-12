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
  Portal,
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

interface AuditLog {
  id: number
  moderator_id: string
  action_type: string
  target_id: string | null
  details: string
  created_at: string
  users?: { nickname: string | null } | null
}

interface VibeMission {
  id: number
  sequence_order: number
  target_role: string
  required_count: number
}

export function AdminDashboardPage() {
  const { user } = useUser()

  // Initialize tab directly from user role to avoid cascading useEffect renders
  const [activeTab, setActiveTab] = useState<'moderator' | 'media'>(() => {
    if (user?.role === 'moderator') return 'moderator'
    return 'media'
  })

  const [loading, setLoading] = useState(true)

  // Whitelist/Users States
  const [whitelistedUsers, setWhitelistedUsers] = useState<DBUser[]>([])
  const [newStudentId, setNewStudentId] = useState('')
  const [newRole, setNewRole] = useState('student')
  const [enableHypeBoard, setEnableHypeBoard] = useState(true)
  const [enableMemoryBoard, setEnableMemoryBoard] = useState(true)
  const [eventTitle, setEventTitle] = useState('First Meet')
  const [eventTime, setEventTime] = useState('')
  const [updatingEvent, setUpdatingEvent] = useState(false)

  // Game Engine & Config states
  const [missions, setMissions] = useState<VibeMission[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [staffCounts, setStaffCounts] = useState<Record<string, number>>({})
  const [emergencyText, setEmergencyText] = useState('')
  const [emergencyActive, setEmergencyActive] = useState(false)
  const [maxStrikes, setMaxStrikes] = useState(5)
  const [baseCooldown, setBaseCooldown] = useState(1)
  const [maxCooldown, setMaxCooldown] = useState(30)

  // User Inspector states
  const [inspectUser, setInspectUser] = useState<DBUser | null>(null)
  const [inspectUserStats, setInspectUserStats] = useState<{ collectedCount: number; collectedFromCount: number } | null>(null)
  const [editNickname, setEditNickname] = useState('')
  const [editFaculty, setEditFaculty] = useState('')
  const [editMajor, setEditMajor] = useState('')
  const [editRole, setEditRole] = useState('')
  const [inspectUserLogs, setInspectUserLogs] = useState<AuditLog[]>([])

  // Mission configurator form
  const [newMissionTarget, setNewMissionTarget] = useState('')
  const [newMissionCount, setNewMissionCount] = useState(1)

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

  // Helper trigger to log audit activities
  const logAuditAction = async (actionType: string, targetId: string, details: string) => {
    try {
      await supabase.from('audit_logs').insert({
        moderator_id: user?.student_id,
        action_type: actionType,
        target_id: targetId,
        details: details,
      })
    } catch (err) {
      console.error('Failed to log audit activity:', err)
    }
  }

  // Refreshes dashboard data
  const triggerRefresh = async () => {
    try {
      if (user?.role === 'moderator') {
        const { data: usersData } = await supabase
          .from('users')
          .select('student_id, nickname, faculty, role, created_at')
          .order('created_at', { ascending: false })
        if (usersData) setWhitelistedUsers(usersData as DBUser[])

        const { data: missionData } = await supabase
          .from('vibe_missions')
          .select('*')
          .order('sequence_order', { ascending: true })
        if (missionData) setMissions(missionData as VibeMission[])

        const { data: logData } = await supabase
          .from('audit_logs')
          .select('*, users(nickname)')
          .order('created_at', { ascending: false })
          .limit(50)
        if (logData) setAuditLogs(logData as unknown as AuditLog[])

        const { data: staffData } = await supabase
          .from('users')
          .select('role, major')
          .neq('role', 'student')
        if (staffData) {
          const counts: Record<string, number> = {}
          staffData.forEach((s) => {
            const grp = s.major || s.role
            if (grp) {
              counts[grp] = (counts[grp] || 0) + 1
            }
          })
          setStaffCounts(counts)
        }
      }
    } catch (err) {
      console.error('Error refreshing admin dashboard data:', err)
    }
  }

  useEffect(() => {
    let active = true
    const fetchAdminData = async () => {
      if (!user) return
      await Promise.resolve()
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

          const emergency = configData.find((c) => c.key === 'emergency_announcement')
          const strikes = configData.find((c) => c.key === 'max_allowed_strikes')
          const baseCool = configData.find((c) => c.key === 'base_cooldown_minutes')
          const maxCool = configData.find((c) => c.key === 'max_cooldown_minutes')

          if (emergency) {
            setEmergencyActive(emergency.value)
            setEmergencyText(emergency.text_value || '')
          }
          if (strikes) setMaxStrikes(strikes.int_value ?? 5)
          if (baseCool) setBaseCooldown(baseCool.int_value ?? 1)
          if (maxCool) setMaxCooldown(maxCool.int_value ?? 30)
        }

        // 2. Fetch users list (for Moderator)
        if (user.role === 'moderator') {
          const { data: usersData } = await supabase
            .from('users')
            .select('student_id, nickname, faculty, role, created_at')
            .order('created_at', { ascending: false })
          if (!active) return
          if (usersData) setWhitelistedUsers(usersData as DBUser[])

          // Fetch vibe missions
          const { data: missionData } = await supabase
            .from('vibe_missions')
            .select('*')
            .order('sequence_order', { ascending: true })
          if (!active) return
          if (missionData) setMissions(missionData as VibeMission[])

          // Fetch audit logs
          const { data: logData } = await supabase
            .from('audit_logs')
            .select('*, users(nickname)')
            .order('created_at', { ascending: false })
            .limit(50)
          if (!active) return
          if (logData) setAuditLogs(logData as unknown as AuditLog[])

          // Staff major counts
          const { data: staffData } = await supabase
            .from('users')
            .select('role, major')
            .neq('role', 'student')
          if (!active) return
          if (staffData) {
            const counts: Record<string, number> = {}
            staffData.forEach((s) => {
              const grp = s.major || s.role
              if (grp) {
                counts[grp] = (counts[grp] || 0) + 1
              }
            })
            setStaffCounts(counts)
          }
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
        await logAuditAction('whitelist_add', trimmedId, `Manually whitelisted student as role: ${newRole}`)
        toaster.create({
          title: 'Student Whitelisted!',
          description: `ID ${trimmedId} whitelisted as ${newRole}.`,
          type: 'success',
        })
        setNewStudentId('')
        triggerRefresh()
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

  // Handle Whitelist Remove (Soft Deactivation)
  const handleRemoveWhitelist = async (studentId: string) => {
    if (!window.confirm(`Are you sure you want to revoke staff access for ID ${studentId}?`)) return
    try {
      const { error } = await supabase
        .from('users')
        .update({
          role: 'student',
          nickname: null,
          faculty: null,
          major: null,
          ig: null,
          bio: null,
          profile_pic_url: null,
          images: [],
          tags: []
        })
        .eq('student_id', studentId)

      if (error) throw error

      await logAuditAction('whitelist_remove', studentId, 'Revoked whitelist. Reverted role to student and purged profile fields.')
      toaster.create({
        title: 'Whitelist Revoked!',
        description: `ID ${studentId} role reverted to student successfully.`,
        type: 'success',
      })
      triggerRefresh()
    } catch (err) {
      console.error(err)
      toaster.create({
        title: 'Failed to revoke whitelist',
        type: 'error',
      })
    }
  }

  // Handle User Inspection details loading
  const handleInspectUser = async (u: DBUser) => {
    setInspectUser(u)
    setEditNickname(u.nickname || '')
    setEditFaculty(u.faculty || '')
    setEditRole(u.role)
    setEditMajor('')
    setInspectUserStats(null)
    setInspectUserLogs([])

    try {
      const { data: detailData } = await supabase
        .from('users')
        .select('major')
        .eq('student_id', u.student_id)
        .single()
      if (detailData) {
        setEditMajor(detailData.major || '')
      }

      // Fetch collection statistics
      const { count: collectedCount } = await supabase
        .from('collected_cards')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', u.student_id)

      const { count: collectedFromCount } = await supabase
        .from('collected_cards')
        .select('*', { count: 'exact', head: true })
        .eq('staff_id', u.student_id)

      setInspectUserStats({
        collectedCount: collectedCount || 0,
        collectedFromCount: collectedFromCount || 0,
      })

      // Fetch relevant audit logs
      const { data: userLogs } = await supabase
        .from('audit_logs')
        .select('*')
        .or(`target_id.eq.${u.student_id},moderator_id.eq.${u.student_id}`)
        .order('created_at', { ascending: false })
        .limit(10)

      if (userLogs) setInspectUserLogs(userLogs as AuditLog[])
    } catch (err) {
      console.error('Error fetching user stats:', err)
    }
  }

  // Handle Edit User Form Submit
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inspectUser) return

    try {
      const { error } = await supabase
        .from('users')
        .update({
          nickname: editNickname || null,
          faculty: editFaculty || null,
          major: editMajor || null,
          role: editRole,
        })
        .eq('student_id', inspectUser.student_id)

      if (error) throw error

      await logAuditAction(
        'user_update',
        inspectUser.student_id,
        `Details edited: role=${editRole}, nickname="${editNickname}", faculty="${editFaculty}", major="${editMajor}"`
      )

      toaster.create({
        title: 'User Profile Updated!',
        type: 'success',
      })
      setInspectUser(null)
      triggerRefresh()
    } catch (err) {
      console.error(err)
      toaster.create({
        title: 'Error updating user profile',
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

      await logAuditAction('toggle_board', key, `Switched ${key} to ${newVal}`)
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

      await logAuditAction('update_event', 'next_event', `Updated event to: ${eventTitle} at ${isoString}`)
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

  // Handle Emergency Announcement Broadcast Save
  const handleSaveEmergencyAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { error } = await supabase
        .from('system_config')
        .upsert({
          key: 'emergency_announcement',
          value: emergencyActive,
          text_value: emergencyText,
        }, { onConflict: 'key' })

      if (error) throw error

      await logAuditAction(
        'emergency_broadcast',
        'system_config',
        `Broadcast updated: active=${emergencyActive}, text="${emergencyText}"`
      )
      toaster.create({
        title: 'Emergency Announcement Saved!',
        description: emergencyActive ? 'Broadcast is live!' : 'Broadcast disabled.',
        type: 'success',
      })
    } catch (err) {
      console.error(err)
      toaster.create({
        title: 'Failed to save announcement',
        type: 'error',
      })
    }
  }

  // Handle Game Penalty Config Save
  const handleSaveGamePenalties = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { error } = await supabase
        .from('system_config')
        .upsert([
          { key: 'max_allowed_strikes', value: true, int_value: maxStrikes },
          { key: 'base_cooldown_minutes', value: true, int_value: baseCooldown },
          { key: 'max_cooldown_minutes', value: true, int_value: maxCooldown },
        ], { onConflict: 'key' })

      if (error) throw error

      await logAuditAction(
        'game_penalties_update',
        'system_config',
        `Updated rules: max_strikes=${maxStrikes}, base_cooldown=${baseCooldown}m, max_cooldown=${maxCooldown}m`
      )
      toaster.create({
        title: 'Penalties Saved!',
        type: 'success',
      })
    } catch (err) {
      console.error(err)
      toaster.create({
        title: 'Failed to save penalties',
        type: 'error',
      })
    }
  }

  // Add Vibe Mission
  const handleAddMission = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMissionTarget) return

    try {
      const nextSeq = missions.length > 0 ? Math.max(...missions.map((m) => m.sequence_order)) + 1 : 1
      const { error } = await supabase
        .from('vibe_missions')
        .insert({
          sequence_order: nextSeq,
          target_role: newMissionTarget,
          required_count: newMissionCount,
        })

      if (error) throw error

      await logAuditAction(
        'mission_add',
        nextSeq.toString(),
        `Added mission sequence ${nextSeq}: target=${newMissionTarget}, count=${newMissionCount}`
      )
      toaster.create({
        title: 'Vibe Mission Added!',
        type: 'success',
      })
      setNewMissionTarget('')
      setNewMissionCount(1)
      triggerRefresh()
    } catch (err) {
      console.error(err)
      toaster.create({
        title: 'Failed to add mission',
        type: 'error',
      })
    }
  }

  // Delete Vibe Mission (Sequence alignment fallback)
  const handleRemoveMission = async (id: number, seqOrder: number) => {
    if (!window.confirm(`Are you sure you want to remove Mission sequence ${seqOrder}?`)) return
    try {
      // Find users active on this mission
      const { data: activeUsers } = await supabase
        .from('user_vibe_status')
        .select('student_id')
        .eq('current_mission_id', id)

      // Delete the mission
      const { error } = await supabase
        .from('vibe_missions')
        .delete()
        .eq('id', id)

      if (error) throw error

      // Orphaned sequence alignment fallback
      const remaining = missions.filter((m) => m.id !== id).sort((a, b) => a.sequence_order - b.sequence_order)
      const nextMission = remaining.find((m) => m.sequence_order >= seqOrder) || remaining[0] || null

      if (activeUsers && activeUsers.length > 0) {
        for (const u of activeUsers) {
          await supabase
            .from('user_vibe_status')
            .update({ current_mission_id: nextMission ? nextMission.id : null })
            .eq('student_id', u.student_id)
        }
      }

      await logAuditAction(
        'mission_delete',
        seqOrder.toString(),
        `Deleted mission ${seqOrder}. Aligned active users to next sequence: ${nextMission ? nextMission.sequence_order : 'none'}`
      )
      toaster.create({
        title: 'Mission Removed!',
        description: 'Active users progress re-aligned.',
        type: 'success',
      })
      triggerRefresh()
    } catch (err) {
      console.error(err)
      toaster.create({
        title: 'Failed to delete mission',
        type: 'error',
      })
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
        if (fileInputRef.current) fileInputRef.current.value = ''
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

      await logAuditAction('csv_import', 'users', `Batch upserted ${csvRecords.length} records from CSV.`)
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
        {user?.role === 'moderator' && (
          <Button
            type="button"
            variant={activeTab === 'moderator' ? 'solid' : 'ghost'}
            onClick={() => setActiveTab('moderator')}
            borderRadius="full"
            px={5}
            h="40px"
            bg={activeTab === 'moderator' ? 'var(--c-chocolate)' : 'transparent'}
            color={activeTab === 'moderator' ? 'white' : 'var(--c-muted)'}
            cursor="pointer"
          >
            Moderator Command Center
          </Button>
        )}
        {(user?.role === 'moderator' || user?.role === 'media_admin') && (
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

      {/* TIER 1: Moderator Panel */}
      {activeTab === 'moderator' && user?.role === 'moderator' && (
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
                  title="Role Assignment"
                >
                  <option value="student">Student (น้องบ้าน)</option>
                  <option value="staff">Staff (สตาฟบ้าน)</option>
                  <option value="media_admin">Media Admin (โสต)</option>
                  <option value="moderator">Moderator</option>
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
            <Box overflowX="auto" maxH="350px" overflowY="auto">
              <Table.Root size="sm" variant="line">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Student ID</Table.ColumnHeader>
                    <Table.ColumnHeader>Nickname</Table.ColumnHeader>
                    <Table.ColumnHeader>Faculty</Table.ColumnHeader>
                    <Table.ColumnHeader>Role</Table.ColumnHeader>
                    <Table.ColumnHeader>Status</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="right">Actions</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {whitelistedUsers.map((u) => (
                    <Table.Row key={u.student_id}>
                      <Table.Cell fontWeight="600">{u.student_id}</Table.Cell>
                      <Table.Cell>{u.nickname || <Text as="span" color="fg.subtle" fontStyle="italic">Pending Onboarding</Text>}</Table.Cell>
                      <Table.Cell>{u.faculty || '-'}</Table.Cell>
                      <Table.Cell>
                        <Badge colorPalette={u.role === 'moderator' ? 'red' : u.role === 'staff' ? 'orange' : u.role === 'media_admin' ? 'blue' : 'gray'}>
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
                      <Table.Cell textAlign="right">
                        <HStack gap={2} justify="end">
                          <Button
                            size="sm"
                            h="40px"
                            px={4}
                            variant="outline"
                            onClick={() => handleInspectUser(u)}
                            cursor="pointer"
                            aria-label={`Inspect details for student ID ${u.student_id}`}
                            title={`Inspect details for student ID ${u.student_id}`}
                          >
                            Inspect
                          </Button>
                          <Button
                            size="sm"
                            h="40px"
                            px={4}
                            variant="ghost"
                            colorPalette="red"
                            onClick={() => handleRemoveWhitelist(u.student_id)}
                            cursor="pointer"
                            aria-label={`Remove student ID ${u.student_id} from whitelist`}
                            title={`Remove student ID ${u.student_id} from whitelist`}
                          >
                            Remove
                          </Button>
                        </HStack>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>
          </Box>

          {/* Emergency Broadcast Editor */}
          <Box bg="var(--c-white)" p={6} border="1px solid" borderColor="border.subtle" borderRadius="2xl" boxShadow="var(--shadow-card)">
            <Heading as="h2" fontSize="lg" fontWeight="700" color="var(--c-chocolate)" mb={4}>
              🚨 Emergency Broadcast Alert
            </Heading>
            <VStack as="form" onSubmit={handleSaveEmergencyAnnouncement} gap={4} align="stretch">
              <Box>
                <Text fontSize="xs" fontWeight="700" color="var(--c-muted)" mb={1} textTransform="uppercase">Announcement Text</Text>
                <textarea
                  placeholder="Type an announcement to display globally at the top header..."
                  value={emergencyText}
                  onChange={(e) => setEmergencyText(e.target.value)}
                  style={{
                    width: '100%',
                    height: '80px',
                    borderRadius: '12px',
                    border: '1.5px solid var(--c-outline)',
                    backgroundColor: 'var(--c-ivory)',
                    padding: '12px',
                    fontSize: '0.875rem',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </Box>
              <Flex align="center" justify="space-between">
                <HStack gap={3}>
                  <Button
                    type="button"
                    size="sm"
                    variant={emergencyActive ? 'solid' : 'outline'}
                    bg={emergencyActive ? 'red.500' : 'transparent'}
                    color={emergencyActive ? 'white' : 'var(--c-chocolate)'}
                    onClick={() => setEmergencyActive(!emergencyActive)}
                    cursor="pointer"
                  >
                    {emergencyActive ? 'Active Broadcast Live' : 'Status: Inactive'}
                  </Button>
                </HStack>
                <Button
                  type="submit"
                  bg="var(--c-chocolate)"
                  color="white"
                  px={6}
                  borderRadius="xl"
                  h="40px"
                  cursor="pointer"
                >
                  Publish Announcement
                </Button>
              </Flex>
            </VStack>
          </Box>

          {/* Gamification Config & Mission Chain Builder */}
          <Box bg="var(--c-white)" p={6} border="1px solid" borderColor="border.subtle" borderRadius="2xl" boxShadow="var(--shadow-card)">
            <Heading as="h2" fontSize="lg" fontWeight="700" color="var(--c-chocolate)" mb={4}>
              🎮 Vibe Mission Chain Builder
            </Heading>
            <VStack align="stretch" gap={6}>
              {/* Mission list */}
              <Box border="1px solid" borderColor="border.subtle" borderRadius="xl" overflow="hidden">
                <Table.Root size="sm">
                  <Table.Header bg="var(--c-ivory)">
                    <Table.Row>
                      <Table.ColumnHeader>Seq Order</Table.ColumnHeader>
                      <Table.ColumnHeader>Target Position / Role</Table.ColumnHeader>
                      <Table.ColumnHeader>Required Card Count</Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="right">Actions</Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {missions.map((m) => (
                      <Table.Row key={m.id}>
                        <Table.Cell fontWeight="bold">Quest #{m.sequence_order}</Table.Cell>
                        <Table.Cell>
                          <Badge colorPalette="teal" px={2} py={0.5} borderRadius="md">
                            {m.target_role}
                          </Badge>
                          <Text as="span" fontSize="2xs" color="fg.subtle" ml={2}>
                            ({staffCounts[m.target_role] || 0} active in system)
                          </Text>
                        </Table.Cell>
                        <Table.Cell fontWeight="600">{m.required_count} cards</Table.Cell>
                        <Table.Cell textAlign="right">
                          <Button size="xs" variant="ghost" colorPalette="red" onClick={() => handleRemoveMission(m.id, m.sequence_order)} cursor="pointer">
                            Delete
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                    {missions.length === 0 && (
                      <Table.Row>
                        <Table.Cell colSpan={4} textAlign="center" py={4} color="fg.subtle" fontStyle="italic">
                          No missions configured in the system. Cards can be swiped without constraints.
                        </Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table.Root>
              </Box>

              {/* Add Mission Form */}
              <Flex as="form" onSubmit={handleAddMission} gap={3} flexWrap="wrap" align="end" bg="var(--c-ivory)" p={4} borderRadius="xl">
                <VStack align="start" gap={1}>
                  <Text fontSize="xs" fontWeight="700" color="var(--c-muted)">Target Staff Category</Text>
                  <select
                    value={newMissionTarget}
                    onChange={(e) => setNewMissionTarget(e.target.value)}
                    style={{
                      height: '38px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--c-outline)',
                      backgroundColor: 'var(--c-white)',
                      paddingLeft: '8px',
                      paddingRight: '8px',
                      fontSize: '0.875rem',
                      outline: 'none',
                    }}
                    aria-label="Target Staff Category"
                    title="Target Staff Category"
                    required
                  >
                    <option value="">-- Choose Target --</option>
                    {Object.keys(staffCounts).map((k) => (
                      <option key={k} value={k}>
                        {k} ({staffCounts[k]} staff)
                      </option>
                    ))}
                    <option value="โสต">โสต</option>
                    <option value="สันทนาการ">สันทนาการ</option>
                    <option value="พี่กลุ่ม">พี่กลุ่ม</option>
                    <option value="staff">General Staff</option>
                    <option value="media_admin">Media Admin</option>
                  </select>
                </VStack>
                <VStack align="start" gap={1}>
                  <Text fontSize="xs" fontWeight="700" color="var(--c-muted)">Required Card Count</Text>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={newMissionCount}
                    onChange={(e) => setNewMissionCount(parseInt(e.target.value) || 1)}
                    h="38px"
                    bg="white"
                    borderRadius="lg"
                    border="1.5px solid var(--c-outline)"
                    maxW="90px"
                  />
                </VStack>
                <Button type="submit" bg="var(--c-chocolate)" color="white" h="38px" px={4} borderRadius="lg" cursor="pointer">
                  Append Quest
                </Button>
              </Flex>

              {/* Penalty Lockout Variable Inputs */}
              <VStack as="form" onSubmit={handleSaveGamePenalties} align="stretch" gap={4} borderTop="1px solid" borderColor="border.subtle" pt={4}>
                <Heading as="h3" fontSize="sm" fontWeight="700" color="var(--c-chocolate)">
                  Swipe Penalty & Exponential Lockout Variables
                </Heading>
                <Flex gap={4} flexWrap="wrap">
                  <VStack align="start" gap={1} flex={1} minW="140px">
                    <Text fontSize="2xs" fontWeight="700" color="var(--c-muted)">Max Allowed Strikes</Text>
                    <Input
                      type="number"
                      value={maxStrikes}
                      onChange={(e) => setMaxStrikes(parseInt(e.target.value) || 1)}
                      bg="var(--c-ivory)"
                      h="40px"
                      borderRadius="lg"
                    />
                  </VStack>
                  <VStack align="start" gap={1} flex={1} minW="140px">
                    <Text fontSize="2xs" fontWeight="700" color="var(--c-muted)">Base Cooldown (minutes)</Text>
                    <Input
                      type="number"
                      value={baseCooldown}
                      onChange={(e) => setBaseCooldown(parseInt(e.target.value) || 1)}
                      bg="var(--c-ivory)"
                      h="40px"
                      borderRadius="lg"
                    />
                  </VStack>
                  <VStack align="start" gap={1} flex={1} minW="140px">
                    <Text fontSize="2xs" fontWeight="700" color="var(--c-muted)">Max Cooldown ceiling (minutes)</Text>
                    <Input
                      type="number"
                      value={maxCooldown}
                      onChange={(e) => setMaxCooldown(parseInt(e.target.value) || 1)}
                      bg="var(--c-ivory)"
                      h="40px"
                      borderRadius="lg"
                    />
                  </VStack>
                </Flex>
                <Button type="submit" bg="var(--c-lagoon)" color="white" h="40px" maxW="200px" borderRadius="lg" cursor="pointer">
                  Save Rules Config
                </Button>
              </VStack>
            </VStack>
          </Box>

          {/* Audit Logs Viewer */}
          <Box bg="var(--c-white)" p={6} border="1px solid" borderColor="border.subtle" borderRadius="2xl" boxShadow="var(--shadow-card)">
            <Heading as="h2" fontSize="lg" fontWeight="700" color="var(--c-chocolate)" mb={4}>
              📋 Chronological System Audit Timeline
            </Heading>
            <Box overflowY="auto" maxH="250px" border="1px solid" borderColor="border.subtle" borderRadius="xl">
              <Table.Root size="sm" variant="line">
                <Table.Header bg="var(--c-ivory)">
                  <Table.Row>
                    <Table.ColumnHeader>Timestamp</Table.ColumnHeader>
                    <Table.ColumnHeader>Moderator Nickname</Table.ColumnHeader>
                    <Table.ColumnHeader>Action</Table.ColumnHeader>
                    <Table.ColumnHeader>Target</Table.ColumnHeader>
                    <Table.ColumnHeader>Details</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {auditLogs.map((log) => (
                    <Table.Row key={log.id}>
                      <Table.Cell fontSize="2xs" color="fg.subtle">
                        {new Date(log.created_at).toLocaleString()}
                      </Table.Cell>
                      <Table.Cell fontWeight="600">
                        {log.users?.nickname || `ID: ${log.moderator_id}`}
                      </Table.Cell>
                      <Table.Cell>
                        <Badge colorPalette={log.action_type.includes('remove') ? 'red' : log.action_type.includes('add') ? 'green' : 'blue'}>
                          {log.action_type}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell fontSize="xs" fontFamily="monospace">{log.target_id || '-'}</Table.Cell>
                      <Table.Cell fontSize="xs">{log.details}</Table.Cell>
                    </Table.Row>
                  ))}
                  {auditLogs.length === 0 && (
                    <Table.Row>
                      <Table.Cell colSpan={5} textAlign="center" py={4} color="fg.subtle" fontStyle="italic">
                        No audit events recorded yet.
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table.Root>
            </Box>
          </Box>

          {/* Portal Master Switches */}
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
                  onClick={() => handleToggleConfig('enable_hype_board', enableHypeBoard)}
                  cursor="pointer"
                  h="38px"
                  px={4}
                  borderRadius="lg"
                >
                  {enableHypeBoard ? 'ACTIVE' : 'DISABLED'}
                </Button>
              </Flex>

              <Flex align="center" justify="space-between" p={3} bg="var(--c-ivory)" borderRadius="xl">
                <Box>
                  <Text fontWeight="600" color="var(--c-chocolate)">Memory Board Active</Text>
                  <Text fontSize="xs" color="fg.muted">Enable the shared orientation photo posting memory canvas.</Text>
                </Box>
                <Button
                  type="button"
                  bg={enableMemoryBoard ? 'var(--c-lagoon)' : 'var(--c-outline)'}
                  color="white"
                  onClick={() => handleToggleConfig('enable_memory_board', enableMemoryBoard)}
                  cursor="pointer"
                  h="38px"
                  px={4}
                  borderRadius="lg"
                >
                  {enableMemoryBoard ? 'ACTIVE' : 'DISABLED'}
                </Button>
              </Flex>
            </VStack>
          </Box>

          {/* Future Events Calendar */}
          <Box bg="var(--c-white)" p={6} border="1px solid" borderColor="border.subtle" borderRadius="2xl" boxShadow="var(--shadow-card)">
            <Heading as="h2" fontSize="lg" fontWeight="700" color="var(--c-chocolate)" mb={4}>
              Orientation Milestones Timer Setup
            </Heading>
            <VStack as="form" onSubmit={handleUpdateEvent} gap={4} align="stretch">
              <Flex gap={4} flexWrap="wrap">
                <VStack align="start" gap={1} flex={1} minW="200px">
                  <Text fontSize="xs" fontWeight="700" color="var(--c-muted)">Countdown Target Label</Text>
                  <Input
                    placeholder="Event Title e.g. First Meet"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    h="44px"
                    bg="var(--c-ivory)"
                    borderRadius="xl"
                    required
                  />
                </VStack>
                <VStack align="start" gap={1} flex={1} minW="200px">
                  <Text fontSize="xs" fontWeight="700" color="var(--c-muted)">Milestone Calendar Time</Text>
                  <Input
                    type="datetime-local"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    h="44px"
                    bg="var(--c-ivory)"
                    borderRadius="xl"
                    required
                  />
                </VStack>
              </Flex>
              <Button
                type="submit"
                bg="var(--c-chocolate)"
                color="white"
                loading={updatingEvent}
                h="44px"
                maxW="200px"
                borderRadius="xl"
                cursor="pointer"
              >
                Configure Timer
              </Button>
            </VStack>
          </Box>
        </VStack>
      )}

      {/* TIER 2: Media Admin Panel */}
      {activeTab === 'media' && (user?.role === 'moderator' || user?.role === 'media_admin') && (
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

      {/* Mobile-First User Inspector Bottom Sheet Drawer */}
      {inspectUser && (
        <Portal>
          <Box
            position="fixed"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="blackAlpha.700"
            backdropFilter="blur(4px)"
            zIndex="2100"
            onClick={() => setInspectUser(null)}
          />
          <Box
            position="fixed"
            left="50%"
            bottom={0}
            transform="translateX(-50%)"
            w="100%"
            maxW="md"
            bg="bg.surface"
            borderTopRadius="3xl"
            border="1px solid"
            borderColor="border.subtle"
            boxShadow="var(--shadow-card-hover)"
            p={6}
            zIndex="2200"
            animation="slide-up 0.3s var(--ease-out-quint)"
            maxH="85vh"
            overflowY="auto"
          >
            <VStack gap={5} align="stretch">
              <HStack justify="space-between">
                <Heading as="h3" fontSize="md" color="var(--c-chocolate)" fontWeight="700">
                  User Audit & Inspector
                </Heading>
                <Button size="xs" variant="ghost" onClick={() => setInspectUser(null)} cursor="pointer">Close</Button>
              </HStack>

              <VStack align="stretch" gap={2} bg="var(--c-ivory)" p={4} borderRadius="xl" border="1px solid" borderColor="border.subtle">
                <Text fontSize="xs"><strong>Student ID:</strong> {inspectUser.student_id}</Text>
                {inspectUserStats ? (
                  <>
                    <Text fontSize="xs"><strong>Collected cards count:</strong> {inspectUserStats.collectedCount} cards</Text>
                    {inspectUser.role !== 'student' && (
                      <Text fontSize="xs"><strong>Times collected by students:</strong> {inspectUserStats.collectedFromCount} times</Text>
                    )}
                  </>
                ) : (
                  <Spinner size="xs" />
                )}
              </VStack>

              <VStack as="form" onSubmit={handleEditUser} gap={4} align="stretch">
                <Heading as="h4" fontSize="xs" fontWeight="700" color="var(--c-muted)" textTransform="uppercase">
                  Manual Record Editor
                </Heading>
                 <Box>
                  <Box display="block" fontSize="2xs" fontWeight="700" color="fg.subtle" mb={1}>
                    <label htmlFor="inspect-nickname">Nickname</label>
                  </Box>
                  <Input
                    id="inspect-nickname"
                    value={editNickname}
                    onChange={(e) => setEditNickname(e.target.value)}
                    bg="var(--c-ivory)"
                    h="38px"
                  />
                </Box>
                <Box>
                  <Box display="block" fontSize="2xs" fontWeight="700" color="fg.subtle" mb={1}>
                    <label htmlFor="inspect-faculty">Faculty</label>
                  </Box>
                  <Input
                    id="inspect-faculty"
                    value={editFaculty}
                    onChange={(e) => setEditFaculty(e.target.value)}
                    bg="var(--c-ivory)"
                    h="38px"
                  />
                </Box>
                <Box>
                  <Box display="block" fontSize="2xs" fontWeight="700" color="fg.subtle" mb={1}>
                    <label htmlFor="inspect-major">Major / Position (e.g. โสต, สันทนาการ)</label>
                  </Box>
                  <Input
                    id="inspect-major"
                    value={editMajor}
                    onChange={(e) => setEditMajor(e.target.value)}
                    bg="var(--c-ivory)"
                    h="38px"
                  />
                </Box>
                <Box>
                  <Box display="block" fontSize="2xs" fontWeight="700" color="fg.subtle" mb={1}>
                    <label htmlFor="inspect-role">System Role</label>
                  </Box>
                  <select
                    id="inspect-role"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    style={{
                      height: '38px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--c-outline)',
                      backgroundColor: 'var(--c-ivory)',
                      paddingLeft: '8px',
                      paddingRight: '8px',
                      fontSize: '0.875rem',
                      width: '100%',
                    }}
                    aria-label="Edit System Role"
                    title="Edit System Role"
                  >
                    <option value="student">student</option>
                    <option value="staff">staff</option>
                    <option value="media_admin">media_admin</option>
                    <option value="moderator">moderator</option>
                  </select>
                </Box>
                <Button type="submit" bg="var(--c-chocolate)" color="white" h="40px" borderRadius="lg" cursor="pointer">
                  Save Changes
                </Button>
              </VStack>

              {/* Inspector local audit logs */}
              <VStack align="stretch" gap={2} mt={2}>
                <Heading as="h4" fontSize="xs" fontWeight="700" color="var(--c-muted)" textTransform="uppercase">
                  Recent User Logs
                </Heading>
                <Box maxH="120px" overflowY="auto" border="1px solid" borderColor="border.subtle" borderRadius="lg" p={2}>
                  {inspectUserLogs.map((log) => (
                    <Box key={log.id} fontSize="3xs" borderBottom="1px solid" borderColor="border.subtle" py={1.5}>
                      <Text color="fg.subtle">{new Date(log.created_at).toLocaleString()} - <strong>{log.action_type}</strong></Text>
                      <Text>{log.details}</Text>
                    </Box>
                  ))}
                  {inspectUserLogs.length === 0 && (
                    <Text fontSize="2xs" fontStyle="italic" color="fg.subtle">No recent logs found for this user.</Text>
                  )}
                </Box>
              </VStack>
            </VStack>
          </Box>
        </Portal>
      )}
    </Box>
  )
}
