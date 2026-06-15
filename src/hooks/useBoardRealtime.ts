import { useState, useEffect, useCallback, useRef } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { toaster } from "../components/ui/toaster";
import type { User } from "../context/UserContext";

// ─── Types ───────────────────────────────────────────────────────────────────

export type BoardTab = "hype" | "memory";

export interface DBPost {
  id: number;
  content: string;
  createdAt: string;
  likes: number;
  comment_count: number;
  tags: string[];
  is_anonymous: boolean;
  is_hidden: boolean;
  student_id: string;
  type: BoardTab;
  liked_by: string[];
  image_url: string | null;
  is_pinned?: boolean;
  author: {
    student_id: string;
    nickname: string | null;
    avatar_color: string;
    role: string;
    profile_pic_url: string | null;
  };
}

export interface UseBoardRealtimeReturn {
  posts: DBPost[];
  loading: boolean;
  submitting: boolean;
  hypeActive: boolean;
  memoryActive: boolean;
  handleCreatePost: (
    content: string,
    tags: string[],
    isAnon: boolean,
    imageUrl?: string | null,
  ) => Promise<void>;
  handleLikePost: (postId: number) => Promise<void>;
  handlePinPost: (postId: number, currentStatus: boolean) => Promise<void>;
  handleDeletePost: (postId: number) => Promise<void>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPost(p: any): DBPost {
  let cc = 0;
  if (Array.isArray(p.comment_count)) {
    cc = p.comment_count[0]?.count ?? 0;
  } else if (p.comment_count !== undefined && p.comment_count !== null) {
    cc = Number(p.comment_count);
  }
  if (isNaN(cc)) {
    cc = 0;
  }

  return {
    id: Number(p.id),
    content: p.content,
    createdAt: p.created_at,
    likes: p.likes ?? 0,
    comment_count: cc,
    tags: Array.isArray(p.tags) ? p.tags : p.tags ? [p.tags] : ["orientation"],
    is_anonymous: p.is_anonymous ?? false,
    is_hidden: p.is_hidden ?? false,
    student_id: p.student_id,
    type: p.type as BoardTab,
    liked_by: Array.isArray(p.liked_by) ? p.liked_by : [],
    image_url: p.image_url ?? null,
    is_pinned: p.is_pinned ?? false,
    author: {
      student_id: p.author?.student_id ?? "",
      nickname: p.author?.nickname ?? "Guest Whitelist",
      avatar_color: p.author?.avatar_color ?? "#496268",
      role: p.author?.role ?? "student",
      profile_pic_url: p.author?.profile_pic_url ?? null,
    },
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useBoardRealtime(
  activeTab: BoardTab,
  user: User | null,
): UseBoardRealtimeReturn {
  const [posts, setPosts] = useState<DBPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hypeActive, setHypeActive] = useState(true);
  const [memoryActive, setMemoryActive] = useState(true);

  // Keep a ref to the stream channel to send broadcasts from callbacks
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Track optimistic like origins so we don't double-apply realtime UPDATE
  const pendingLikes = useRef<Set<number>>(new Set());

  // ── Initial fetch ──────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;

    const fetchInitial = async () => {
      setLoading(true);
      try {
        // Feature toggles
        const { data: configData } = await supabase
          .from("system_config")
          .select("*");
        if (!active) return;

        if (configData) {
          const hype = configData.find((c) => c.key === "enable_hype_board");
          const memory = configData.find(
            (c) => c.key === "enable_memory_board",
          );
          if (hype) setHypeActive(hype.value);
          if (memory) setMemoryActive(memory.value);
        }

        // Posts snapshot for current tab — include comment count via subquery
        const { data, error } = await supabase
          .from("posts")
          .select(
            "*, author:users(student_id, nickname, avatar_color, role, profile_pic_url), comment_count:post_comments(count)",
          )
          .eq("type", activeTab)
          .eq("is_hidden", false)
          .order("is_pinned", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;
        if (!active) return;

        setPosts((data ?? []).map(mapPost));
      } catch (err) {
        console.error("[Board] Initial fetch error:", err);
        toaster.create({
          title: "Error loading posts",
          description: "Could not fetch board entries. Please try refreshing.",
          type: "error",
        });
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchInitial();
    return () => {
      active = false;
    };
  }, [activeTab]); // Re-fetch when tab switches

  // ── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase.channel(`board:${activeTab}:stream`, {
      config: { private: true },
    });
    channelRef.current = channel;

    channel
      // ── Broadcast: new post ──
      .on("broadcast", { event: "new_post" }, (payload) => {
        if (!payload.payload?.post) return;
        const incoming = mapPost(payload.payload.post);
        setPosts((prev) => {
          if (prev.some((p) => p.id === incoming.id)) return prev;
          return [incoming, ...prev];
        });
      })
      // ── Broadcast: like update ──
      .on("broadcast", { event: "post_liked" }, (payload) => {
        const { postId, likes, liked_by } = payload.payload || {};
        if (!postId) return;
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  likes: likes ?? p.likes,
                  liked_by: Array.isArray(liked_by) ? liked_by : p.liked_by,
                }
              : p,
          ),
        );
      })
      // ── Broadcast: pin update ──
      .on("broadcast", { event: "post_pinned" }, (payload) => {
        const { postId, is_pinned } = payload.payload || {};
        if (!postId) return;
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, is_pinned } : p)),
        );
      })
      // ── Broadcast: delete update ──
      .on("broadcast", { event: "post_deleted" }, (payload) => {
        const { postId } = payload.payload || {};
        if (!postId) return;
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      })
      // ── system_config ──
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_config" },
        (payload) => {
          const record = (payload.new || payload.old) as {
            key?: string;
            value?: boolean;
          } | null;
          if (!record) return;
          const { key, value } = record;
          if (key === "enable_hype_board") setHypeActive(value ?? true);
          if (key === "enable_memory_board") setMemoryActive(value ?? true);
        },
      )
      .subscribe((status, err) => {
        if (err) {
          console.error(`[Realtime Board Error - Tab ${activeTab}]:`, err);
        }
        console.log(`[Realtime Board Status - Tab ${activeTab}]:`, status);
      });

    // ── Global comment counter channel ─────────────────────────────────────
    // Watches ALL inserts/deletes on post_comments and patches comment_count
    // in the posts state array so face-card counters update without needing
    // the comment drawer to be open first.
    const commentChannel = supabase
      .channel("global-comment-counts-" + activeTab, {
        config: { private: true },
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "post_comments" },
        (payload) => {
          const postId = Number(payload.new.post_id);
          setPosts((prev) =>
            prev.map((p) =>
              p.id === postId
                ? { ...p, comment_count: p.comment_count + 1 }
                : p,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "post_comments" },
        (payload) => {
          const commentId = payload.old.id;
          console.log("[Realtime global comment delete] ID:", commentId);
          const postId = payload.old.post_id
            ? Number(payload.old.post_id)
            : null;
          if (!postId) return;
          setPosts((prev) =>
            prev.map((p) =>
              p.id === postId
                ? { ...p, comment_count: Math.max(0, p.comment_count - 1) }
                : p,
            ),
          );
        },
      )
      .subscribe((status, err) => {
        if (err) console.error("[Comment Counts Realtime Error]:", err);
        console.log("[Comment Counts Realtime Status]:", status);
      });

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(commentChannel);
      channelRef.current = null;
    };
  }, [activeTab, user]);

  // ── Create post ───────────────────────────────────────────────────────────
  const handleCreatePost = useCallback(
    async (
      content: string,
      tags: string[],
      isAnon: boolean,
      imageUrl?: string | null,
    ) => {
      if (!user) {
        toaster.create({
          title: "Sign In Required",
          description: "Please sign in to share your orientation vibes!",
          type: "warning",
        });
        return;
      }

      setSubmitting(true);
      try {
        const { data, error } = await supabase
          .from("posts")
          .insert({
            content: content.trim(),
            student_id: user.student_id,
            tags,
            type: activeTab,
            is_anonymous: isAnon,
            image_url: imageUrl || null,
          })
          .select(
            "*, author:users(student_id, nickname, avatar_color, role, profile_pic_url)",
          )
          .single();

        if (error) throw error;

        if (data) {
          const incoming = mapPost(data);
          // Broadcast to other clients
          channelRef.current
            ?.send({
              type: "broadcast",
              event: "new_post",
              payload: {
                post: data,
                session_token: localStorage.getItem("baan7_session_token"),
              },
            })
            .catch((err) =>
              console.error("[Realtime] Broadcast new_post error:", err),
            );

          // Optimistic prepend — realtime INSERT will arrive shortly, dedup guard prevents double
          setPosts((prev) => {
            if (prev.some((p) => p.id === incoming.id)) return prev;
            return [incoming, ...prev];
          });

          toaster.create({
            title:
              activeTab === "hype" ? "🔥 Hype posted!" : "📌 Memory pinned!",
            description: "Your message is live on the board.",
            type: "success",
          });
        }
      } catch (err) {
        console.error("[Board] Post creation error:", err);
        toaster.create({ title: "Error posting message", type: "error" });
      } finally {
        setSubmitting(false);
      }
    },
    [user, activeTab],
  );

  // ── Like post (optimistic & idempotent toggle) ─────────────────────────────
  const handleLikePost = useCallback(
    async (postId: number) => {
      if (!user) {
        toaster.create({
          title: "Sign In Required",
          description: "Please sign in to like posts!",
          type: "warning",
        });
        return;
      }

      let match: DBPost | undefined;
      setPosts((prev) => {
        match = prev.find((p) => p.id === postId);
        return prev;
      });

      if (!match) return;

      const hasLiked = match.liked_by.includes(user.student_id);
      const nextLikedBy = hasLiked
        ? match.liked_by.filter((id) => id !== user.student_id)
        : [...match.liked_by, user.student_id];
      const nextLikes = hasLiked
        ? Math.max(0, match.likes - 1)
        : match.likes + 1;

      // Optimistic local update
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, likes: nextLikes, liked_by: nextLikedBy }
            : p,
        ),
      );

      // 0ms Optimistic Synchronization: Shoot rapid broadcast payload immediately before updating relational tables statically
      channelRef.current
        ?.send({
          type: "broadcast",
          event: "post_liked",
          payload: {
            postId,
            likes: nextLikes,
            liked_by: nextLikedBy,
            session_token: localStorage.getItem("baan7_session_token"),
          },
        })
        .catch((err) =>
          console.error("[Realtime] Broadcast post_liked error:", err),
        );

      // Mark as self-originated so the realtime UPDATE won't double-apply
      pendingLikes.current.add(postId);

      try {
        const { error } = await supabase
          .from("posts")
          .update({
            likes: nextLikes,
            liked_by: nextLikedBy,
          })
          .eq("id", postId);

        if (error) throw error;
      } catch (err) {
        console.error("[Board] Like error:", err);
        // Rollback optimistic update
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, likes: match!.likes, liked_by: match!.liked_by }
              : p,
          ),
        );
        pendingLikes.current.delete(postId);
      }
    },
    [user],
  );

  // ── Admin: Pin post ───────────────────────────────────────────────────────
  const handlePinPost = useCallback(
    async (postId: number, currentStatus: boolean) => {
      if (!user || user.role === "student") return;

      const nextStatus = !currentStatus;

      // Optimistic update
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, is_pinned: nextStatus } : p,
        ),
      );

      // Broadcast pin state
      channelRef.current
        ?.send({
          type: "broadcast",
          event: "post_pinned",
          payload: {
            postId,
            is_pinned: nextStatus,
            session_token: localStorage.getItem("baan7_session_token"),
          },
        })
        .catch((err) => console.error("[Realtime] Broadcast pin error:", err));

      try {
        const { error } = await supabase.rpc("pin_post_secure", {
          p_post_id: postId,
          p_student_id: user.student_id,
          p_pin_hash: user.pin_hash || "",
          p_is_pinned: nextStatus,
        });

        if (error) throw error;

        toaster.create({
          title: nextStatus ? "Post pinned" : "Post unpinned",
          type: "success",
        });
      } catch (err) {
        console.error("[Board] Pin error:", err);
        // Rollback pin state
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, is_pinned: currentStatus } : p,
          ),
        );
        toaster.create({ title: "Error pinning post", type: "error" });
      }
    },
    [user],
  );

  // ── Admin: Delete post ────────────────────────────────────────────────────
  const handleDeletePost = useCallback(
    async (postId: number) => {
      if (!user || user.role === "student") return;

      // Optimistic delete
      setPosts((prev) => prev.filter((p) => p.id !== postId));

      // Broadcast delete state
      channelRef.current
        ?.send({
          type: "broadcast",
          event: "post_deleted",
          payload: {
            postId,
            session_token: localStorage.getItem("baan7_session_token"),
          },
        })
        .catch((err) =>
          console.error("[Realtime] Broadcast delete error:", err),
        );

      try {
        const { error } = await supabase.rpc("delete_post_secure", {
          p_post_id: postId,
          p_student_id: user.student_id,
          p_pin_hash: user.pin_hash || "",
        });
        if (error) throw error;

        toaster.create({
          title: "Post deleted",
          type: "success",
        });
      } catch (err) {
        console.error("[Board] Delete error:", err);
        toaster.create({ title: "Error deleting post", type: "error" });
      }
    },
    [user],
  );

  return {
    posts,
    loading,
    submitting,
    hypeActive,
    memoryActive,
    handleCreatePost,
    handleLikePost,
    handlePinPost,
    handleDeletePost,
  };
}
