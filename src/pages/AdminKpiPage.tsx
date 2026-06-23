import { useState, useEffect } from 'react'
import {
  Box,
  Flex,
  Heading,
  Text,
  VStack,
  SimpleGrid,
  Spinner,
  Badge,
  StatRoot,
  StatLabel,
  StatValueText,
} from '@chakra-ui/react'
import { supabase } from '../lib/supabase'

interface KPIData {
  totalUsers: number; // total registered users
  totalStudents: number; // total whitelisted students
  totalStaff: number; // total staff & mods
  totalWhitelisted: number; // total whitelisted entries
  totalPosts: number;
  totalComments: number;
  totalVibeChecks: number;
  totalChats: number; // total chat volume
  registeredStudents: number; // registered students (role='student' and pin_hash IS NOT NULL)
}

interface RealtimeUserPayload {
  student_id: string;
  role?: string | null;
  pin_hash?: string | null;
}

export function AdminKpiPage() {
  const [kpi, setKpi] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function fetchKPI() {
      try {
        const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true }).not('pin_hash', 'is', null);
        const { count: totalStudents } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student');
        const { count: totalStaff } = await supabase.from('users').select('*', { count: 'exact', head: true }).neq('role', 'student');
        const { count: totalWhitelisted } = await supabase.from('users').select('*', { count: 'exact', head: true });
        const { count: totalPosts } = await supabase.from('posts').select('*', { count: 'exact', head: true });
        const { count: totalComments } = await supabase.from('post_comments').select('*', { count: 'exact', head: true });
        const { count: totalVibeChecks } = await supabase.from('collected_cards').select('*', { count: 'exact', head: true });
        const { count: totalChats } = await supabase.from('live_chats').select('*', { count: 'exact', head: true });
        const { count: registeredStudents } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student').not('pin_hash', 'is', null);

        if (active) {
          setKpi({
            totalUsers: totalUsers || 0,
            totalStudents: totalStudents || 0,
            totalStaff: totalStaff || 0,
            totalWhitelisted: totalWhitelisted || 0,
            totalPosts: totalPosts || 0,
            totalComments: totalComments || 0,
            totalVibeChecks: totalVibeChecks || 0,
            totalChats: totalChats || 0,
            registeredStudents: registeredStudents || 0,
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    fetchKPI();

    // Supabase Realtime Accumulator Stream
    const kpiChannel = supabase.channel('live_chat:kpi_realtime_accumulator');

    kpiChannel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        (payload) => {
          setKpi((prev) => {
            if (!prev) return prev;
            let { totalUsers, totalStudents, totalStaff, totalWhitelisted, registeredStudents } = prev;
            if (payload.eventType === 'INSERT') {
              const newUser = payload.new as unknown as RealtimeUserPayload;
              totalWhitelisted += 1;
              if (newUser.role === 'student') {
                totalStudents += 1;
                if (newUser.pin_hash) registeredStudents += 1;
              } else {
                totalStaff += 1;
              }
              if (newUser.pin_hash) totalUsers += 1;
            } else if (payload.eventType === 'UPDATE') {
              const oldUser = payload.old as unknown as RealtimeUserPayload;
              const newUser = payload.new as unknown as RealtimeUserPayload;
              // Check registration transition
              if (!oldUser?.pin_hash && newUser.pin_hash) {
                totalUsers += 1;
                if (newUser.role === 'student') registeredStudents += 1;
              } else if (oldUser?.pin_hash && !newUser.pin_hash) {
                totalUsers -= 1;
                if (newUser.role === 'student') registeredStudents -= 1;
              }
              // Check role transition
              if (oldUser?.role === 'student' && newUser.role !== 'student') {
                totalStudents -= 1;
                if (oldUser.pin_hash) registeredStudents -= 1;
                totalStaff += 1;
              } else if (oldUser?.role !== 'student' && newUser.role === 'student') {
                totalStudents += 1;
                if (newUser.pin_hash) registeredStudents += 1;
                totalStaff -= 1;
              }
            } else if (payload.eventType === 'DELETE') {
              const oldUser = payload.old as unknown as RealtimeUserPayload;
              totalWhitelisted -= 1;
              if (oldUser.role === 'student') {
                totalStudents -= 1;
                if (oldUser.pin_hash) registeredStudents -= 1;
              } else {
                totalStaff -= 1;
              }
              if (oldUser.pin_hash) totalUsers -= 1;
            }
            return { ...prev, totalUsers, totalStudents, totalStaff, totalWhitelisted, registeredStudents };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        (payload) => {
          setKpi((prev) => {
            if (!prev) return prev;
            let diff = 0;
            if (payload.eventType === 'INSERT') diff = 1;
            if (payload.eventType === 'DELETE') diff = -1;
            return { ...prev, totalPosts: prev.totalPosts + diff };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_comments' },
        (payload) => {
          setKpi((prev) => {
            if (!prev) return prev;
            let diff = 0;
            if (payload.eventType === 'INSERT') diff = 1;
            if (payload.eventType === 'DELETE') diff = -1;
            return { ...prev, totalComments: prev.totalComments + diff };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'collected_cards' },
        (payload) => {
          setKpi((prev) => {
            if (!prev) return prev;
            let diff = 0;
            if (payload.eventType === 'INSERT') diff = 1;
            if (payload.eventType === 'DELETE') diff = -1;
            return { ...prev, totalVibeChecks: prev.totalVibeChecks + diff };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_chats' },
        (payload) => {
          setKpi((prev) => {
            if (!prev) return prev;
            let diff = 0;
            if (payload.eventType === 'INSERT') diff = 1;
            if (payload.eventType === 'DELETE') diff = -1;
            return { ...prev, totalChats: prev.totalChats + diff };
          });
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(kpiChannel);
    };
  }, []);

  const onboardingRate = kpi && kpi.totalStudents > 0 
    ? (kpi.registeredStudents / kpi.totalStudents) * 100 
    : 0;

  const engagementIndex = kpi 
    ? kpi.totalChats + kpi.totalPosts + kpi.totalComments + kpi.totalVibeChecks 
    : 0;

  return (
    <Box maxW="1200px" mx="auto" px={{ base: 4, md: 8 }} py={8}>
      <VStack align="stretch" gap={8}>
        <Flex justify="space-between" align="center" wrap="wrap" gap={4}>
          <Box>
            <Heading as="h1" fontSize={{ base: "2xl", md: "3xl" }} color="var(--c-ink)" fontFamily="heading" mb={2}>
              Platform KPI Dashboard
            </Heading>
            <Text color="fg.subtle">Real-time metrics and system health overview.</Text>
          </Box>
        </Flex>

        {loading ? (
          <Flex justify="center" p={12}>
            <Spinner size="xl" color="var(--c-lagoon)" />
          </Flex>
        ) : kpi ? (
          <VStack align="stretch" gap={8}>
            {/* Live Progress Bar Widget */}
            <Box 
              bg="var(--c-white)" 
              p={6} 
              borderRadius="2xl" 
              border="1.5px solid var(--c-lagoon-light)" 
              boxShadow="var(--shadow-card)"
            >
              <Flex justify="space-between" align="center" mb={3} wrap="wrap" gap={2}>
                <Box>
                  <Text fontSize="sm" fontWeight="700" color="var(--c-lagoon)">
                    Freshmen Onboarding Progress
                  </Text>
                  <Text fontSize="xs" color="fg.subtle">
                    Ratio of registered students to total whitelisted students
                  </Text>
                </Box>
                <Badge colorPalette="teal" fontSize="sm" py={1} px={3} borderRadius="full">
                  {onboardingRate.toFixed(1)}% Registered
                </Badge>
              </Flex>
              <Box w="100%" h="16px" bg="rgba(73, 98, 104, 0.08)" borderRadius="full" overflow="hidden" position="relative">
                <Box 
                  w={`${onboardingRate}%`} 
                  h="100%" 
                  bg="var(--c-lagoon)" 
                  borderRadius="full" 
                />
              </Box>
              <Flex justify="space-between" mt={2} fontSize="xs" color="fg.subtle" fontWeight="600">
                <Text>{kpi.registeredStudents} Registered</Text>
                <Text>{kpi.totalStudents} Whitelisted Students</Text>
              </Flex>
            </Box>

            {/* Platform KPI Grid */}
            <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} gap={6}>
              <KPICard title="Total Registered Users" value={kpi.totalUsers} icon="group" color="var(--c-lagoon)" />
              <KPICard title="Total Students" value={kpi.totalStudents} icon="school" color="var(--c-lagoon)" />
              <KPICard title="Total Staff & Mods" value={kpi.totalStaff} icon="shield_person" color="var(--c-lagoon)" />
              <KPICard title="Whitelisted Guests" value={kpi.totalWhitelisted} icon="how_to_reg" color="var(--c-orange)" />
              <KPICard title="Total Posts" value={kpi.totalPosts} icon="post_add" color="var(--c-chocolate)" />
              <KPICard title="Total Comments" value={kpi.totalComments} icon="forum" color="var(--c-chocolate)" />
              <KPICard title="Vibe Checks Completed" value={kpi.totalVibeChecks} icon="verified" color="green.600" />
              <KPICard title="Total Chat Volume" value={kpi.totalChats} icon="chat_bubble" color="var(--c-orange)" />
            </SimpleGrid>

            {/* Interactive Engagement Index Widget */}
            <Box 
              bg="var(--c-white)" 
              p={6} 
              borderRadius="2xl" 
              border="1px solid" 
              borderColor="border.subtle" 
              boxShadow="var(--shadow-card)"
            >
              <Heading as="h2" fontSize="md" color="var(--c-chocolate)" mb={4} fontWeight="700" fontFamily="heading">
                Interactive Engagement Index
              </Heading>
              <SimpleGrid columns={{ base: 1, md: 2 }} gap={8} alignItems="center">
                <VStack align="stretch" gap={4}>
                  <Box>
                    <Text fontSize="sm" color="fg.subtle">Accumulated Interactions</Text>
                    <Text fontSize="4xl" fontWeight="800" color="var(--c-ink)">
                      {engagementIndex.toLocaleString()}
                    </Text>
                  </Box>
                  <Text fontSize="xs" color="fg.subtle" maxW="60ch">
                    The Engagement Index measures all active touchpoints across the platform including live chat messages, discussion board posts, comments, and completed VibeQuest card checks.
                  </Text>
                </VStack>
                
                <VStack align="stretch" gap={3}>
                  <EngagementBar label="Chat Messages" value={kpi.totalChats} max={engagementIndex} color="var(--c-orange)" />
                  <EngagementBar label="Memory & Hype Posts" value={kpi.totalPosts} max={engagementIndex} color="var(--c-chocolate)" />
                  <EngagementBar label="Post Comments" value={kpi.totalComments} max={engagementIndex} color="var(--c-chocolate)" />
                  <EngagementBar label="Completed Vibe Checks" value={kpi.totalVibeChecks} max={engagementIndex} color="green.600" />
                </VStack>
              </SimpleGrid>
            </Box>
          </VStack>
        ) : (
          <Text color="red.500">Failed to load KPI data.</Text>
        )}
      </VStack>
    </Box>
  )
}

function KPICard({ title, value, icon, color }: { title: string, value: number, icon: string, color: string }) {
  return (
    <StatRoot
      bg="var(--c-white)" 
      p={6} 
      borderRadius="xl" 
      border="1px solid" 
      borderColor="border.subtle" 
      boxShadow="sm"
      transition="all 0.2s" 
      _hover={{ transform: 'translateY(-2px)', boxShadow: 'md' }}
    >
      <Flex align="center" justify="space-between" mb={3}>
        <StatLabel fontSize="xs" fontWeight="700" color="fg.subtle" textTransform="uppercase" letterSpacing="wider">{title}</StatLabel>
        <Box 
          w="36px" 
          h="36px" 
          borderRadius="lg" 
          bg={`color-mix(in srgb, ${color} 12%, transparent)`} 
          display="flex" 
          alignItems="center" 
          justifyContent="center"
        >
          <Box as="span" className="material-symbols-outlined" color={color} fontSize="20px">
            {icon}
          </Box>
        </Box>
      </Flex>
      <StatValueText fontSize="2xl" fontWeight="800" color="var(--c-ink)" fontFamily="heading">
        {value.toLocaleString()}
      </StatValueText>
    </StatRoot>
  )
}

function EngagementBar({ label, value, max, color }: { label: string, value: number, max: number, color: string }) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  return (
    <Box>
      <Flex justify="space-between" fontSize="xs" fontWeight="700" mb={1}>
        <Text color="fg.subtle">{label}</Text>
        <Text color="var(--c-ink)">{value.toLocaleString()} ({percentage.toFixed(0)}%)</Text>
      </Flex>
      <Box w="100%" h="8px" bg="rgba(0,0,0,0.04)" borderRadius="full" overflow="hidden">
        <Box 
          w={`${percentage}%`} 
          h="100%" 
          bg={color} 
          borderRadius="full" 
        />
      </Box>
    </Box>
  )
}
