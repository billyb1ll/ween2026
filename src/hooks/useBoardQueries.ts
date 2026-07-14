import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import type { User } from "../context/UserContext";
import type { BoardTab } from "./useBoardRealtime";
import type { DBPost, ChatMessage } from "./useBoardQueriesTypes";

// Let's create userQueryKeys / boardQueryKeys
export const boardQueryKeys = {
  posts: (tab: BoardTab) => ["board_posts", tab] as const,
  chat: (tab: BoardTab) => ["chat_messages", tab] as const,
  comments: (postId: number) => ["post_comments", postId] as const,
};

// Map database post row to DBPost type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPost(p: any): DBPost {
  let cc = 0;
  if (Array.isArray(p.comment_count)) {
    cc = p.comment_count[0]?.count ?? 0;
  } else if (p.comment_count !== undefined && p.comment_count !== null) {
    cc = Number(p.comment_count);
  }
  if (isNaN(cc)) cc = 0;

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

// Map database chat message row to ChatMessage type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapDbRow(row: any): ChatMessage {
  return {
    id: String(row.id),
    content: row.content,
    sender_id: row.student_id,
    sender_nickname: row.sender?.nickname ?? "Guest",
    sender_avatar_color: row.sender?.avatar_color ?? "#496268",
    sender_role: row.sender?.role ?? "student",
    sender_profile_pic_url: row.sender?.profile_pic_url ?? null,
    timestamp: row.created_at,
    is_deleted: row.is_deleted ?? false,
  };
}

/**
 * Fetch memory/hype board posts.
 * Re-fetches in the background every 8 seconds.
 */
