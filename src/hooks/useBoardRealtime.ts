import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { toaster } from '../components/ui/toaster'
import type { User } from '../context/UserContext'

// ─── Types ───────────────────────────────────────────────────────────────────

export type BoardTab = 'hype' | 'memory'

export interface DBPost {
  id: number
  content: string
  createdAt: string
  likes: number
  tags: string[]
  is_anonymous: boolean
  is_hidden: boolean
  student_id: string
  type: BoardTab
  author: {
    student_id: string
    nickname: string | null
    avatar_color: string
    role: string
  }
}

export interface UseBoardRealtimeReturn {
  posts: DBPost[]
  loading: boolean
  submitting: boolean
  hypeActive: boolean
  memoryActive: boolean
  onlineCount: number
  handleCreatePost: (content: string, tags: string[], isAnon: boolean) => Promise<void>
  handleLikePost: (postId: number) => Promise<void>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPost(p: any): DBPost {
  return {
    id: Number(p.id),
    content: p.content,
    createdAt: p.created_at,
    likes: p.likes ?? 0,
    tags: Array.isArray(p.tags) ? p.tags : (p.tags ? [p.tags] : ['orientation']),
    is_anonymous: p.is_anonymous ?? false,
    is_hidden: p.is_hidden ?? false,
    student_id: p.student_id,
    type: p.type as BoardTab,
    author: {
      student_id: p.author?.student_id ?? '',
      nickname: p.author?.nickname ?? 'Guest Whitelist',
      avatar_color: p.author?.avatar_color ?? '#496268',
      role: p.author?.role ?? 'student',
    },
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useBoardRealtime(activeTab: BoardTab, user: User | null): UseBoardRealtimeReturn {
  const [posts, setPosts] = useState<DBPost[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [hypeActive, setHypeActive] = useState(true)
  const [memoryActive, setMemoryActive] = useState(true)
  const [onlineCount, setOnlineCount] = useState(1)

  // Track optimistic like origins so we don't double-apply realtime UPDATE
  const pendingLikes = useRef<Set<number>>(new Set())

  // ── Initial fetch ──────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true

    const fetchInitial = async () => {
      setLoading(true)
      try {
        // Feature toggles
        const { data: configData } = await supabase.from('system_config').select('*')
        if (!active) return

        if (configData) {
          const hype = configData.find((c) => c.key === 'enable_hype_board')
          const memory = configData.find((c) => c.key === 'enable_memory_board')
          if (hype) setHypeActive(hype.value)
          if (memory) setMemoryActive(memory.value)
        }

        // Posts snapshot for current tab
        const { data, error } = await supabase
          .from('posts')
          .select('*, author:users(student_id, nickname, avatar_color, role)')
          .eq('type', activeTab)
          .eq('is_hidden', false)
          .order('created_at', { ascending: false })

        if (error) throw error
        if (!active) return

        setPosts((data ?? []).map(mapPost))
      } catch (err) {
        console.error('[Board] Initial fetch error:', err)
        toaster.create({
          title: 'Error loading posts',
          description: 'Could not fetch board entries. Please try refreshing.',
          type: 'error',
        })
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchInitial()
    return () => { active = false }
  }, [activeTab]) // Re-fetch when tab switches

  // ── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    const channelName = `board-${activeTab}`

    const channel = supabase
      .channel(channelName, {
        config: { presence: { key: user?.student_id ?? 'anon' } },
      })
      // ── INSERT: new post ──
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts', filter: `type=eq.${activeTab}` },
        async (payload) => {
          if (payload.new.is_hidden) return

          // Fetch with author join (Realtime payload won't include joined relations)
          const { data } = await supabase
            .from('posts')
            .select('*, author:users(student_id, nickname, avatar_color, role)')
            .eq('id', payload.new.id)
            .single()

          if (data) {
            const incoming = mapPost(data)
            // Avoid duplicate if current user just posted (already optimistically added)
            setPosts((prev) => {
              if (prev.some((p) => p.id === incoming.id)) return prev
              return [incoming, ...prev]
            })
          }
        }
      )
      // ── UPDATE: likes or admin hide ──
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'posts', filter: `type=eq.${activeTab}` },
        (payload) => {
          const updated = payload.new

          // Admin hid this post — evict from all clients instantly
          if (updated.is_hidden) {
            setPosts((prev) => prev.filter((p) => p.id !== updated.id))
            return
          }

          // Like update — skip if we originated this change (optimistic already applied)
          if (pendingLikes.current.has(updated.id)) {
            pendingLikes.current.delete(updated.id)
            return
          }

          setPosts((prev) =>
            prev.map((p) =>
              p.id === updated.id ? { ...p, likes: updated.likes ?? p.likes } : p
            )
          )
        }
      )
      // ── DELETE: hard delete ──
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'posts', filter: `type=eq.${activeTab}` },
        (payload) => {
          setPosts((prev) => prev.filter((p) => p.id !== payload.old.id))
        }
      )
      // ── Presence: live viewer count ──
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setOnlineCount(Object.keys(state).length)
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        setOnlineCount((prev) => prev + newPresences.length)
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        setOnlineCount((prev) => Math.max(1, prev - leftPresences.length))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && user) {
          await channel.track({
            user_id: user.student_id,
            online_at: new Date().toISOString(),
          })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeTab, user])

  // ── Create post ───────────────────────────────────────────────────────────
  const handleCreatePost = useCallback(
    async (content: string, tags: string[], isAnon: boolean) => {
      if (!user) {
        toaster.create({
          title: 'Sign In Required',
          description: 'Please sign in to share your orientation vibes!',
          type: 'warning',
        })
        return
      }

      setSubmitting(true)
      try {
        const { data, error } = await supabase
          .from('posts')
          .insert({
            content: content.trim(),
            student_id: user.student_id,
            tags,
            type: activeTab,
            is_anonymous: isAnon,
          })
          .select('*, author:users(student_id, nickname, avatar_color, role)')
          .single()

        if (error) throw error

        if (data) {
          // Optimistic prepend — realtime INSERT will arrive shortly, dedup guard prevents double
          setPosts((prev) => {
            const newPost = mapPost(data)
            if (prev.some((p) => p.id === newPost.id)) return prev
            return [newPost, ...prev]
          })

          toaster.create({
            title: activeTab === 'hype' ? '🔥 Hype posted!' : '📌 Memory pinned!',
            description: 'Your message is live on the board.',
            type: 'success',
          })
        }
      } catch (err) {
        console.error('[Board] Post creation error:', err)
        toaster.create({ title: 'Error posting message', type: 'error' })
      } finally {
        setSubmitting(false)
      }
    },
    [user, activeTab]
  )

  // ── Like post (optimistic) ────────────────────────────────────────────────
  const handleLikePost = useCallback(
    async (postId: number) => {
      const match = posts.find((p) => p.id === postId)
      if (!match) return

      const nextLikes = match.likes + 1

      // Optimistic local update
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likes: nextLikes } : p)))

      // Mark as self-originated so the realtime UPDATE won't double-apply
      pendingLikes.current.add(postId)

      try {
        const { error } = await supabase
          .from('posts')
          .update({ likes: nextLikes })
          .eq('id', postId)

        if (error) {
          // Roll back optimistic update
          setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likes: match.likes } : p)))
          pendingLikes.current.delete(postId)
        }
      } catch (err) {
        console.error('[Board] Like error:', err)
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likes: match.likes } : p)))
        pendingLikes.current.delete(postId)
      }
    },
    [posts]
  )

  return {
    posts,
    loading,
    submitting,
    hypeActive,
    memoryActive,
    onlineCount,
    handleCreatePost,
    handleLikePost,
  }
}
