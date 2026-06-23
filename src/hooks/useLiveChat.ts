import { useState, useEffect, useCallback, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { toaster } from "../components/ui/toaster";
import type { User } from "../context/UserContext";
import type { BoardTab } from "./useBoardRealtime";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  content: string;
  sender_id: string;
  sender_nickname: string;
  sender_avatar_color: string;
  sender_role: string;
  sender_profile_pic_url: string | null;
  timestamp: string;
}

export interface UseLiveChatReturn {
  messages: ChatMessage[];
  loading: boolean;
  sending: boolean;
  onlineCount: number;
  sendMessage: (content: string) => Promise<boolean>;
  deleteMessage: (messageId: string) => Promise<void>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MESSAGE_BUFFER_LIMIT = 100;
const HISTORY_DEPTH = 50;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbRow(row: any): ChatMessage {
  return {
    id: String(row.id),
    content: row.content,
    sender_id: row.student_id,
    sender_nickname: row.sender?.nickname ?? "Guest",
    sender_avatar_color: row.sender?.avatar_color ?? "#496268",
    sender_role: row.sender?.role ?? "student",
    sender_profile_pic_url: row.sender?.profile_pic_url ?? null,
    timestamp: row.created_at,
  };
}

function clampBuffer(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length > MESSAGE_BUFFER_LIMIT) {
    return messages.slice(messages.length - MESSAGE_BUFFER_LIMIT);
  }
  return messages;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useLiveChat(
  activeTab: BoardTab,
  user: User | null,
): UseLiveChatReturn {
  const userId = user?.student_id;
  const userNickname = user?.nickname;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(userId ? true : false);
  const [sending, setSending] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1);
  const [isPolling, setIsPolling] = useState(false);

  // Sync state during render to avoid synchronous state updates inside effects
  const [prevActiveTab, setPrevActiveTab] = useState(activeTab);
  const [prevUserId, setPrevUserId] = useState(userId);

  if (activeTab !== prevActiveTab || userId !== prevUserId) {
    setPrevActiveTab(activeTab);
    setPrevUserId(userId);
    if (!userId) {
      setMessages([]);
      setLoading(false);
      setIsPolling(false);
    } else {
      setMessages([]);
      setLoading(true);
      setIsPolling(false);
    }
  }

