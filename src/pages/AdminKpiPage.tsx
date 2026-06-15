import { useState, useEffect } from 'react'
import {
  Box,
  Flex,
  Heading,
  Text,
  VStack,
  SimpleGrid,
  Spinner,
} from '@chakra-ui/react'
import { supabase } from '../lib/supabase'

interface KPIData {
  totalUsers: number;
  totalStudents: number;
  totalStaff: number;
  totalWhitelisted: number;
  totalPosts: number;
  totalComments: number;
  totalVibeChecks: number;
}

export function AdminKpiPage() {
  const [kpi, setKpi] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchKPI() {
      try {
        const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
        const { count: totalStudents } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student');
        const { count: totalStaff } = await supabase.from('users').select('*', { count: 'exact', head: true }).neq('role', 'student');
        const { count: totalWhitelisted } = await supabase.from('whitelist').select('*', { count: 'exact', head: true });
        const { count: totalPosts } = await supabase.from('posts').select('*', { count: 'exact', head: true });
        const { count: totalComments } = await supabase.from('comments').select('*', { count: 'exact', head: true });
        const { count: totalVibeChecks } = await supabase.from('collected_cards').select('*', { count: 'exact', head: true });
        
        setKpi({
          totalUsers: totalUsers || 0,
          totalStudents: totalStudents || 0,
          totalStaff: totalStaff || 0,
          totalWhitelisted: totalWhitelisted || 0,
          totalPosts: totalPosts || 0,
          totalComments: totalComments || 0,
          totalVibeChecks: totalVibeChecks || 0,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchKPI();
  }, []);

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
          <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} gap={6}>
            <KPICard title="Total Registered Users" value={kpi.totalUsers} icon="group" color="var(--c-lagoon)" />
            <KPICard title="Total Students" value={kpi.totalStudents} icon="school" color="var(--c-lagoon)" />
            <KPICard title="Total Staff & Mods" value={kpi.totalStaff} icon="shield_person" color="var(--c-lagoon)" />
            <KPICard title="Whitelisted Guests" value={kpi.totalWhitelisted} icon="how_to_reg" color="var(--c-orange)" />
            <KPICard title="Total Posts" value={kpi.totalPosts} icon="post_add" color="var(--c-chocolate)" />
            <KPICard title="Total Comments" value={kpi.totalComments} icon="forum" color="var(--c-chocolate)" />
            <KPICard title="Vibe Checks Completed" value={kpi.totalVibeChecks} icon="verified" color="green.600" />
          </SimpleGrid>
        ) : (
          <Text color="red.500">Failed to load KPI data.</Text>
        )}
      </VStack>
    </Box>
  )
}

function KPICard({ title, value, icon, color }: { title: string, value: number, icon: string, color: string }) {
  return (
    <Box bg="var(--c-white)" p={6} borderRadius="2xl" border="1px solid" borderColor="border.subtle" boxShadow="var(--shadow-card)" transition="all 0.3s" _hover={{ transform: 'translateY(-4px)', boxShadow: 'var(--shadow-lagoon)' }}>
      <Flex align="center" gap={4} mb={4}>
        <Box w="48px" h="48px" borderRadius="full" bg={`color-mix(in srgb, ${color} 15%, transparent)`} display="flex" alignItems="center" justifyContent="center">
          <Box as="span" className="material-symbols-outlined" color={color} fontSize="24px">
            {icon}
          </Box>
        </Box>
        <Text fontSize="sm" fontWeight="700" color="fg.subtle">{title}</Text>
      </Flex>
      <Text fontSize="4xl" fontWeight="800" color="var(--c-ink)">{value.toLocaleString()}</Text>
    </Box>
  )
}
