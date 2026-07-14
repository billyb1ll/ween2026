import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { toaster } from "../components/ui/toaster";
import type { User } from "../context/UserContext";
import type { BoardTab } from "./useBoardRealtime";
import {
  useLiveChatMessages,
  usePostChatTextMutation,
  useDeleteChatTextMutation,
  boardQueryKeys,
  mapDbRow,
} from "./useBoardQueries";
import type { ChatMessage } from "./useBoardQueriesTypes";
import { useQueryClient } from "@tanstack/react-query";

export type { ChatMessage };

export interface UseLiveChatReturn {
  messages: ChatMessage[];
  loading: boolean;
  sending: boolean;
  onlineCount: number;
  isMaxCapacity: boolean;
  sendMessage: (content: string) => Promise<boolean>;
  deleteMessage: (messageId: string) => Promise<void>;
}

export function useLiveChat(
  activeTab: BoardTab,
  user: User | null,
  adminPin: string,
): UseLiveChatReturn {
  const userId = user?.student_id;
  const userNickname = user?.nickname;

  const [onlineCount, setOnlineCount] = useState(1);
  const isHighLoad = onlineCount > 40;
  const isMaxCapacity = onlineCount > 150;

  const { data: messages = [], isLoading } = useLiveChatMessages(
    activeTab,
    userId,
    isHighLoad ? 4000 : false
  );
  
  const postChatMutation = usePostChatTextMutation(activeTab, user);
  const deleteChatMutation = useDeleteChatTextMutation(activeTab);
  const queryClient = useQueryClient();

  // Track document visibility to pause realtime channels and save concurrent connections (Max 200)
  const [isVisible, setIsVisible] = useState(true);
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === "visible");
    };
    
    // Initial check just in case
    handleVisibilityChange();
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Presence channel subscription
  useEffect(() => {
    if (!userId || !isVisible) return;

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
  }, [activeTab, userId, userNickname, isVisible]);

  // Realtime Broadcast Subscription for Low-Load Phase
  useEffect(() => {
    if (isHighLoad || !isVisible) return;

    const chatChannel = supabase
      .channel(`live_chats_pg_changes:${activeTab}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_chats", filter: `tab=eq.${activeTab}` },
        async (payload) => {
          if (payload.eventType === "UPDATE") {
            if (payload.new.is_deleted) {
              queryClient.setQueryData<ChatMessage[]>(boardQueryKeys.chat(activeTab), (old = []) => {
                return old.map(msg => msg.id === payload.new.id ? { ...msg, is_deleted: true } : msg);
              });
            }
            return;
          }

          if (payload.eventType === "INSERT") {
            // Exclude our own optimistic messages
            if (payload.new.student_id === userId) return;

            const { data, error } = await supabase
              .from("live_chats")
              .select("*, sender:users(student_id, nickname, avatar_color, role, profile_pic_url)")
              .eq("id", payload.new.id)
              .single();

            if (!error && data) {
              queryClient.setQueryData<ChatMessage[]>(boardQueryKeys.chat(activeTab), (old = []) => {
                if (old.some(msg => msg.id === data.id)) return old;
                return [...old, mapDbRow(data)];
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chatChannel);
    };
  }, [activeTab, isHighLoad, queryClient, userId, isVisible]);

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
          pinHash: adminPin,
        });
      } catch (err) {
        console.error("[LiveChat] Delete error:", err);
      }
    },
    [user, adminPin, deleteChatMutation]
  );

  return {
    messages,
    loading: isLoading,
    sending: postChatMutation.isPending,
    onlineCount,
    isMaxCapacity,
    sendMessage,
    deleteMessage,
  };
}
