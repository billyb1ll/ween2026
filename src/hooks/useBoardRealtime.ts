import { useState, useEffect, useCallback } from "react";
import { toaster } from "../components/ui/toaster";
import type { User } from "../context/UserContext";
import {
  useBoardPosts,
  useSystemConfigs,
  useCreatePostMutation,
  useLikePostMutation,
  useDeletePostMutation,
} from "./useBoardQueries";
import type { DBPost, BoardTab } from "./useBoardQueriesTypes";

export type { BoardTab, DBPost };

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
  handleDeletePost: (postId: number) => Promise<void>;
}

export function useBoardRealtime(
  activeTab: BoardTab,
  user: User | null,
): UseBoardRealtimeReturn {
  const { data: posts = [], isLoading } = useBoardPosts(activeTab);
  const { data: configs } = useSystemConfigs();

  const createPostMutation = useCreatePostMutation(activeTab);
  const likePostMutation = useLikePostMutation(activeTab);
  const deletePostMutation = useDeletePostMutation(activeTab);

  const [hypeActive, setHypeActive] = useState(true);
  const [memoryActive, setMemoryActive] = useState(true);

  // Sync board toggles config
  useEffect(() => {
    if (configs) {
      const hype = configs.find((c) => c.key === "enable_hype_board");
      const memory = configs.find((c) => c.key === "enable_memory_board");
      
      // Update state asynchronously to avoid synchronous cascading renders
      Promise.resolve().then(() => {
        if (hype) setHypeActive(hype.value);
        if (memory) setMemoryActive(memory.value);
      });
    }
  }, [configs]);

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

      try {
        await createPostMutation.mutateAsync({
          content,
          tags,
          isAnon,
          imageUrl,
          userId: user.student_id,
        });

        toaster.create({
          title: activeTab === "hype" ? "🔥 Hype posted!" : "📌 Memory pinned!",
          description: "Your message is live on the board.",
          type: "success",
        });
      } catch (err) {
        console.error("[Board] Post creation error:", err);
        toaster.create({ title: "Error posting message", type: "error" });
      }
    },
    [user, activeTab, createPostMutation]
  );

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

      const match = posts.find((p) => p.id === postId);
      if (!match) return;

      const hasLiked = match.liked_by.includes(user.student_id);
      const nextLikedBy = hasLiked
        ? match.liked_by.filter((id) => id !== user.student_id)
        : [...match.liked_by, user.student_id];
      const nextLikes = hasLiked
        ? Math.max(0, match.likes - 1)
        : match.likes + 1;

      try {
        await likePostMutation.mutateAsync({
          postId,
          nextLikes,
          nextLikedBy,
        });
      } catch (err) {
        console.error("[Board] Like mutation error:", err);
      }
    },
    [user, posts, likePostMutation]
  );

  const handleDeletePost = useCallback(
    async (postId: number) => {
      if (!user) {
        toaster.create({
          title: "Sign In Required",
          description: "Please sign in to delete your pinned orientation vibes!",
          type: "warning",
        });
        return;
      }

      try {
        await deletePostMutation.mutateAsync({
          postId,
          userId: user.student_id,
          pinHash: user.pin_hash || "",
        });
        toaster.create({ title: "Post Deleted!", type: "success" });
      } catch (err) {
        console.error("[Board] Delete mutation error:", err);
        toaster.create({ title: "Failed to delete post", type: "error" });
      }
    },
    [user, deletePostMutation]
  );

  return {
    posts,
    loading: isLoading,
    submitting: createPostMutation.isPending,
    hypeActive,
    memoryActive,
    handleCreatePost,
    handleLikePost,
    handleDeletePost,
  };
}
