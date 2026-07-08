import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { toaster } from "../components/ui/toaster";
import type { User } from "../context/UserContext";
import type { BoardTab } from "./useBoardRealtime";
import {
  useLiveChatMessages,
  usePostChatTextMutation,
  useDeleteChatTextMutation,
} from "./useBoardQueries";
import type { ChatMessage } from "./useBoardQueriesTypes";

export type { ChatMessage };

export interface UseLiveChatReturn {
  messages: ChatMessage[];
  loading: boolean;
  sending: boolean;
  onlineCount: number;
  sendMessage: (content: string) => Promise<boolean>;
  deleteMessage: (messageId: string) => Promise<void>;
}

export function useLiveChat(
  activeTab: BoardTab,
  user: User | null,
): UseLiveChatReturn {
  const userId = user?.student_id;
  const userNickname = user?.nickname;

  const { data: messages = [], isLoading } = useLiveChatMessages(activeTab, userId);
  const postChatMutation = usePostChatTextMutation(activeTab, user);
  const deleteChatMutation = useDeleteChatTextMutation(activeTab);

  const [onlineCount, setOnlineCount] = useState(1);

  // Presence channel subscription
  useEffect(() => {
    if (!userId) return;

    const presenceChannel = supabase.channel(
      `live_chat:presence:${activeTab}`,
      { config: { private: true } },
    );

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        setOnlineCount(Object.keys(state).length);
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        setOnlineCount((prev) => prev + newPresences.length);
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        setOnlineCount((prev) => Math.max(1, prev - leftPresences.length));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            user_id: userId,
            nickname: userNickname ?? "Guest",
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [activeTab, userId, userNickname]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!user) {
        toaster.create({
          title: "Sign In Required",
          description: "Please sign in to chat!",
          type: "warning",
        });
        return false;
      }

      if (!content.trim() || content.length > 200) return false;

      const messageId = crypto.randomUUID();
      try {
        await postChatMutation.mutateAsync({ messageId, content });
        return true;
      } catch (err) {
        console.error("[LiveChat] Send error:", err);
        return false;
      }
    },
    [user, postChatMutation]
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!user || user.role === "student") return;

      try {
        await deleteChatMutation.mutateAsync({
          messageId,
          userId: user.student_id,
          pinHash: user.pin_hash || "",
        });
      } catch (err) {
        console.error("[LiveChat] Delete error:", err);
      }
    },
    [user, deleteChatMutation]
  );

  return {
    messages,
    loading: isLoading,
    sending: postChatMutation.isPending,
    onlineCount,
    sendMessage,
    deleteMessage,
  };
}