  const [isDocumentVisible, setIsDocumentVisible] = useState(
    typeof document !== "undefined" ? document.visibilityState === "visible" : true
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsDocumentVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const isInitialLoadRef = useRef(true);

  // Stable addMessage that deduplicates (overwriting stale) + clamps
  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      const exists = prev.some((m) => m.id === msg.id);
      if (exists) {
        // Overwrite standard or stale records with the incoming one
        return prev.map((m) => (m.id === msg.id ? msg : m));
      }
      return clampBuffer([...prev, msg]);
    });
  }, []);

  // ── Load history sync routine ──────────────────────────────────────────────
  const loadHistory = useCallback(async (showLoadingSpinner = false) => {
    if (showLoadingSpinner) {
      setLoading(true);
    }
    try {
      const { data, error } = await supabase
        .from("live_chats")
        .select(
          "*, sender:users(student_id, nickname, avatar_color, role, profile_pic_url)",
        )
        .eq("tab", activeTab)
        .order("created_at", { ascending: false })
        .limit(HISTORY_DEPTH);

      if (error) throw error;

      const mapped = (data ?? []).map(mapDbRow).reverse();

      setMessages((prev) => {
        const messageMap = new Map<string, ChatMessage>();
        mapped.forEach((m) => messageMap.set(m.id, m));
        prev.forEach((m) => messageMap.set(m.id, m));
        const merged = Array.from(messageMap.values()).sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );
        return clampBuffer(merged);
      });
    } catch (err) {
      console.error("[LiveChat] History fetch error:", err);
    } finally {
      if (showLoadingSpinner) {
        setLoading(false);
      }
    }
  }, [activeTab]);

  // ── Realtime: traffic-split subscription ───────────────────────────────────
  useEffect(() => {
    if (!userId) {
      return;
    }

    let connectionTimeout: ReturnType<typeof setTimeout> | null = null;

    // ── Authenticated: WebSocket broadcast channel ──
    const channel = supabase.channel(`live_chat:${activeTab}`, {
      config: { private: true },
    });
    channelRef.current = channel;

    // Handshake Timeout Setup: activate polling if subscription fails to connect in 4 seconds
    connectionTimeout = setTimeout(() => {
      if (channelRef.current && channelRef.current.state !== "joined") {
        console.warn(`[Realtime LiveChat Fallback - Tab ${activeTab}]: Connection handshake timed out. Activating REST polling.`);
        setIsPolling(true);
      }
    }, 4000);

    channel
      .on("broadcast", { event: "chat_message" }, (payload) => {
        if (!payload.payload?.message) return;
        addMessage(payload.payload.message as ChatMessage);
      })
      .on("broadcast", { event: "chat_deleted" }, (payload) => {
        const deletedId = payload.payload?.id;
        if (!deletedId) return;
        setMessages((prev) =>
          prev.filter((m) => m.id !== String(deletedId)),
        );
      })
      .subscribe(async (status, err) => {
        if (err) {
          console.error(`[LiveChat WS Error - ${activeTab}]:`, err);
        }
        console.log(`[Realtime LiveChat Status - Tab ${activeTab}]:`, status);
        if (status === "SUBSCRIBED") {
          if (connectionTimeout) clearTimeout(connectionTimeout);
          setIsPolling(false);
          const isInitial = isInitialLoadRef.current;
          if (isInitial) {
            isInitialLoadRef.current = false;
          }
          await loadHistory(isInitial);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          if (connectionTimeout) clearTimeout(connectionTimeout);
          console.warn(`[Realtime LiveChat Fallback - Tab ${activeTab}]: Channel status ${status}. Activating REST polling.`);
          setIsPolling(true);
        }
      });

    return () => {
      if (connectionTimeout) clearTimeout(connectionTimeout);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [activeTab, userId, addMessage, loadHistory]);

  // ── Poll implementation ───────────────────────────────────────────────────
  const poll = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("live_chats")
        .select(
          "*, sender:users(student_id, nickname, avatar_color, role, profile_pic_url)",
        )
        .eq("tab", activeTab)
        .order("created_at", { ascending: false })
        .limit(20);

      if (data) {
        setMessages(data.map(mapDbRow).reverse());
      }
    } catch (err) {
      console.error("[LiveChat] Poll error:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  // ── Failover Polling Effect ────────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !isPolling) return;

    if (!isDocumentVisible) {
      console.log(`[Eco Mode - Chat Tab ${activeTab}] Tab hidden. Suspending polling.`);
      return;
    }

    // Immediately fetch once when returning to visible state
    Promise.resolve().then(() => {
      poll();
    });

    // Stagger polling intervals between 30 to 45 seconds to prevent query grouping
    const intervalTime = Math.floor(Math.random() * 15000) + 30000;
    console.warn(`[Eco Mode - Chat Tab ${activeTab}] Connection limit reached. Falling back to staggered polling every ${Math.round(intervalTime / 1000)}s.`);

    const interval = setInterval(async () => {
      await poll();
    }, intervalTime);

    return () => {
      clearInterval(interval);
    };
  }, [isPolling, isDocumentVisible, poll, activeTab, userId]);

  // ── Presence channel ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const presenceChannel = supabase.channel(
      `live_chat:presence:${activeTab}`,
      { config: { private: true } },
    );
    presenceChannelRef.current = presenceChannel;

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
      presenceChannelRef.current = null;
    };
  }, [activeTab, userId, userNickname]);

  // ── Dual-track send ────────────────────────────────────────────────────────
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

      setSending(true);

      const messageId = crypto.randomUUID();
      const chatMsg: ChatMessage = {
        id: messageId,
        content: content.trim(),
        sender_id: user.student_id,
        sender_nickname: user.nickname ?? "Guest",
        sender_avatar_color: user.avatar_color,
        sender_role: user.role,
        sender_profile_pic_url: user.profile_pic_url,
        timestamp: new Date().toISOString(),
      };

      // Optimistic: add to local state immediately
      addMessage(chatMsg);

      try {
        // Track 1: Realtime Broadcast (in-memory, <10ms)
        const broadcastPromise = channelRef.current
          ?.send({
            type: "broadcast",
            event: "chat_message",
            payload: { message: chatMsg },
          })
          .catch((err: unknown) =>
            console.error("[LiveChat] Broadcast error:", err),
          );

        // Track 2: Async Persistence (PostgreSQL)
        const persistPromise = supabase
          .from("live_chats")
          .insert({
            id: messageId,
            content: content.trim(),
            student_id: user.student_id,
            tab: activeTab,
          })
          .then(({ error }) => {
            if (error) {
              console.error("[LiveChat] Persist error:", error);
              throw error;
            }
          });

        await Promise.all([broadcastPromise, persistPromise]);
        return true;
      } catch (err) {
        console.error("[LiveChat] Send error:", err);
        toaster.create({ title: "Failed to send message", type: "error" });
        // Rollback optimistic message
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        return false;
      } finally {
        setSending(false);
      }
    },
    [user, activeTab, addMessage],
  );

  // ── Staff: delete message ──────────────────────────────────────────────────
  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!user || user.role === "student") return;

      // Optimistic remove
      setMessages((prev) => prev.filter((m) => m.id !== messageId));

      // Broadcast delete to other clients
      channelRef.current
        ?.send({
          type: "broadcast",
          event: "chat_deleted",
          payload: { id: messageId },
        })
        .catch((err: unknown) =>
          console.error("[LiveChat] Broadcast delete error:", err),
        );

      try {
        const { error } = await supabase.rpc("delete_chat_message_secure", {
          p_message_id: messageId,
          p_student_id: user.student_id,
          p_pin_hash: user.pin_hash || "",
        });
        if (error) throw error;
      } catch (err) {
        console.error("[LiveChat] Delete error:", err);
        toaster.create({
          title: "Failed to delete message",
          type: "error",
        });
      }
    },
    [user],
  );

  return {
    messages,
    loading,
    sending,
    onlineCount,
    sendMessage,
    deleteMessage,
  };
}