export function useBoardPosts(activeTab: BoardTab) {
  const queryClient = useQueryClient();

  const query = useQuery<DBPost[]>({
    queryKey: boardQueryKeys.posts(activeTab),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(
          "*, author:users(student_id, nickname, avatar_color, role, profile_pic_url), comment_count:post_comments(count)",
        )
        .eq("type", activeTab)
        .eq("is_hidden", false)
        .order("is_pinned", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(25);

      if (error) {
        console.error("Fetch board posts error:", error);
        throw error;
      }

      return (data ?? []).map(mapPost);
    },
    refetchInterval: 30000, // 30-second fallback if Realtime connection drops
  });

  useEffect(() => {
    const postsChannel = supabase
      .channel(`posts_pg_changes:${activeTab}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts", filter: `type=eq.${activeTab}` },
        () => {
          queryClient.invalidateQueries({ queryKey: boardQueryKeys.posts(activeTab) });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(postsChannel);
    };
  }, [activeTab, queryClient]);

  return query;
}

/**
 * Fetch live chat message list logs.
 * Sets up a PostgreSQL subscription to automatically invalidate the query on insert.
 */
export function useLiveChatMessages(
  activeTab: BoardTab,
  userId: string | undefined,
  pollInterval: number | false = 25000
) {
  return useQuery<ChatMessage[]>({
    queryKey: boardQueryKeys.chat(activeTab),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_chats")
        .select(
          "*, sender:users(student_id, nickname, avatar_color, role, profile_pic_url)",
        )
        .eq("tab", activeTab)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Fetch live chat error:", error);
        throw error;
      }

      // Return messages in chronological order (oldest first)
      return (data ?? []).map(mapDbRow).reverse();
    },
    enabled: !!userId,
    refetchInterval: pollInterval,
  });
}

/**
 * Mutation to submit a text/image post.
 */
export function useCreatePostMutation(activeTab: BoardTab) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      content,
      tags,
      isAnon,
      imageUrl,
      userId,
    }: {
      content: string;
      tags: string[];
      isAnon: boolean;
      imageUrl?: string | null;
      userId: string;
    }) => {
      const { data, error } = await supabase
        .from("posts")
        .insert({
          content: content.trim(),
          student_id: userId,
          tags,
          type: activeTab,
          is_anonymous: isAnon,
          image_url: imageUrl || null,
        })
        .select(
          "*, author:users(student_id, nickname, avatar_color, role, profile_pic_url)",
        )
        .single();

      if (error) {
        console.error("Post creation DB error:", error);
        throw error;
      }

      return mapPost(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardQueryKeys.posts(activeTab) });
    },
  });
}

/**
 * Mutation to like a post with optimistic update and rollback.
 */
export function useLikePostMutation(activeTab: BoardTab) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, nextLikes, nextLikedBy }: { postId: number; nextLikes: number; nextLikedBy: string[] }) => {
      const { error } = await supabase
        .from("posts")
        .update({
          likes: nextLikes,
          liked_by: nextLikedBy,
        })
        .eq("id", postId);

      if (error) throw error;
      return { postId, nextLikes, nextLikedBy };
    },
    onMutate: async ({ postId, nextLikes, nextLikedBy }) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: boardQueryKeys.posts(activeTab) });

      // Snapshot the previous value
      const previousPosts = queryClient.getQueryData<DBPost[]>(boardQueryKeys.posts(activeTab));

      // Optimistically update the cache
      if (previousPosts) {
        queryClient.setQueryData<DBPost[]>(
          boardQueryKeys.posts(activeTab),
          previousPosts.map((post) =>
            post.id === postId
              ? { ...post, likes: nextLikes, liked_by: nextLikedBy }
              : post
          )
        );
      }

      // Return a context object with the snapshotted value
      return { previousPosts };
    },
    onError: (_err, _variables, context) => {
      // Rollback to the previous state on error
      if (context?.previousPosts) {
        queryClient.setQueryData(boardQueryKeys.posts(activeTab), context.previousPosts);
      }
    },
    onSettled: () => {
      // Invalidate query to trigger refetch and ensure state is synced with server
      queryClient.invalidateQueries({ queryKey: boardQueryKeys.posts(activeTab) });
    },
  });
}

/**
 * Mutation to post a live chat message with optimistic update and rollback.
 */
export function usePostChatTextMutation(activeTab: BoardTab, user: User | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      if (!user) throw new Error("Unauthorized");
      const { error } = await supabase
        .from("live_chats")
        .insert({
          id: messageId,
          content: content.trim(),
          student_id: user.student_id,
          tab: activeTab,
        });

      if (error) throw error;
      return { messageId, content };
    },
    onMutate: async ({ messageId, content }) => {
      if (!user) return;

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: boardQueryKeys.chat(activeTab) });

      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData<ChatMessage[]>(boardQueryKeys.chat(activeTab));

      // Create optimistic message
      const optimisticMsg: ChatMessage = {
        id: messageId,
        content: content.trim(),
        sender_id: user.student_id,
        sender_nickname: user.nickname ?? "Guest",
        sender_avatar_color: user.avatar_color,
        sender_role: user.role,
        sender_profile_pic_url: user.profile_pic_url,
        timestamp: new Date().toISOString(),
      };

      // Optimistically append the message to the list
      if (previousMessages) {
        queryClient.setQueryData<ChatMessage[]>(
          boardQueryKeys.chat(activeTab),
          [...previousMessages, optimisticMsg]
        );
      }

      return { previousMessages };
    },
    onError: (_err, _variables, context) => {
      // Rollback to the previous state on error
      if (context?.previousMessages) {
        queryClient.setQueryData(boardQueryKeys.chat(activeTab), context.previousMessages);
      }
    },
    onSettled: () => {
      // Always refetch on settled
      queryClient.invalidateQueries({ queryKey: boardQueryKeys.chat(activeTab) });
    },
  });
}

/**
 * Mutation to delete a post.
 */
export function useDeletePostMutation(activeTab: BoardTab) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, userId, pinHash }: { postId: number; userId: string; pinHash: string }) => {
      const { error } = await supabase.rpc("delete_post_secure", {
        p_post_id: postId,
        p_student_id: userId,
        p_pin_hash: pinHash,
      });

      if (error) throw error;
      return postId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardQueryKeys.posts(activeTab) });
    },
  });
}

/**
 * Mutation to delete a chat message.
 */
export function useDeleteChatTextMutation(activeTab: BoardTab) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, userId, pinHash }: { messageId: string; userId: string; pinHash: string }) => {
      const { error } = await supabase.rpc("delete_chat_message_secure", {
        p_message_id: messageId,
        p_student_id: userId,
        p_pin_hash: pinHash,
      });

      if (error) throw error;
      return messageId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardQueryKeys.chat(activeTab) });
    },
  });
}

/**
 * Mutation to moderate (soft delete) a chat message.
 */
export function useModeratorDeleteMessage(activeTab: BoardTab) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, staffId, pinHash }: { messageId: string; staffId: string; pinHash: string }) => {
      const { error } = await supabase.rpc("moderation_delete_message", {
        p_message_id: messageId,
        p_staff_id: staffId,
        p_pin_hash: pinHash,
      });

      if (error) throw error;
      return messageId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardQueryKeys.chat(activeTab) });
    },
  });
}

/**
 * Mutation to ban a user from live chat.
 */
export function useModeratorBanUser() {
  return useMutation({
    mutationFn: async ({ targetUserId, reason, staffId, pinHash }: { targetUserId: string; reason: string; staffId: string; pinHash: string }) => {
      const { error } = await supabase.rpc("moderation_ban_user", {
        p_target_user_id: targetUserId,
        p_reason: reason,
        p_staff_id: staffId,
        p_pin_hash: pinHash,
      });

      if (error) throw error;
      return targetUserId;
    },
  });
}

/**
 * Fetch system configs (feature toggles, ticker settings, etc.)
 */
export function useSystemConfigs() {
  return useQuery({
    queryKey: ["system_configs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("system_config").select("*");
      if (error) {
        console.error("Fetch system configs error:", error);
        throw error;
      }
      return data || [];
    },
  });
}
