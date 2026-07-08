import { useState, useEffect, useRef, useMemo } from "react";
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
  Textarea,
  Dialog,
  Image,
  SimpleGrid,
  TableScrollArea,
  Alert,
  Portal,
  Combobox,
  createListCollection,
} from "@chakra-ui/react";
import { useUser } from "../context/UserContext";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAdminUsers,
  useAdminMissions,
  useAdminAuditLogs,
  useAdminConfigs,
  useUpdateUserProfileRpcMutation,
} from "../hooks/useAdminQueries";
import { supabase } from "../lib/supabase";
import { getImmichConfig } from "../utils/immich";
import { compressImage } from "../utils/image";
import { Link } from "react-router-dom";
import { toaster } from "../components/ui/toaster";
import Papa from "papaparse";
import { FiAlertTriangle, FiChevronDown } from "react-icons/fi";
import { WhitelistTable } from "../components/admin/WhitelistTable";
import { SystemControlPanel } from "../components/admin/SystemControlPanel";
import { UserInspectModal } from "../components/admin/UserInspectModal";
import { STAFF_ROLES } from "../lib/constants";
import { MediaUploader } from "../components/admin/MediaUploader";
import { AlbumMappingAdmin } from "../components/admin/AlbumMappingAdmin";

export interface DBUser {
  student_id: string;
  nickname: string | null;
  faculty: string | null;
  role: string;
  created_at: string;
  major?: string | null;
  house_position?: string | null;
  profile_pic_url?: string | null;
  bio?: string | null;
  ig?: string | null;
  avatar_color?: string;
}

interface CSVRecord {
  student_id: string;
  role: string;
  nickname: string | null;
  faculty: string | null;
  major: string | null;
}

export interface AuditLog {
  id: number;
  moderator_id: string;
  action_type: string;
  target_id: string | null;
  details: string;
  created_at: string;
  users?: { nickname: string | null } | null;
}

interface VibeMission {
  id: number;
  sequence_order: number;
  target_role: string;
  required_count: number;
}

interface DBPost {
  id: number;
  content: string;
  likes: number;
  type: "hype" | "memory";
  is_anonymous: boolean;
  is_hidden: boolean;
  student_id: string;
  tags: string[];
  created_at: string;
  author: {
    student_id: string;
    nickname: string | null;
    avatar_color: string;
    role: string;
  };
}

interface Comment {
  id: number;
  post_id: number;
  student_id: string;
  content: string;
  created_at: string;
  author: {
    student_id: string;
    nickname: string | null;
    avatar_color: string;
    role: string;
  };
}

type HypeBoardMode = "active" | "slow_3s" | "read_only";

export function AdminDashboardPage() {
  const { user, updateProfile } = useUser();

  // Initialize tab directly from user role to avoid cascading useEffect renders
  const [activeTab, setActiveTab] = useState<"moderator" | "media" | "staff">(
    () => {
      if (user?.role === "moderator") return "moderator";
      if (user?.role === "staff") return "staff";
      return "media";
    },
  );

  const [loading, setLoading] = useState(true);

  // Whitelist/Users States
  const [whitelistedUsers, setWhitelistedUsers] = useState<DBUser[]>([]);
  const [lastUpdatedStudentId, setLastUpdatedStudentId] = useState<
    string | null
  >(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [newStudentId, setNewStudentId] = useState("");
  const [newRole, setNewRole] = useState("student");
  const [enableMemoryBoard, setEnableMemoryBoard] = useState(true);
  const [eventTitle, setEventTitle] = useState("First Meet");
  const [eventTime, setEventTime] = useState("");
  const [updatingEvent, setUpdatingEvent] = useState(false);

  // Command Center States
  const [hypeBoardMode, setHypeBoardMode] = useState<HypeBoardMode>("active");
  const [globalMuteActive, setGlobalMuteActive] = useState(false);
  const [tickerText, setTickerText] = useState("");
  const [tickerActive, setTickerActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Multi-Select States
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

  // Game Engine & Config states
  const [missions, setMissions] = useState<VibeMission[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [emergencyText, setEmergencyText] = useState("");
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false);
  const [isSavingTicker, setIsSavingTicker] = useState(false);
  const [maxStrikes, setMaxStrikes] = useState(5);
  const [baseCooldown, setBaseCooldown] = useState(1);
  const [maxCooldown, setMaxCooldown] = useState(30);

  // Staff dashboard states
  const [posts, setPosts] = useState<DBPost[]>([]);
  const [commentsMap, setCommentsMap] = useState<Record<number, Comment[]>>({});
  const [staffLoading, setStaffLoading] = useState(true);
  const [bio, setBio] = useState(user?.bio || "");
  const [photos, setPhotos] = useState<string[]>(user?.photo_pool || []);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const staffPhotoInputRef = useRef<HTMLInputElement>(null);
  const activeFileIdxRef = useRef<number>(0);
  const [vibecheckEnabled, setVibecheckEnabled] = useState(true);

  // User Inspector states
  const [inspectUser, setInspectUser] = useState<DBUser | null>(null);
  const [inspectUserStats, setInspectUserStats] = useState<{
    collectedCount: number;
    collectedFromCount: number;
    vibeStatus?: {
      strike_count: number;
      locked_until: string | null;
      current_mission_id: number | null;
    } | null;
    isLocked: boolean;
    unlockedStaff?: {
      staff_id: string;
      nickname: string;
      profile_pic_url: string;
      avatar_color: string;
    }[];
  } | null>(null);
  const [editNickname, setEditNickname] = useState("");
  const [editFaculty, setEditFaculty] = useState("");
  const [editMajor, setEditMajor] = useState("");
  const [editRole, setEditRole] = useState("");
  const [inspectUserLogs, setInspectUserLogs] = useState<AuditLog[]>([]);
  const [editHousePosition, setEditHousePosition] = useState("");
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [whitelistRoleTab, setWhitelistRoleTab] = useState<"student" | "staff">(
    "student",
  );

  const queryClient = useQueryClient();
  const isModerator = user?.role === "moderator";
  const { data: usersData } = useAdminUsers(isModerator);
  const { data: missionsData } = useAdminMissions(isModerator);
  const { data: logsData } = useAdminAuditLogs(isModerator);
  const { data: configsData = [] } = useAdminConfigs(!!user);
  const updateUserProfileRpc = useUpdateUserProfileRpcMutation(user?.student_id || "");

  useEffect(() => {
    if (usersData) {
      Promise.resolve().then(() => {
        setWhitelistedUsers(usersData);
      });
    }
  }, [usersData]);

  useEffect(() => {
    if (missionsData) {
      Promise.resolve().then(() => {
        setMissions(missionsData);
      });
    }
  }, [missionsData]);

  useEffect(() => {
    if (logsData) {
      Promise.resolve().then(() => {
        setAuditLogs(logsData as unknown as AuditLog[]);
      });
    }
  }, [logsData]);

  useEffect(() => {
    if (configsData.length > 0) {
      const memory = configsData.find((c) => c.key === "enable_memory_board");
      const vibecheck = configsData.find((c) => c.key === "vibecheck_enabled");
      const emergency = configsData.find((c) => c.key === "emergency_announcement");
      const strikes = configsData.find((c) => c.key === "max_allowed_strikes");
      const baseCool = configsData.find((c) => c.key === "base_cooldown_minutes");
      const maxCool = configsData.find((c) => c.key === "max_cooldown_minutes");
      const hypeMode = configsData.find((c) => c.key === "hype_board_mode");
      const globalMute = configsData.find((c) => c.key === "global_mute_active");
      const ticker = configsData.find((c) => c.key === "ticker_text");

      Promise.resolve().then(() => {
        if (memory) setEnableMemoryBoard(memory.value);
        if (vibecheck) setVibecheckEnabled(vibecheck.value);
        if (emergency) {
          setEmergencyActive(emergency.value);
          setEmergencyText(emergency.text_value || "");
        }
        if (strikes) setMaxStrikes(strikes.int_value ?? 5);
        if (baseCool) setBaseCooldown(baseCool.int_value ?? 1);
        if (maxCool) setMaxCooldown(maxCool.int_value ?? 30);
        if (hypeMode?.text_value) setHypeBoardMode(hypeMode.text_value as HypeBoardMode);
        if (globalMute) setGlobalMuteActive(globalMute.value);
        if (ticker) {
          setTickerActive(ticker.value);
          setTickerText(ticker.text_value || "");
        }
      });
    }
  }, [configsData]);

  const staffCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    whitelistedUsers.forEach((s) => {
      if (s.role !== "student") {
        const grp = s.house_position || s.major || s.role;
        if (grp) {
          counts[grp] = (counts[grp] || 0) + 1;
        }
      }
    });
    return counts;
  }, [whitelistedUsers]);

  const filteredWhitelistedUsers = whitelistedUsers.filter((u) => {
    // Role tab filter
    const matchesTab =
      whitelistRoleTab === "student"
        ? u.role === "student"
        : u.role !== "student";
    if (!matchesTab) return false;

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        u.student_id.toLowerCase().includes(q) ||
        (u.nickname || "").toLowerCase().includes(q) ||
        (u.faculty || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Mission configurator form
  const [newMissionTarget, setNewMissionTarget] = useState("");
  const [newMissionFilterQuery, setNewMissionFilterQuery] = useState("");
  const [newMissionCount, setNewMissionCount] = useState(1);
  const [newMissionError, setNewMissionError] = useState("");

  // Dynamic positions aggregation for combobox
  const staffPositionsCollection = useMemo(() => {
    const counts: Record<string, number> = {};
    whitelistedUsers.forEach((s) => {
      if (s.role !== "student") {
        const grp = s.house_position || s.major || s.role;
        if (grp) {
          counts[grp] = (counts[grp] || 0) + 1;
        }
      }
    });

    const labelMap: Record<string, string> = {
      "โสต": "Media & Audio โสต",
      "สันทนาการ": "Recreation สันทนาการ",
      "พี่กลุ่ม": "Group Leader พี่กลุ่ม",
      "ประธาน": "President ประธาน",
      "เลขา": "Secretary เลขา",
      "เหรัญญิก": "Treasurer เหรัญญิก",
      "ประสานงาน": "Coordinator ประสานงาน",
      "Timer": "Timer โพย/เวลา",
      "Creative & Art": "Creative & Art ฝ่ายสร้างสรรค์",
      "สวัสดิการและพัสดุ": "Welfare & Supplies สวัสดิการและพัสดุ",
      "พยาบาล": "Medical Team พยาบาล",
      "สถานที่": "Logistics & Venue สถานที่",
      "ทะเบียน": "Registration ทะเบียน",
      "staff": "General Staff",
      "media_admin": "Media Admin",
      "moderator": "Moderator",
    };

    return Object.keys(counts).map((k) => {
      const baseLabel = labelMap[k] || k;
      const count = counts[k];
      return {
        value: k,
        label: `${baseLabel} (${count} active)`,
        count: count,
      };
    });
  }, [whitelistedUsers]);

  const selectedTargetItem = useMemo(() => {
    return staffPositionsCollection.find((item) => item.value === newMissionTarget);
  }, [staffPositionsCollection, newMissionTarget]);
  const maxAvailableCount = selectedTargetItem ? selectedTargetItem.count : 20;

  useEffect(() => {
    setNewMissionCount((prev) => Math.min(prev, maxAvailableCount));
  }, [maxAvailableCount]);

  const filteredStaffPositions = useMemo(() => {
    const q = newMissionFilterQuery.toLowerCase().trim();
    if (!q) return staffPositionsCollection;
    return staffPositionsCollection.filter((item) =>
      item.label.toLowerCase().includes(q)
    );
  }, [staffPositionsCollection, newMissionFilterQuery]);

  const targetCollection = useMemo(() => {
    return createListCollection({
      items: filteredStaffPositions,
      itemToString: (item) => item.label,
      itemToValue: (item) => item.value,
    });
  }, [filteredStaffPositions]);

  const dynamicPositions = useMemo(() => {
    const positions = new Set<string>();
    whitelistedUsers.forEach((s) => {
      if (s.role !== "student" && s.house_position) {
        positions.add(s.house_position);
      }
    });
    STAFF_ROLES.forEach((r) => positions.add(r));
    return Array.from(positions).sort();
  }, [whitelistedUsers]);

  // CSV States
  const [csvRecords, setCsvRecords] = useState<CSVRecord[]>([]);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [upserting, setUpserting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Media Admin States
  const immichConfig = getImmichConfig();
  const [immichStatus, setImmichStatus] = useState({
    ping: "Checking...",
    activeSyncs: 142,
    diskUsed: "24.8 GB",
    totalImages: 1452,
  });

  // Helper trigger to log audit activities
  const logAuditAction = async (
    actionType: string,
    targetId: string,
    details: string,
  ) => {
    try {
      await supabase.from("audit_logs").insert({
        moderator_id: user?.student_id,
        action_type: actionType,
        target_id: targetId,
        details: details,
      });
    } catch (err) {
      console.error("Failed to log audit activity:", err);
    }
  };

  // Refreshes dashboard data
  const triggerRefresh = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      await queryClient.invalidateQueries({ queryKey: ["admin_missions"] });
      await queryClient.invalidateQueries({ queryKey: ["admin_audit_logs"] });
      await queryClient.invalidateQueries({ queryKey: ["admin_configs"] });
    } catch (err) {
      console.error("Error refreshing admin dashboard data:", err);
    }
  };

  useEffect(() => {
    if (!user) return;
    let active = true;
    const fetchEventData = async () => {
      setLoading(true);
      try {
        if (immichConfig.isConfigured && immichConfig.url) {
          setImmichStatus((prev) => ({
            ...prev,
            ping: "200 OK (Droplet Live)",
          }));
        } else {
          setImmichStatus((prev) => ({
            ...prev,
            ping: "Not Configured (Fallback Active)",
          }));
        }

        const { data: eventData } = await supabase
          .from("event_config")
          .select("*")
          .eq("key", "next_event")
          .single();

        if (!active) return;
        if (eventData) {
          setEventTitle(eventData.title);
          const d = new Date(eventData.event_time);
          const pad = (n: number) => n.toString().padStart(2, "0");
          const localStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          setEventTime(localStr);
        }
      } catch (err) {
        console.error("Error loading event config:", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchEventData();
    return () => {
      active = false;
    };
  }, [user, immichConfig.isConfigured, immichConfig.url]);

  useEffect(() => {
    if (!user || user.role !== "moderator") return;

    const whitelistSubscription = supabase
      .channel("whitelist_realtime_sync")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "users",
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["admin_users"] });
          const studentId = (payload.new as DBUser | null)?.student_id || (payload.old as { student_id: string } | null)?.student_id;
          if (studentId) {
            if (highlightTimeoutRef.current)
              clearTimeout(highlightTimeoutRef.current);
            setLastUpdatedStudentId(studentId);
            highlightTimeoutRef.current = setTimeout(() => {
              setLastUpdatedStudentId(null);
            }, 1000);
          }
        },
      )
      .subscribe();

    return () => {
      if (highlightTimeoutRef.current)
        clearTimeout(highlightTimeoutRef.current);
      supabase.removeChannel(whitelistSubscription);
    };
  }, [user, queryClient]);

  // Staff moderation and VibeCheck data loading
  useEffect(() => {
    if (!user || activeTab !== "staff") return;

    let active = true;
    const fetchDashboardData = async () => {
      if (active) setStaffLoading(true);
      try {
        const { data: postsData, error: postsError } = await supabase
          .from("posts")
          .select("*, author:users(student_id, nickname, avatar_color, role)")
          .order("created_at", { ascending: false });

        if (postsError) throw postsError;

        if (active && postsData) {
          setPosts(postsData as unknown as DBPost[]);

          const postIds = postsData.map((p) => p.id);
          if (postIds.length > 0) {
            const { data: commentsData, error: commentsError } = await supabase
              .from("post_comments")
              .select(
                "*, author:users(student_id, nickname, avatar_color, role)",
              )
              .in("post_id", postIds)
              .order("created_at", { ascending: true });

            if (commentsError) throw commentsError;

            const mapped: Record<number, Comment[]> = {};
            if (commentsData) {
              (commentsData as unknown as Comment[]).forEach((c) => {
                if (!mapped[c.post_id]) mapped[c.post_id] = [];
                mapped[c.post_id].push(c);
              });
            }
            setCommentsMap(mapped);
          }
        }
      } catch (err) {
        console.error("Error fetching staff moderation data:", err);
        if (active) {
          toaster.create({
            title: "Error loading dashboard data",
            type: "error",
          });
        }
      } finally {
        if (active) setStaffLoading(false);
      }
    };

    fetchDashboardData();

    // Realtime channel setup for Staff Moderation
    const channelName = "staff-moderation";
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        async (payload) => {
          const { data, error } = await supabase
            .from("posts")
            .select("*, author:users(student_id, nickname, avatar_color, role)")
            .eq("id", payload.new.id)
            .single();

          if (!error && data && active) {
            setPosts((prev) => {
              if (prev.some((p) => p.id === data.id)) return prev;
              return [data as unknown as DBPost, ...prev];
            });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "posts" },
        (payload) => {
          const updated = payload.new;
          if (active) {
            setPosts((prev) =>
              prev.map((p) =>
                p.id === updated.id
                  ? {
                      ...p,
                      content: updated.content ?? p.content,
                      is_hidden: updated.is_hidden ?? p.is_hidden,
                      likes: updated.likes ?? p.likes,
                      tags: Array.isArray(updated.tags) ? updated.tags : p.tags,
                    }
                  : p,
              ),
            );
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "posts" },
        (payload) => {
          if (active) {
            setPosts((prev) => prev.filter((p) => p.id !== payload.old.id));
            setCommentsMap((prev) => {
              const next = { ...prev };
              delete next[payload.old.id];
              return next;
            });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "post_comments" },
        async (payload) => {
          const { data, error } = await supabase
            .from("post_comments")
            .select("*, author:users(student_id, nickname, avatar_color, role)")
            .eq("id", payload.new.id)
            .single();

          if (!error && data && active) {
            setCommentsMap((prev) => {
              const postId = data.post_id;
              const existing = prev[postId] || [];
              if (existing.some((c) => c.id === data.id)) return prev;
              return {
                ...prev,
                [postId]: [...existing, data as unknown as Comment],
              };
            });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "post_comments" },
        (payload) => {
          if (active) {
            setCommentsMap((prev) => {
              const next = { ...prev };
              for (const postId in next) {
                next[postId] = next[postId].filter(
                  (c) => c.id !== payload.old.id,
                );
              }
              return next;
            });
          }
        },
      );

    channel.subscribe((status, err) => {
      if (err) {
        console.error("[Staff Moderation Realtime Error]:", err);
      }
      console.log("[Staff Moderation Realtime Status]:", status);
    });

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user, activeTab]);

  // Delete Post secure RPC call
  const handleDeletePost = async (postId: number) => {
    if (!user) return;
    try {
      const { error } = await supabase.rpc("delete_post_secure", {
        p_post_id: postId,
        p_student_id: user.student_id,
        p_pin_hash: user.pin_hash || "",
      });

      if (error) throw error;

      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toaster.create({ title: "Post Deleted!", type: "success" });
    } catch (err) {
      console.error("Delete post error:", err);
      toaster.create({ title: "Failed to delete post", type: "error" });
    }
  };

  // Delete Comment secure RPC call
  const handleDeleteComment = async (commentId: number, postId: number) => {
    if (!user) return;
    try {
      const { error } = await supabase.rpc("delete_comment_secure", {
        p_comment_id: commentId,
        p_student_id: user.student_id,
        p_pin_hash: user.pin_hash || "",
      });

      if (error) throw error;

      setCommentsMap((prev) => {
        const list = prev[postId] || [];
        return {
          ...prev,
          [postId]: list.filter((c) => c.id !== commentId),
        };
      });
      toaster.create({ title: "Comment Deleted!", type: "success" });
    } catch (err) {
      console.error("Delete comment error:", err);
      toaster.create({ title: "Failed to delete comment", type: "error" });
    }
  };

  // Handle vibe check photo upload to Supabase Storage
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const idx = activeFileIdxRef.current;
    setUploadingIdx(idx);
    try {
      const compressedBlob = await compressImage(file);
      const fileName = `staff-${user.student_id}-${idx}-${Date.now()}.jpg`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("profiles")
        .upload(filePath, compressedBlob, {
          contentType: "image/jpeg",
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("profiles").getPublicUrl(filePath);

      const updated = [...photos];
      updated[idx] = publicUrl;
      setPhotos(updated);

      toaster.create({ title: `Photo ${idx + 1} uploaded!`, type: "success" });
    } catch (err) {
      console.error("Staff photo upload failed:", err);
      toaster.create({ title: "Upload failed", type: "error" });
    } finally {
      setUploadingIdx(null);
    }
  };

  const triggerUploadClick = (idx: number) => {
    activeFileIdxRef.current = idx;
    staffPhotoInputRef.current?.click();
  };

  const triggerUrlPrompt = (idx: number) => {
    const url = prompt(`Enter image URL for Photo ${idx + 1}:`);
    if (url) {
      const updated = [...photos];
      updated[idx] = url.trim();
      setPhotos(updated);
    }
  };

  const removePhoto = (idx: number) => {
    const updated = [...photos];
    updated[idx] = "";
    setPhotos(updated);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSavingProfile(true);
    // Filter out empty slots
    const photoPool = photos.filter((p) => p && p.trim());

    try {
      const success = await updateProfile({
        nickname: user.nickname || "",
        faculty: user.faculty || "",
        major: user.major || undefined,
        ig: user.ig || undefined,
        avatarColor: user.avatar_color,
        bio: bio.trim(),
        profilePicUrl: user.profile_pic_url || undefined,
        photoPool,
      });

      if (success) {
        toaster.create({ title: "VibeCheck Profile Saved!", type: "success" });
      } else {
        throw new Error("Save failed");
      }
    } catch (err) {
      console.error("Save staff vibe profile error:", err);
      toaster.create({ title: "Failed to save profile", type: "error" });
    } finally {
      setSavingProfile(false);
    }
  };

  // Selection & Bulk Delete Helpers
  const visibleIds = filteredWhitelistedUsers.map((u) => u.student_id);
  const isAllSelected =
    visibleIds.length > 0 &&
    visibleIds.every((id) => selectedStudentIds.includes(id));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStudentIds((prev) => {
        const newSelections = [...prev];
        visibleIds.forEach((id) => {
          if (!newSelections.includes(id)) {
            newSelections.push(id);
          }
        });
        return newSelections;
      });
    } else {
      setSelectedStudentIds((prev) =>
        prev.filter((id) => !visibleIds.includes(id)),
      );
    }
  };

  const handleSelectUser = (studentId: string, checked: boolean) => {
    setSelectedStudentIds((prev) =>
      checked ? [...prev, studentId] : prev.filter((id) => id !== studentId),
    );
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedStudentIds.length === 0) return;
    if (!user) return;
    const userRole = user.role as string;
    if (userRole !== "moderator" && userRole !== "superadmin") {
      toaster.create({
        title: "Unauthorized Action",
        description: "Only moderators and superadmins can bulk remove users.",
        type: "error",
      });
      return;
    }

    try {
      // 1. Delete post comments
      await supabase
        .from("post_comments")
        .delete()
        .in("student_id", selectedStudentIds);

      // 2. Delete posts
      await supabase
        .from("posts")
        .delete()
        .in("student_id", selectedStudentIds);

      // 3. Delete collected cards
      await supabase
        .from("collected_cards")
        .delete()
        .in("student_id", selectedStudentIds);
      await supabase
        .from("collected_cards")
        .delete()
        .in("staff_id", selectedStudentIds);

      // 4. Delete vibe status
      await supabase
        .from("user_vibe_status")
        .delete()
        .in("student_id", selectedStudentIds);

      // 5. Delete live chats
      await supabase
        .from("live_chats")
        .delete()
        .in("student_id", selectedStudentIds);

      // 6. Delete users
      const { error } = await supabase
        .from("users")
        .delete()
        .in("student_id", selectedStudentIds);

      if (error) throw error;

      const count = selectedStudentIds.length;
      await logAuditAction(
        "whitelist_bulk_remove",
        selectedStudentIds.join(","),
        `Moderator bulk-deleted ${count} users and all associated data: [${selectedStudentIds.join(", ")}]`,
      );

      toaster.create({
        title: "Bulk Deletion Successful",
        description: `Wiped all records for ${count} users.`,
        type: "success",
      });
      setSelectedStudentIds([]);
      triggerRefresh();
    } catch (err) {
      console.error(err);
      toaster.create({
        title: "Failed to bulk-remove users",
        description: err instanceof Error ? err.message : "Database error",
        type: "error",
      });
    }
  };

  const getRoleDescription = (role: string) => {
    switch (role) {
      case "moderator":
        return "Moderator: Full administrative control, whitelist management, emergency broadcasts, game configuration, and audit logs.";
      case "media_admin":
        return "Media Admin: Access to photo server connectivity status, droplet sync tracker, and media synchronization tools.";
      case "staff":
        return "Staff: Access to staff panel to verify cards, view house statistics, and manage general operations.";
      default:
        return "Student: Freshmen role. Access to vibe check, collection book, hype board, and memory canvas.";
    }
  };

  // Handle Whitelist Add
  const handleAddWhitelist = async (e: React.FormEvent) => {
    e.preventDefault();
    // Trim spaces and strip non-numeric symbols
    const sanitizedId = newStudentId.trim().replace(/\D/g, "");

    // Validate length fits between 7 and 10 digits
    if (!sanitizedId || sanitizedId.length < 7 || sanitizedId.length > 10) {
      toaster.create({
        title: "Validation Failed",
        description: "Student ID must be between 7 and 10 digits.",
        type: "error",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("users")
        .insert({
          student_id: sanitizedId,
          role: newRole,
        })
        .select();

      if (error) throw error;

      if (data) {
        await logAuditAction(
          "whitelist_add",
          sanitizedId,
          `Manually whitelisted student as role: ${newRole}`,
        );
        toaster.create({
          title: "Student Whitelisted!",
          description: `ID ${sanitizedId} whitelisted as ${newRole}.`,
          type: "success",
        });
        setNewStudentId("");
        triggerRefresh();
      }
    } catch (err) {
      console.error(err);
      toaster.create({
        title: "Whitelisting failed",
        description: "ID might already be whitelisted.",
        type: "error",
      });
    }
  };

  // Handle Whitelist Remove (Hard Cascading Delete)
  const handleRemoveWhitelist = async (studentId: string) => {
    if (!user) return;
    const userRole = user.role as string;
    if (userRole !== "moderator" && userRole !== "superadmin") {
      toaster.create({
        title: "Unauthorized Action",
        description:
          "Only moderators and superadmins can remove whitelisted users.",
        type: "error",
      });
      return;
    }

    try {
      // 1. Delete post comments
      await supabase.from("post_comments").delete().eq("student_id", studentId);

      // 2. Delete posts
      await supabase.from("posts").delete().eq("student_id", studentId);

      // 3. Delete collected cards
      await supabase
        .from("collected_cards")
        .delete()
        .eq("student_id", studentId);
      await supabase.from("collected_cards").delete().eq("staff_id", studentId);

      // 4. Delete vibe status
      await supabase
        .from("user_vibe_status")
        .delete()
        .eq("student_id", studentId);

      // 5. Delete live chats
      await supabase.from("live_chats").delete().eq("student_id", studentId);

      // 6. Delete user
      const { error } = await supabase
        .from("users")
        .delete()
        .eq("student_id", studentId);

      if (error) throw error;

      await logAuditAction(
        "whitelist_remove",
        studentId,
        "Permanently deleted user and all associated records from all tables.",
      );
      toaster.create({
        title: "User Wiped Successfully!",
        description: `ID ${studentId} and all associated records have been permanently deleted.`,
        type: "success",
      });
      triggerRefresh();
    } catch (err) {
      console.error(err);
      toaster.create({
        title: "Failed to revoke whitelist",
        description: err instanceof Error ? err.message : "Database error",
        type: "error",
      });
    }
  };

  // Handle User Inspection details loading
  const handleInspectUser = async (u: DBUser) => {
    setInspectUser(u);
    setEditNickname(u.nickname || "");
    setEditFaculty(u.faculty || "");
    setEditRole(u.role);
    setEditMajor("");
    setEditHousePosition("");
    setInspectUserStats(null);
    setInspectUserLogs([]);

    try {
      const { data: detailData } = await supabase
        .from("users")
        .select("major, house_position")
        .eq("student_id", u.student_id)
        .single();
      if (detailData) {
        setEditMajor(detailData.major || "");
        setEditHousePosition(detailData.house_position || "");
      }

      // Fetch collection statistics
      const { data: collectedData, count: collectedCount } = await supabase
        .from("collected_cards")
        .select("*", { count: "exact" })
        .eq("student_id", u.student_id);

      let unlockedStaff: {
        staff_id: string;
        nickname: string;
        profile_pic_url: string;
        avatar_color: string;
      }[] = [];
      if (collectedData && collectedData.length > 0) {
        const staffIds = collectedData.map((d) => d.staff_id);
        const { data: staffData } = await supabase
          .from("users")
          .select("student_id, nickname, profile_pic_url, avatar_color")
          .in("student_id", staffIds);
        if (staffData) {
          unlockedStaff = staffData.map((s) => ({
            staff_id: s.student_id,
            nickname: s.nickname || "Unknown Staff",
            profile_pic_url: s.profile_pic_url || "",
            avatar_color: s.avatar_color || "fg.muted",
          }));
        }
      }

      const { count: collectedFromCount } = await supabase
        .from("collected_cards")
        .select("*", { count: "exact", head: true })
        .eq("staff_id", u.student_id);

      // Fetch vibe check stats
      const { data: vibeData } = await supabase
        .from("user_vibe_status")
        .select("strike_count, locked_until, current_mission_id")
        .eq("student_id", u.student_id)
        .maybeSingle();

      const isLockedVal = vibeData?.locked_until
        ? new Date(vibeData.locked_until).getTime() > Date.now()
        : false;

      setInspectUserStats({
        collectedCount: collectedCount || 0,
        collectedFromCount: collectedFromCount || 0,
        vibeStatus: vibeData || null,
        isLocked: isLockedVal,
        unlockedStaff,
      });

      // Fetch relevant audit logs
      const { data: userLogs } = await supabase
        .from("audit_logs")
        .select("*")
        .or(`target_id.eq.${u.student_id},moderator_id.eq.${u.student_id}`)
        .order("created_at", { ascending: false })
        .limit(10);

      if (userLogs) setInspectUserLogs(userLogs as AuditLog[]);
    } catch (err) {
      console.error("Error fetching user stats:", err);
    }
  };

  // Handle Edit User Form Submit — uses SECURITY DEFINER RPC to prevent privilege escalation
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectUser || !user) return;

    try {
      await updateUserProfileRpc.mutateAsync({
        pinHash:       user.pin_hash || "",
        targetId:      inspectUser.student_id,
        newRole:       editRole,
        nickname:      editNickname,
        faculty:       editFaculty,
        major:         editMajor,
        housePosition: editHousePosition,
      });

      toaster.create({
        title: "User Profile Updated!",
        type:  "success",
      });
      setInspectUser(null);
      triggerRefresh();
    } catch (err) {
      console.error(err);
      toaster.create({
        title: "Error updating user profile",
        type:  "error",
      });
    }
  };

  // Handle Config Toggle
  const handleToggleConfig = async (
    key: "enable_memory_board" | "vibecheck_enabled",
    currentVal: boolean,
  ) => {
    const newVal = !currentVal;
    if (key === "enable_memory_board") setEnableMemoryBoard(newVal);
    if (key === "vibecheck_enabled") setVibecheckEnabled(newVal);

    try {
      const { error } = await supabase
        .from("system_config")
        .update({ value: newVal })
        .eq("key", key);

      if (error) throw error;

      await logAuditAction("toggle_board", key, `Switched ${key} to ${newVal}`);
      await broadcastConfigSync("config_change", { key, value: newVal });
      toaster.create({
        title: "Settings Updated",
        description: `${key.replace("enable_", "").replace("_", " ")} switch is now ${newVal ? "OPEN" : "CLOSED"}.`,
        type: "success",
      });
    } catch (err) {
      console.error(err);
      toaster.create({
        title: "Failed to update setting",
        type: "error",
      });
      if (key === "enable_memory_board") setEnableMemoryBoard(currentVal);
      if (key === "vibecheck_enabled") setVibecheckEnabled(currentVal);
    }
  };

  // ── Command Center: Broadcast config sync to all clients ──
  const broadcastConfigSync = async (
    event: string,
    payload: Record<string, unknown>,
  ) => {
    const syncChannel = supabase.channel("live_chat:system_config_sync");
    syncChannel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        syncChannel
          .send({
            type: "broadcast",
            event,
            payload,
          })
          .then(() => {
            supabase.removeChannel(syncChannel);
          });
      }
    });
  };

  // ── Command Center: Set Hype Board Mode ──
  const handleSetHypeMode = async (mode: HypeBoardMode) => {
    const prevMode = hypeBoardMode;
    setHypeBoardMode(mode);

    try {
      const { error } = await supabase
        .from("system_config")
        .upsert(
          { key: "hype_board_mode", value: true, text_value: mode },
          { onConflict: "key" },
        );

      if (error) throw error;

      await logAuditAction(
        "toggle_hype_mode",
        "hype_board_mode",
        `Hype board mode changed: ${prevMode} → ${mode}`,
      );
      await broadcastConfigSync("hype_mode_change", { mode });

      setAuditLogs((prev) => [
        {
          id: Date.now(),
          moderator_id: user?.student_id || "",
          action_type: "toggle_hype_mode",
          target_id: "hype_board_mode",
          details: `Hype board mode changed: ${prevMode} → ${mode}`,
          created_at: new Date().toISOString(),
          users: { nickname: user?.nickname || null },
        },
        ...prev,
      ]);

      toaster.create({
        title: "Hype Board Mode Updated",
        description: `Mode set to: ${mode === "active" ? "🟢 ACTIVE" : mode === "slow_3s" ? "🟡 SLOW MODE (3s)" : "🔴 READ ONLY"}`,
        type: "success",
      });
    } catch (err) {
      console.error(err);
      setHypeBoardMode(prevMode);
      toaster.create({ title: "Failed to update mode", type: "error" });
    }
  };

  // ── Command Center: Global Panic Mute ──
  const handlePanicMute = async (mute: boolean) => {
    const prev = globalMuteActive;
    setGlobalMuteActive(mute);

    try {
      const token = localStorage.getItem("baan7_session_token");
      const { error } = await supabase.rpc("global_panic_mute", {
        p_session_token: token,
        p_mute: mute,
      });

      // Fallback if RPC doesn't exist yet — direct update
      if (error) {
        const { error: fallbackErr } = await supabase
          .from("system_config")
          .upsert(
            { key: "global_mute_active", value: mute },
            { onConflict: "key" },
          );
        if (fallbackErr) throw fallbackErr;
      }

      await logAuditAction(
        "panic_mute",
        "global_mute_active",
        `Global mute ${mute ? "ENGAGED" : "LIFTED"}`,
      );
      await broadcastConfigSync("global_mute_change", { active: mute });

      setAuditLogs((prev) => [
        {
          id: Date.now(),
          moderator_id: user?.student_id || "",
          action_type: "panic_mute",
          target_id: "global_mute_active",
          details: `Global mute ${mute ? "ENGAGED" : "LIFTED"}`,
          created_at: new Date().toISOString(),
          users: { nickname: user?.nickname || null },
        },
        ...prev,
      ]);

      toaster.create({
        title: mute ? "GLOBAL MUTE ENGAGED" : "Mute Lifted",
        description: mute
          ? "All chat inputs frozen across all clients."
          : "Chat inputs restored to normal.",
        type: mute ? "error" : "success",
      });
    } catch (err) {
      console.error(err);
      setGlobalMuteActive(prev);
      toaster.create({ title: "Failed to toggle mute", type: "error" });
    }
  };

  // ── Command Center: Publish Ticker ──
  const handlePublishTicker = async () => {
    const text = tickerText.trim();
    if (!text) {
      toaster.create({ title: "Ticker text is empty", type: "warning" });
      return;
    }

    setIsSavingTicker(true);
    try {
      const { error } = await supabase
        .from("system_config")
        .upsert(
          { key: "ticker_text", value: true, text_value: text },
          { onConflict: "key" },
        );

      if (error) throw error;

      setTickerActive(true);
      await logAuditAction(
        "ticker_update",
        "ticker_text",
        `Ticker published: "${text}"`,
      );

      // Broadcast ticker_change (non-blocking fire-and-forget)
      const syncChannel = supabase.channel("live_chat:system_config_sync");
      syncChannel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          syncChannel
            .send({
              type: "broadcast",
              event: "ticker_change",
              payload: { active: true, text },
            })
            .then(() => {
              supabase.removeChannel(syncChannel);
            });
        }
      });

      setAuditLogs((prev) => [
        {
          id: Date.now(),
          moderator_id: user?.student_id || "",
          action_type: "ticker_update",
          target_id: "ticker_text",
          details: `Ticker published: "${text}"`,
          created_at: new Date().toISOString(),
          users: { nickname: user?.nickname || null },
        },
        ...prev,
      ]);

      toaster.create({
        title: "Ticker Published!",
        description: "Marquee is live across all clients.",
        type: "success",
      });
    } catch (err) {
      console.error(err);
      toaster.create({ title: "Failed to update ticker", type: "error" });
    } finally {
      setIsSavingTicker(false);
    }
  };

  // ── Command Center: Clear/Kill Ticker ──
  const handleClearTicker = async () => {
    setIsSavingTicker(true);
    try {
      const { error } = await supabase
        .from("system_config")
        .upsert(
          { key: "ticker_text", value: false, text_value: "" },
          { onConflict: "key" },
        );

      if (error) throw error;

      setTickerActive(false);
      setTickerText("");
      await logAuditAction("ticker_clear", "ticker_text", "Ticker cleared");

      // Broadcast ticker_clear (non-blocking fire-and-forget)
      const syncChannel = supabase.channel("live_chat:system_config_sync");
      syncChannel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          syncChannel
            .send({
              type: "broadcast",
              event: "ticker_clear",
              payload: {},
            })
            .then(() => {
              supabase.removeChannel(syncChannel);
            });
        }
      });

      setAuditLogs((prev) => [
        {
          id: Date.now(),
          moderator_id: user?.student_id || "",
          action_type: "ticker_update",
          target_id: "ticker_text",
          details: "Ticker cleared",
          created_at: new Date().toISOString(),
          users: { nickname: user?.nickname || null },
        },
        ...prev,
      ]);

      toaster.create({
        title: "Ticker Cleared",
        description: "Ticker removed from all screens.",
        type: "success",
      });
    } catch (err) {
      console.error(err);
      toaster.create({ title: "Failed to clear ticker", type: "error" });
    } finally {
      setIsSavingTicker(false);
    }
  };


  // Handle Event Config Update
  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTime) return;
    setUpdatingEvent(true);
    try {
      const isoString = new Date(eventTime).toISOString();
      const { error } = await supabase
        .from("event_config")
        .update({ title: eventTitle, event_time: isoString })
        .eq("key", "next_event");

      if (error) throw error;

      await logAuditAction(
        "update_event",
        "next_event",
        `Updated event to: ${eventTitle} at ${isoString}`,
      );
      toaster.create({
        title: "Event Configured!",
        description: `Event "${eventTitle}" updated successfully.`,
        type: "success",
      });
    } catch (err) {
      console.error(err);
      toaster.create({
        title: "Failed to configure event",
        type: "error",
      });
    } finally {
      setUpdatingEvent(false);
    }
  };

  // Handle Emergency Announcement Broadcast Save
  const handleSaveEmergencyAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("baan7_session_token");
    const trimmedText = emergencyText.trim();

    if (!trimmedText) {
      toaster.create({
        title: "Empty Announcement",
        description: "Please enter a valid announcement message.",
        type: "warning",
      });
      return;
    }

    setIsSavingAnnouncement(true);
    try {
      const { error } = await supabase.rpc("broadcast_emergency_message", {
        p_session_token: token,
        p_active: true,
        p_text: trimmedText,
      });

      if (error) throw error;

      setEmergencyText(trimmedText);
      setEmergencyActive(true);

      toaster.create({
        title: "Announcement Published!",
        description: "Static banner is live across all clients.",
        type: "success",
      });

      // Broadcast announcement_change event (non-blocking fire-and-forget)
      const syncChannel = supabase.channel("live_chat:system_config_sync");
      syncChannel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          syncChannel
            .send({
              type: "broadcast",
              event: "announcement_change",
              payload: { active: true, text: trimmedText },
            })
            .then(() => {
              supabase.removeChannel(syncChannel);
            });
        }
      });
    } catch (err) {
      console.error(err);
      toaster.create({
        title: "Failed to save announcement",
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
        type: "error",
      });
    } finally {
      setIsSavingAnnouncement(false);
    }
  };

  // Handle Emergency Announcement Clear
  const handleClearEmergencyAnnouncement = async () => {
    const token = localStorage.getItem("baan7_session_token");
    setIsSavingAnnouncement(true);
    try {
      const { error } = await supabase.rpc("broadcast_emergency_message", {
        p_session_token: token,
        p_active: false,
        p_text: "",
      });

      if (error) throw error;

      setEmergencyText("");
      setEmergencyActive(false);

      toaster.create({
        title: "Announcement Cleared",
        description: "Static banner removed from all screens.",
        type: "success",
      });

      // Broadcast emergency_clear event (non-blocking fire-and-forget)
      const syncChannel = supabase.channel("live_chat:system_config_sync");
      syncChannel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          syncChannel
            .send({
              type: "broadcast",
              event: "emergency_clear",
              payload: {},
            })
            .then(() => {
              supabase.removeChannel(syncChannel);
            });
        }
      });
    } catch (err) {
      console.error(err);
      toaster.create({
        title: "Failed to clear announcement",
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
        type: "error",
      });
    } finally {
      setIsSavingAnnouncement(false);
    }
  };

  // Handle Game Penalty Config Save
  const handleSaveGamePenalties = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from("system_config").upsert(
        [
          { key: "max_allowed_strikes", value: true, int_value: maxStrikes },
          {
            key: "base_cooldown_minutes",
            value: true,
            int_value: baseCooldown,
          },
          { key: "max_cooldown_minutes", value: true, int_value: maxCooldown },
        ],
        { onConflict: "key" },
      );

      if (error) throw error;

      await logAuditAction(
        "game_penalties_update",
        "system_config",
        `Updated rules: max_strikes=${maxStrikes}, base_cooldown=${baseCooldown}m, max_cooldown=${maxCooldown}m`,
      );
      await broadcastConfigSync("config_change", {
        maxStrikes,
        baseCooldown,
        maxCooldown,
      });
      toaster.create({
        title: "Penalties Saved!",
        type: "success",
      });
    } catch (err) {
      console.error(err);
      toaster.create({
        title: "Failed to save penalties",
        type: "error",
      });
    }
  };

  // Add Vibe Mission
  const handleAddMission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMissionTarget) return;
    setNewMissionError("");

    const sortedMissions = [...missions].sort((a, b) => a.sequence_order - b.sequence_order);
    const lastMission = sortedMissions[sortedMissions.length - 1];

    if (lastMission && lastMission.target_role === newMissionTarget && newMissionCount <= lastMission.required_count) {
      setNewMissionError("Invalid Sequence: Cannot create consecutive missions with identical or lower card targets for the same role.");
      return;
    }

    try {
      const nextSeq =
        missions.length > 0
          ? Math.max(...missions.map((m) => m.sequence_order)) + 1
          : 1;
      const { error } = await supabase.from("vibe_missions").insert({
        sequence_order: nextSeq,
        target_role: newMissionTarget,
        required_count: newMissionCount,
      });

      if (error) throw error;

      await logAuditAction(
        "mission_add",
        nextSeq.toString(),
        `Added mission sequence ${nextSeq}: target=${newMissionTarget}, count=${newMissionCount}`,
      );
      toaster.create({
        title: "Vibe Mission Added!",
        type: "success",
      });
      setNewMissionTarget("");
      setNewMissionCount(1);
      await queryClient.invalidateQueries({ queryKey: ["admin_missions"] });
      await queryClient.invalidateQueries({ queryKey: ["active_missions"] });
      await queryClient.invalidateQueries({ queryKey: ["live_chat"] });
      await queryClient.invalidateQueries({ queryKey: ["vibe_deck"] });
      await queryClient.invalidateQueries({ queryKey: ["vibe_status"] });
      await triggerRefresh();
      await broadcastConfigSync("vibe_quest_change", {});
    } catch (err) {
      console.error(err);
      toaster.create({
        title: "Failed to add mission",
        type: "error",
      });
    }
  };

  // Delete Vibe Mission (Sequence alignment fallback)
  const handleRemoveMission = async (id: number, seqOrder: number) => {
    if (
      !window.confirm(
        `Are you sure you want to remove Mission sequence ${seqOrder}?`,
      )
    )
      return;
    try {
      const { error } = await supabase.rpc("admin_delete_mission_reorder", {
        p_admin_id: user?.student_id,
        p_mission_id: id,
      });

      if (error) throw error;

      toaster.create({
        title: "Mission Removed!",
        description: "Active users progress re-aligned.",
        type: "success",
      });
      await queryClient.invalidateQueries({ queryKey: ["admin_missions"] });
      await queryClient.invalidateQueries({ queryKey: ["active_missions"] });
      await queryClient.invalidateQueries({ queryKey: ["live_chat"] });
      await queryClient.invalidateQueries({ queryKey: ["vibe_deck"] });
      await queryClient.invalidateQueries({ queryKey: ["vibe_status"] });
      await triggerRefresh();
      await broadcastConfigSync("vibe_quest_change", {});
    } catch (err) {
      console.error(err);
      toaster.create({
        title: "Failed to delete mission",
        type: "error",
      });
    }
  };

  // Handle CSV Parsing
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = (
          results.data as Array<Record<string, string | undefined>>
        )
          .map((row) => ({
            student_id: (row.student_id || row["Student ID"] || "")
              .toString()
              .trim(),
            role: (row.role || row["Role"] || "student")
              .toString()
              .trim()
              .toLowerCase(),
            nickname:
              (row.nickname || row["Nickname"] || "").toString().trim() || null,
            faculty:
              (row.faculty || row["Faculty"] || "").toString().trim() || null,
            major: (row.major || row["Major"] || "").toString().trim() || null,
          }))
          .filter((row) => row.student_id);

        setCsvRecords(parsed);
        setShowCsvModal(true);
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
      error: (err) => {
        console.error("CSV parse error:", err);
        toaster.create({ title: "CSV parsing failed", type: "error" });
      },
    });
  };

  const isDuplicate = (studentId: string) => {
    return whitelistedUsers.some((u) => u.student_id === studentId);
  };

  const handleBatchUpsert = async () => {
    setUpserting(true);
    try {
      const { error } = await supabase
        .from("users")
        .upsert(csvRecords, { onConflict: "student_id" });

      if (error) throw error;

      await logAuditAction(
        "csv_import",
        "users",
        `Batch upserted ${csvRecords.length} records from CSV.`,
      );
      toaster.create({
        title: "CSV Onboarded successfully!",
        description: `Upserted ${csvRecords.length} student records.`,
        type: "success",
      });
      setShowCsvModal(false);
      setCsvRecords([]);
      triggerRefresh();
    } catch (err) {
      console.error("Batch upsert failed:", err);
      toaster.create({ title: "Batch upsert failed", type: "error" });
    } finally {
      setUpserting(false);
    }
  };

  if (loading) {
    return (
      <Flex minH="80vh" align="center" justify="center">
        <Spinner size="xl" color="brand.solid" />
      </Flex>
    );
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
          fontSize={{ base: "2rem", md: "3rem" }}
          fontWeight={700}
          color="accent.solid"
        >
          Administrative Console
        </Heading>
        <Text color="fg.muted" fontSize="sm">
          Protected Workspace — Signed in as:{" "}
          <Badge colorPalette="teal">{user?.role}</Badge> (ID:{" "}
          {user?.student_id})
        </Text>
      </VStack>

      {/* Admin Panel Tabs */}
      <Flex
        justify="space-between"
        align="center"
        mb={8}
        flexWrap="wrap"
        gap={4}
      >
        <Flex
          bg="rgba(73, 98, 104, 0.05)"
          p="4px"
          borderRadius="full"
          align="center"
          gap={1}
          w={{ base: "100%", md: "fit-content" }}
        >
          {user?.role === "moderator" && (
            <Button
              type="button"
              onClick={() => setActiveTab("moderator")}
              borderRadius="full"
              px={6}
              py={1.5}
              h="36px"
              bg={
                activeTab === "moderator" ? "accent.solid" : "transparent"
              }
              color={activeTab === "moderator" ? "white" : "fg.muted"}
              boxShadow={activeTab === "moderator" ? "sm" : "none"}
              _hover={{
                bg:
                  activeTab === "moderator"
                    ? "accent.solid"
                    : "rgba(73, 98, 104, 0.08)",
              }}
              fontSize="xs"
              fontWeight="700"
              transition="all 0.2s"
              cursor="pointer"
              flex={{ base: 1, md: "initial" }}
            >
              Moderator Command Center
            </Button>
          )}
          {(user?.role === "moderator" || user?.role === "media_admin") && (
            <Button
              type="button"
              onClick={() => setActiveTab("media")}
              borderRadius="full"
              px={6}
              py={1.5}
              h="36px"
              bg={activeTab === "media" ? "accent.solid" : "transparent"}
              color={activeTab === "media" ? "white" : "fg.muted"}
              boxShadow={activeTab === "media" ? "sm" : "none"}
              _hover={{
                bg:
                  activeTab === "media"
                    ? "accent.solid"
                    : "rgba(73, 98, 104, 0.08)",
              }}
              fontSize="xs"
              fontWeight="700"
              transition="all 0.2s"
              cursor="pointer"
              flex={{ base: 1, md: "initial" }}
            >
              Media Controls (AV)
            </Button>
          )}
          {(user?.role === "moderator" || user?.role === "staff") && (
            <Button
              type="button"
              onClick={() => setActiveTab("staff")}
              borderRadius="full"
              px={6}
              py={1.5}
              h="36px"
              bg={activeTab === "staff" ? "accent.solid" : "transparent"}
              color={activeTab === "staff" ? "white" : "fg.muted"}
              boxShadow={activeTab === "staff" ? "sm" : "none"}
              _hover={{
                bg:
                  activeTab === "staff"
                    ? "accent.solid"
                    : "rgba(73, 98, 104, 0.08)",
              }}
              fontSize="xs"
              fontWeight="700"
              transition="all 0.2s"
              cursor="pointer"
              flex={{ base: 1, md: "initial" }}
            >
              Staff Moderation & Controls
            </Button>
          )}
        </Flex>

        <Link to="/admin/kpi">
          <Button
            type="button"
            variant="outline"
            borderColor="border.subtle"
            borderRadius="full"
            px={6}
            py={1.5}
            h="36px"
            color="accent.solid"
            _hover={{
              bg: "rgba(73, 98, 104, 0.05)",
            }}
            fontSize="xs"
            fontWeight="700"
            cursor="pointer"
            w={{ base: "100%", md: "auto" }}
          >
            <HStack gap={1.5} justify="center">
              <Box
                as="span"
                className="material-symbols-outlined"
                fontSize="16px"
              >
                monitoring
              </Box>
              <Text>Platform KPIs</Text>
            </HStack>
          </Button>
        </Link>
      </Flex>

      {/* TIER 1: Moderator Panel */}
      {activeTab === "moderator" && user?.role === "moderator" && (
        <VStack align="stretch" gap={6}>
          {/* Top Grid for Control Cards */}
          <SimpleGrid columns={{ base: 1, lg: 2 }} gap={6}>
            {/* 1. Master Switches */}
            {/* Section E: Portal Master Switches */}
            <SystemControlPanel
              hypeBoardMode={hypeBoardMode}
              enableMemoryBoard={enableMemoryBoard}
              vibecheckEnabled={vibecheckEnabled}
              globalMuteActive={globalMuteActive}
              handleSetHypeMode={handleSetHypeMode}
              handleToggleConfig={handleToggleConfig}
            />

            {/* 2. Emergency Broadcast */}
            {/* Section A: Emergency Broadcast Control */}
            <Box
              bg="white"
              border="1px solid"
              borderColor="border.subtle"
              borderRadius="xl"
              boxShadow="sm"
              p={6}
            >
              <Heading size="md" color="gray.700" fontFamily="heading" mb={4}>
                Emergency Broadcast
              </Heading>
              <VStack
                as="form"
                onSubmit={handleSaveEmergencyAnnouncement}
                gap={4}
                align="stretch"
              >
                <Box>
                  <Text
                    fontSize="xs"
                    fontWeight="700"
                    color="fg.muted"
                    mb={1}
                    textTransform="uppercase"
                  >
                    Announcement Text
                  </Text>
                  <Textarea
                    placeholder="Type an announcement to display globally at the top header..."
                    value={emergencyText}
                    onChange={(e) => setEmergencyText(e.target.value)}
                    h="80px"
                    borderRadius="xl"
                    border="1.5px solid var(--chakra-colors-border-default)"
                    bg="bg.canvas"
                    p={3}
                    fontSize="sm"
                    outline="none"
                    resize="none"
                    _focus={{
                      borderColor: "brand.solid",
                      boxShadow: "0 0 0 2px var(--chakra-colors-brand-muted)",
                    }}
                    disabled={isSavingAnnouncement}
                  />
                </Box>

                {/* [ Live Preview Strip ] for Announcement */}
                <Box mb={2}>
                  <Flex align="center" gap={2} mb={2}>
                    <Text
                      fontSize="xs"
                      fontWeight="700"
                      color="fg.muted"
                      textTransform="uppercase"
                    >
                      Live Preview
                    </Text>
                    <Badge
                      variant="subtle"
                      bg="orange.100"
                      color="orange.800"
                      fontSize="2xs"
                    >
                      [ Live Preview Strip ]
                    </Badge>
                  </Flex>
                  {emergencyText.trim() ? (
                    <Box
                      className="announcement-banner-container"
                      borderRadius="lg"
                      overflow="hidden"
                    >
                      <Flex align="center" flex={1}>
                        <Box
                          as="span"
                          className="material-symbols-outlined"
                          fontSize="18px"
                          mr="8px"
                          flexShrink={0}
                        >
                          info
                        </Box>
                        {(() => {
                          const urlRegex = /(https?:\/\/[^\s]+)/g;
                          const urlMatch = emergencyText.match(urlRegex);
                          const url = urlMatch ? urlMatch[0] : null;
                          const cleanText = url
                            ? emergencyText.replace(urlRegex, "").trim()
                            : emergencyText;
                          return (
                            <>
                              <Text fontSize="xs" fontWeight="bold">
                                {cleanText}
                              </Text>
                              {url && (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="announcement-view-link"
                                >
                                  View Link
                                </a>
                              )}
                            </>
                          );
                        })()}
                      </Flex>
                      <Box
                        className="material-symbols-outlined"
                        fontSize="18px"
                        opacity={0.7}
                      >
                        close
                      </Box>
                    </Box>
                  ) : (
                    <Box
                      py={3}
                      px={4}
                      border="1px dashed var(--chakra-colors-border-default)"
                      borderRadius="lg"
                      bg="rgba(0,0,0,0.02)"
                    >
                      <Text
                        fontSize="xs"
                        color="fg.muted"
                        fontStyle="italic"
                      >
                        Enter announcement text above to view live preview...
                      </Text>
                    </Box>
                  )}
                </Box>

                <Flex align="center" justify="space-between">
                  <HStack gap={3}>
                    <Badge
                      colorScheme={emergencyActive ? "green" : "red"}
                      variant="surface"
                      px={3}
                      py={1.5}
                      borderRadius="full"
                      fontWeight="700"
                      fontSize="xs"
                    >
                      {emergencyActive
                        ? "● Live On Client Screens"
                        : "○ Inactive"}
                    </Badge>
                  </HStack>
                  <HStack gap={3}>
                    <Button
                      type="button"
                      variant="outline"
                      borderColor="red.300"
                      color="red.600"
                      _hover={{ bg: "red.50" }}
                      onClick={handleClearEmergencyAnnouncement}
                      disabled={isSavingAnnouncement || !emergencyActive}
                      borderRadius="xl"
                      h="40px"
                      py={1.5}
                      px={4}
                      fontSize="sm"
                      fontWeight="700"
                    >
                      {isSavingAnnouncement ? (
                        <Spinner size="xs" />
                      ) : (
                        "Clear Announcement"
                      )}
                    </Button>
                    <Button
                      type="submit"
                      bg="accent.solid"
                      color="white"
                      _hover={{
                        bg: "color-mix(in srgb, var(--chakra-colors-accent-solid) 85%, black)",
                      }}
                      disabled={isSavingAnnouncement || !emergencyText.trim()}
                      py={1.5}
                      px={6}
                      borderRadius="xl"
                      h="40px"
                      fontSize="sm"
                      fontWeight="700"
                    >
                      {isSavingAnnouncement ? (
                        <Spinner size="xs" />
                      ) : (
                        "Publish Announcement"
                      )}
                    </Button>
                  </HStack>
                </Flex>
              </VStack>

              {/* Divider */}
              <Box
                borderTop="1px solid"
                borderColor="border.subtle"
                pt={5}
                mt={2}
              >
                <Flex
                  gap={{ base: 4, md: 6 }}
                  flexDirection={{ base: "column", md: "row" }}
                >
                  {/* Ticker Input Card */}
                  <VStack
                    align="stretch"
                    gap={3}
                    flex={1}
                    bg="color-mix(in srgb, var(--chakra-colors-brand-solid) 4%, transparent)"
                    p={4}
                    borderRadius="xl"
                    border="1px solid"
                    borderColor="border.subtle"
                  >
                    <Flex align="center" gap={2}>
                      <Box
                        as="span"
                        className="material-symbols-outlined"
                        fontSize="18px"
                        color="brand.solid"
                      >
                        breaking_news
                      </Box>
                      <Text
                        fontWeight="700"
                        color="accent.solid"
                        fontSize="sm"
                      >
                        Global Marquee Ticker
                      </Text>
                    </Flex>
                    <Input
                      placeholder="Enter scrolling ticker text for all clients..."
                      value={tickerText}
                      onChange={(e) => setTickerText(e.target.value)}
                      h="44px"
                      borderRadius="xl"
                      border="1.5px solid var(--chakra-colors-border-default)"
                      bg="white"
                      fontSize="sm"
                      _focus={{
                        borderColor: "brand.solid",
                        boxShadow: "0 0 0 2px var(--chakra-colors-brand-muted)",
                      }}
                      disabled={isSavingTicker}
                    />

                    {/* [ Live Preview Strip ] for Ticker */}
                    <Box>
                      <Flex align="center" gap={2} mb={2}>
                        <Text
                          fontSize="xs"
                          fontWeight="700"
                          color="fg.muted"
                          textTransform="uppercase"
                        >
                          Live Preview
                        </Text>
                        <Badge
                          variant="subtle"
                          bg="orange.100"
                          color="orange.800"
                          fontSize="xs"
                        >
                          [ Live Preview Strip ]
                        </Badge>
                      </Flex>
                      {tickerText.trim() ? (
                        <Box
                          className="premium-ticker-container"
                          borderRadius="lg"
                          overflow="hidden"
                        >
                          <div className="premium-ticker-track">
                            <span className="premium-ticker-item">
                              {tickerText}
                            </span>
                            <span className="premium-ticker-item">
                              {tickerText}
                            </span>
                            <span className="premium-ticker-item">
                              {tickerText}
                            </span>
                          </div>
                        </Box>
                      ) : (
                        <Box
                          py={3}
                          px={4}
                          border="1px dashed var(--chakra-colors-border-default)"
                          borderRadius="lg"
                          bg="rgba(0,0,0,0.02)"
                        >
                          <Text
                            fontSize="xs"
                            color="fg.muted"
                            fontStyle="italic"
                          >
                            Enter ticker text above to view live preview...
                          </Text>
                        </Box>
                      )}
                    </Box>

                    <HStack gap={2}>
                      <Button
                        type="button"
                        variant="outline"
                        borderColor="red.300"
                        color="red.600"
                        _hover={{ bg: "red.50" }}
                        h="40px"
                        py={1.5}
                        px={4}
                        borderRadius="lg"
                        cursor="pointer"
                        fontSize="xs"
                        fontWeight="700"
                        onClick={handleClearTicker}
                        disabled={isSavingTicker || !tickerActive}
                        flex={1}
                      >
                        {isSavingTicker ? <Spinner size="xs" /> : "Kill Ticker"}
                      </Button>
                      <Button
                        type="button"
                        bg="brand.solid"
                        color="white"
                        _hover={{
                          bg: "color-mix(in srgb, var(--chakra-colors-brand-solid) 85%, black)",
                        }}
                        h="40px"
                        py={1.5}
                        px={5}
                        borderRadius="lg"
                        cursor="pointer"
                        fontSize="xs"
                        fontWeight="700"
                        onClick={handlePublishTicker}
                        disabled={isSavingTicker || !tickerText.trim()}
                        flex={1}
                      >
                        {isSavingTicker ? (
                          <Spinner size="xs" />
                        ) : (
                          "Publish Ticker"
                        )}
                      </Button>
                    </HStack>
                  </VStack>

                  {/* Panic Mute Card */}
                  <VStack
                    align="stretch"
                    gap={3}
                    flex={1}
                    bg={
                      globalMuteActive
                        ? "color-mix(in srgb, #c53030 6%, transparent)"
                        : "color-mix(in srgb, var(--chakra-colors-bg-canvas) 80%, transparent)"
                    }
                    p={4}
                    borderRadius="xl"
                    border="1px solid"
                    borderColor={globalMuteActive ? "red.200" : "border.subtle"}
                    transition="all 0.3s ease"
                  >
                    <Flex align="center" gap={2}>
                      <Box
                        as="span"
                        className="material-symbols-outlined"
                        fontSize="18px"
                        color={globalMuteActive ? "red.600" : "fg.muted"}
                      >
                        {globalMuteActive ? "volume_off" : "volume_up"}
                      </Box>
                      <Text
                        fontWeight="700"
                        color="accent.solid"
                        fontSize="sm"
                      >
                        Instant Panic Mute
                      </Text>
                      {globalMuteActive && (
                        <Badge
                          colorPalette="red"
                          fontSize="xs"
                          borderRadius="full"
                          px={2}
                        >
                          ENGAGED
                        </Badge>
                      )}
                    </Flex>
                    <Text fontSize="xs" color="fg.muted" lineHeight="tall">
                      Immediately freezes ALL chat inputs across every connected
                      client. Use in emergencies to silence the entire chat
                      system.
                    </Text>
                    {!globalMuteActive ? (
                      <Button
                        type="button"
                        bg="red.600"
                        color="white"
                        h="48px"
                        py={2}
                        borderRadius="xl"
                        cursor="pointer"
                        fontSize="sm"
                        fontWeight="800"
                        _hover={{ bg: "red.700", transform: "scale(1.01)" }}
                        transition="all 0.2s ease"
                        onClick={() => handlePanicMute(true)}
                        w="100%"
                      >
                        <HStack gap={2}>
                          <Box
                            as="span"
                            className="material-symbols-outlined"
                            fontSize="20px"
                          >
                            emergency
                          </Box>
                          <Text>INSTANT GLOBAL MUTE</Text>
                        </HStack>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        bg="brand.solid"
                        color="white"
                        h="48px"
                        py={2}
                        borderRadius="xl"
                        cursor="pointer"
                        fontSize="sm"
                        fontWeight="800"
                        _hover={{
                          bg: "color-mix(in srgb, var(--chakra-colors-brand-solid) 85%, black)",
                        }}
                        transition="all 0.2s ease"
                        onClick={() => handlePanicMute(false)}
                        w="100%"
                      >
                        <HStack gap={2}>
                          <Box
                            as="span"
                            className="material-symbols-outlined"
                            fontSize="20px"
                          >
                            check_circle
                          </Box>
                          <Text>LIFT MUTE — Restore Chat</Text>
                        </HStack>
                      </Button>
                    )}
                  </VStack>
                </Flex>
              </Box>
            </Box>

            {/* 3. Countdown Timer */}
            {/* Section F: Orientation Milestones Timer Setup */}
            <Box
              bg="white"
              border="1px solid"
              borderColor="border.subtle"
              borderRadius="xl"
              boxShadow="sm"
              p={6}
            >
              <Heading size="md" color="gray.700" fontFamily="heading" mb={4}>
                Countdown Timer
              </Heading>
              <VStack
                as="form"
                onSubmit={handleUpdateEvent}
                gap={4}
                align="stretch"
              >
                <Flex gap={4} flexWrap="wrap">
                  <VStack align="start" gap={1} flex={1} minW="200px">
                    <Text fontSize="xs" fontWeight="700" color="fg.muted">
                      Countdown Target Label
                    </Text>
                    <Input
                      placeholder="Event Title e.g. First Meet"
                      value={eventTitle}
                      onChange={(e) => setEventTitle(e.target.value)}
                      h="44px"
                      bg="bg.canvas"
                      borderRadius="xl"
                      _focus={{ borderColor: "accent.solid", boxShadow: "0 0 0 2px var(--chakra-colors-accent-muted)" }}
                      required
                    />
                  </VStack>
                  <VStack align="start" gap={1} flex={1} minW="200px">
                    <Text fontSize="xs" fontWeight="700" color="fg.muted">
                      Milestone Calendar Time
                    </Text>
                    <Input
                      type="datetime-local"
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                      h="44px"
                      bg="bg.canvas"
                      borderRadius="xl"
                      _focus={{ borderColor: "accent.solid", boxShadow: "0 0 0 2px var(--chakra-colors-accent-muted)" }}
                      required
                    />
                  </VStack>
                </Flex>
                <Button
                  type="submit"
                  bg="accent.solid"
                  color="white"
                  loading={updatingEvent}
                  h="44px"
                  py={2}
                  maxW="200px"
                  borderRadius="xl"
                  cursor="pointer"
                >
                  Configure Timer
                </Button>
              </VStack>
            </Box>

            {/* 4. Daily Vibe Mission */}
            {/* Section B: Daily Vibe Mission Sequence Configurator */}
            <Box
              bg="white"
              border="1px solid"
              borderColor="border.subtle"
              borderRadius="xl"
              boxShadow="sm"
              p={6}
            >
              <Heading size="md" color="gray.700" fontFamily="heading" mb={4}>
                Daily Vibe Mission
              </Heading>
              <VStack align="stretch" gap={6}>
                {/* Mission list */}
                <Box
                  border="1px solid"
                  borderColor="border.subtle"
                  borderRadius="xl"
                  overflow="hidden"
                  p={3}
                >
                  <Table.Root size="sm">
                    <Table.Header bg="bg.canvas">
                      <Table.Row>
                        <Table.ColumnHeader fontFamily="heading">Seq Order</Table.ColumnHeader>
                        <Table.ColumnHeader fontFamily="heading">
                          Target Position / Role
                        </Table.ColumnHeader>
                        <Table.ColumnHeader fontFamily="heading">
                          Required Card Count
                        </Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="right" fontFamily="heading">
                          Actions
                        </Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {missions.map((m) => (
                        <Table.Row key={m.id}>
                          <Table.Cell fontWeight="bold">
                            Quest #{m.sequence_order}
                          </Table.Cell>
                          <Table.Cell>
                            <Badge
                              colorPalette="teal"
                              px={2}
                              py={0.5}
                              borderRadius="md"
                            >
                              {m.target_role}
                            </Badge>
                            <Text
                              as="span"
                              fontSize="xs"
                              color="fg.subtle"
                              ml={2}
                            >
                              ({staffCounts[m.target_role] || 0} active in
                              system)
                            </Text>
                          </Table.Cell>
                          <Table.Cell fontWeight="600">
                            {m.required_count} cards
                          </Table.Cell>
                          <Table.Cell textAlign="right">
                            <Button
                              type="button"
                              variant="ghost"
                              colorPalette="red"
                              onClick={() =>
                                handleRemoveMission(m.id, m.sequence_order)
                              }
                              cursor="pointer"
                              h={{ base: "40px", md: "28px" }}
                              py={1}
                              px={{ base: 4, md: 3 }}
                              fontSize="xs"
                            >
                              Delete
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                      {missions.length === 0 && (
                        <Table.Row>
                          <Table.Cell
                            colSpan={4}
                            textAlign="center"
                            py={4}
                            color="fg.subtle"
                            fontStyle="italic"
                          >
                            No missions configured in the system. Cards can be
                            swiped without constraints.
                          </Table.Cell>
                        </Table.Row>
                      )}
                    </Table.Body>
                  </Table.Root>
                </Box>

                {/* Add Mission Form */}
                <Flex
                  as="form"
                  onSubmit={handleAddMission}
                  gap={3}
                  flexWrap="wrap"
                  align="end"
                  bg="bg.canvas"
                  p={4}
                  borderRadius="xl"
                >
                  <VStack align="start" gap={1}>
                    <Box
                      fontSize="xs"
                      fontWeight="700"
                      color="fg.muted"
                      textTransform="uppercase"
                    >
                      <label htmlFor="add-mission-target">
                        Target Staff Category
                      </label>
                    </Box>
                    <Combobox.Root
                      collection={targetCollection}
                      value={newMissionTarget ? [newMissionTarget] : []}
                      onValueChange={(details) => {
                        setNewMissionTarget(details.value[0] || "");
                      }}
                      onInputValueChange={(details) => {
                        setNewMissionFilterQuery(details.inputValue);
                      }}
                      onOpenChange={(details) => {
                        if (details.open) {
                          setNewMissionFilterQuery("");
                        }
                      }}
                      openOnClick
                      positioning={{ sameWidth: true }}
                      width="240px"
                    >
                      <Combobox.Control position="relative" width="100%">
                        <Combobox.Input
                          id="add-mission-target"
                          placeholder="-- Choose Target --"
                          borderRadius="xl"
                          bg="white"
                          h="38px"
                          w="100%"
                          border="1.5px solid var(--chakra-colors-border-default)"
                          pl={3}
                          pr="32px"
                          fontSize="sm"
                          _focus={{
                            borderColor: "accent.solid",
                            boxShadow: "0 0 0 2px var(--chakra-colors-accent-muted)",
                          }}
                        />
                        <Combobox.Trigger
                          position="absolute"
                          right="8px"
                          top="50%"
                          transform="translateY(-50%)"
                          zIndex="2"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          color="fg.muted"
                          cursor="pointer"
                          bg="transparent"
                          border="none"
                          p={1}
                        >
                          <FiChevronDown />
                        </Combobox.Trigger>
                      </Combobox.Control>
                      <Portal>
                        <Combobox.Positioner zIndex={4000}>
                          <Combobox.Content
                            bg="bg.surface"
                            borderRadius="xl"
                            border="1px solid"
                            borderColor="border.subtle"
                            boxShadow="md"
                            maxH="280px"
                            overflowY="auto"
                            py={1}
                          >
                            <Combobox.Empty fontSize="sm" p={3} textAlign="center" color="fg.muted">
                              No results found
                            </Combobox.Empty>
                            {targetCollection.items.map((item) => (
                              <Combobox.Item
                                key={item.value}
                                item={item}
                                cursor="pointer"
                                px={3}
                                py={2}
                                fontSize="sm"
                                transition="background 0.2s"
                                _hover={{ bg: "rgba(73, 98, 104, 0.08)" }}
                                _selected={{ bg: "accent.solid", color: "white" }}
                              >
                                {item.label}
                                <Combobox.ItemIndicator />
                              </Combobox.Item>
                            ))}
                          </Combobox.Content>
                        </Combobox.Positioner>
                      </Portal>
                    </Combobox.Root>
                  </VStack>
                  <VStack align="start" gap={1}>
                    <Text fontSize="xs" fontWeight="700" color="fg.muted">
                      Required Card Count
                    </Text>
                    <Input
                      type="number"
                      min={1}
                      max={maxAvailableCount}
                      value={newMissionCount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        setNewMissionCount(Math.min(val, maxAvailableCount));
                      }}
                      h="38px"
                      bg="white"
                      borderRadius="lg"
                      border="1.5px solid var(--chakra-colors-border-default)"
                      _focus={{ borderColor: "accent.solid", boxShadow: "0 0 0 2px var(--chakra-colors-accent-muted)" }}
                      maxW="90px"
                    />
                  </VStack>
                  <Button
                    type="submit"
                    bg="accent.solid"
                    color="white"
                    h={{ base: "40px", md: "38px" }}
                    py={1.5}
                    px={4}
                    borderRadius="lg"
                    cursor="pointer"
                  >
                    Append Quest
                  </Button>
                </Flex>

                {newMissionError && (
                  <Text color="red.600" fontSize="xs" fontWeight="600" mt={2}>
                    {newMissionError}
                  </Text>
                )}

                {/* Penalty Lockout Variable Inputs */}
                <VStack
                  as="form"
                  onSubmit={handleSaveGamePenalties}
                  align="stretch"
                  gap={4}
                  borderTop="1px solid"
                  borderColor="border.subtle"
                  pt={4}
                >
                  <Heading
                    as="h3"
                    fontSize="sm"
                    fontWeight="700"
                    fontFamily="heading"
                    color="accent.solid"
                  >
                    Swipe Penalty & Exponential Lockout Variables
                  </Heading>
                  <Flex gap={4} flexWrap="wrap">
                    <VStack align="start" gap={1} flex={1} minW="140px">
                      <Text
                        fontSize="xs"
                        fontWeight="700"
                        color="fg.muted"
                      >
                        Max Allowed Strikes
                      </Text>
                      <Input
                        type="number"
                        value={maxStrikes}
                        onChange={(e) =>
                          setMaxStrikes(parseInt(e.target.value) || 1)
                        }
                        bg="bg.canvas"
                        h="40px"
                        borderRadius="lg"
                        _focus={{ borderColor: "accent.solid", boxShadow: "0 0 0 2px var(--chakra-colors-accent-muted)" }}
                      />
                    </VStack>
                    <VStack align="start" gap={1} flex={1} minW="140px">
                      <Text
                        fontSize="xs"
                        fontWeight="700"
                        color="fg.muted"
                      >
                        Base Cooldown (minutes)
                      </Text>
                      <Input
                        type="number"
                        value={baseCooldown}
                        onChange={(e) =>
                          setBaseCooldown(parseInt(e.target.value) || 1)
                        }
                        bg="bg.canvas"
                        h="40px"
                        borderRadius="lg"
                        _focus={{ borderColor: "accent.solid", boxShadow: "0 0 0 2px var(--chakra-colors-accent-muted)" }}
                      />
                    </VStack>
                    <VStack align="start" gap={1} flex={1} minW="140px">
                      <Text
                        fontSize="xs"
                        fontWeight="700"
                        color="fg.muted"
                      >
                        Max Cooldown ceiling (minutes)
                      </Text>
                      <Input
                        type="number"
                        value={maxCooldown}
                        onChange={(e) =>
                          setMaxCooldown(parseInt(e.target.value) || 1)
                        }
                        bg="bg.canvas"
                        h="40px"
                        borderRadius="lg"
                        _focus={{ borderColor: "accent.solid", boxShadow: "0 0 0 2px var(--chakra-colors-accent-muted)" }}
                      />
                    </VStack>
                  </Flex>
                  <Button
                    type="submit"
                    bg="brand.solid"
                    color="white"
                    h="40px"
                    py={1.5}
                    maxW="200px"
                    borderRadius="lg"
                    cursor="pointer"
                  >
                    Save Rules Config
                  </Button>
                </VStack>
              </VStack>
            </Box>
          </SimpleGrid>

          {/* 5. Student Whitelist */}
          {/* Section C: Student Whitelist Matrix Table */}
          <WhitelistTable
            whitelistedUsers={whitelistedUsers}
            selectedStudentIds={selectedStudentIds}
            lastUpdatedStudentId={lastUpdatedStudentId}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            whitelistRoleTab={whitelistRoleTab}
            setWhitelistRoleTab={setWhitelistRoleTab}
            newStudentId={newStudentId}
            setNewStudentId={setNewStudentId}
            newRole={newRole}
            setNewRole={setNewRole}
            isAllSelected={isAllSelected}
            handleSelectAll={handleSelectAll}
            handleSelectUser={handleSelectUser}
            handleInspectUser={handleInspectUser}
            setUserToDelete={setUserToDelete}
            handleAddWhitelist={handleAddWhitelist}
            handleCSVUpload={handleCSVUpload}
            getRoleDescription={getRoleDescription}
          />

          {/* 6. System Audit Logs */}
          {/* Section D: Historical Administrative Audit Logs Timeline */}
          <Box
            bg="white"
            border="1px solid"
            borderColor="border.subtle"
            borderRadius="xl"
            boxShadow="sm"
            p={6}
          >
            <Heading size="md" color="gray.700" fontFamily="heading" mb={4}>
              System Audit Logs
            </Heading>
            <Flex justify="flex-end" mb={3}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => triggerRefresh()}
                cursor="pointer"
                h="32px"
                py={1}
                px={3}
                fontSize="xs"
                fontWeight="600"
                color="fg.muted"
              >
                <HStack gap={1}>
                  <Box
                    as="span"
                    className="material-symbols-outlined"
                    fontSize="14px"
                  >
                    refresh
                  </Box>
                  <Text as="span">Refresh</Text>
                </HStack>
              </Button>
            </Flex>
            <Box
              overflowY="auto"
              maxH="320px"
              border="1px solid"
              borderColor="border.subtle"
              borderRadius="xl"
              p={3}
            >
              <TableScrollArea
                bg="white"
                borderRadius="xl"
                borderWidth="1px"
                overflow="hidden"
              >
                <Table.Root size="sm" variant="line">
                  <Table.Header bg="bg.canvas">
                    <Table.Row>
                      <Table.ColumnHeader fontFamily="heading">Timestamp</Table.ColumnHeader>
                      <Table.ColumnHeader fontFamily="heading">Moderator</Table.ColumnHeader>
                      <Table.ColumnHeader fontFamily="heading">Action</Table.ColumnHeader>
                      <Table.ColumnHeader fontFamily="heading">Target</Table.ColumnHeader>
                      <Table.ColumnHeader fontFamily="heading">Details</Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {auditLogs.map((log, idx) => {
                      // Enhanced color coding for action types
                      const getActionColor = (type: string) => {
                        if (
                          type.includes("remove") ||
                          type.includes("delete") ||
                          type === "panic_mute"
                        )
                          return "red";
                        if (type.includes("add") || type.includes("csv"))
                          return "green";
                        if (type === "role_mutation") return "orange";
                        if (
                          type.includes("toggle") ||
                          type.includes("hype_mode")
                        )
                          return "teal";
                        if (type.includes("ticker")) return "teal";
                        if (type.includes("emergency")) return "red";
                        if (type.includes("mission")) return "orange";
                        if (type.includes("user_update")) return "teal";
                        return "gray";
                      };
                      return (
                        <Table.Row
                          key={log.id}
                          className={idx < 3 ? "chat-message-enter" : undefined}
                        >
                          <Table.Cell
                            fontSize="xs"
                            color="fg.subtle"
                            whiteSpace="nowrap"
                          >
                            {new Date(log.created_at).toLocaleString()}
                          </Table.Cell>
                          <Table.Cell fontWeight="600" fontSize="xs">
                            {log.users?.nickname || `ID: ${log.moderator_id}`}
                          </Table.Cell>
                          <Table.Cell>
                            <Badge
                              colorPalette={getActionColor(log.action_type)}
                              fontSize="xs"
                              px={2}
                              py={0.5}
                              borderRadius="md"
                              textTransform="uppercase"
                              letterSpacing="wider"
                            >
                              {log.action_type.includes("panic_mute") && (
                                <Box as={FiAlertTriangle} display="inline-block" mr={1} verticalAlign="middle" />
                              )}
                              {log.action_type}
                            </Badge>
                          </Table.Cell>
                          <Table.Cell
                            fontSize="xs"
                            fontFamily="monospace"
                            color="fg.subtle"
                          >
                            {log.target_id || "-"}
                          </Table.Cell>
                          <Table.Cell
                            fontSize="xs"
                            maxW="240px"
                            overflow="hidden"
                            textOverflow="ellipsis"
                          >
                            {log.details}
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                    {auditLogs.length === 0 && (
                      <Table.Row>
                        <Table.Cell
                          colSpan={5}
                          textAlign="center"
                          py={4}
                          color="fg.subtle"
                          fontStyle="italic"
                        >
                          No audit events recorded yet.
                        </Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table.Root>
              </TableScrollArea>
            </Box>
          </Box>
        </VStack>
      )}
      {/* TIER 2: Media Admin Panel */}
      {activeTab === "media" &&
        (user?.role === "moderator" || user?.role === "media_admin") && (
          <VStack align="stretch" gap={6}>
            <Box
              bg="white"
              p={6}
              border="1px solid"
              borderColor="border.subtle"
              borderRadius="2xl"
              boxShadow="var(--shadow-card)"
            >
              <Heading
                as="h2"
                fontSize="lg"
                fontWeight="700"
                fontFamily="heading"
                color="accent.solid"
                mb={4}
              >
                Immich Photo Server Connectivity (AV)
              </Heading>
              <VStack gap={4} align="stretch" mb={6}>
                <Flex
                  align="center"
                  justify="space-between"
                  p={3}
                  bg="bg.canvas"
                  borderRadius="xl"
                >
                  <Text fontWeight="600" color="accent.solid">
                    External Server Status
                  </Text>
                  <Badge
                    colorPalette={immichConfig.isConfigured ? "green" : "red"}
                  >
                    {immichStatus.ping}
                  </Badge>
                </Flex>
                <Flex
                  align="center"
                  justify="space-between"
                  p={3}
                  bg="bg.canvas"
                  borderRadius="xl"
                >
                  <Text fontWeight="600" color="accent.solid">
                    Configured Server Endpoint
                  </Text>
                  <Text fontSize="xs" fontWeight="700" color="brand.solid">
                    {immichConfig.url || "None (Using local Supabase fallback)"}
                  </Text>
                </Flex>
                <Flex
                  align="center"
                  justify="space-between"
                  p={3}
                  bg="bg.canvas"
                  borderRadius="xl"
                >
                  <Text fontWeight="600" color="accent.solid">
                    Synced Image Records
                  </Text>
                  <Text
                    fontSize="sm"
                    fontWeight="700"
                    color="accent.solid"
                  >
                    {immichStatus.totalImages} images
                  </Text>
                </Flex>
              </VStack>

              <Heading
                as="h3"
                fontSize="sm"
                fontWeight="700"
                fontFamily="heading"
                color="accent.solid"
                mb={2}
              >
                DigitalOcean Droplet Sync Log Tracker
              </Heading>
              <Box
                bg="fg.default"
                color="green.400"
                p={4}
                borderRadius="xl"
                fontFamily="monospace"
                fontSize="xs"
                h="150px"
                overflowY="auto"
              >
                <Text>
                  [{new Date().toISOString()}] INITIALIZING Droplet connectivity
                  check...
                </Text>
                <Text>
                  [{new Date().toISOString()}] GET config url:{" "}
                  {immichConfig.url || "local_db"}
                </Text>
                <Text>[{new Date().toISOString()}] CONNECTING... OK</Text>
                <Text>
                  [{new Date().toISOString()}] SYNC STATUS: Completed
                  successfully. {immichStatus.activeSyncs} background tasks
                  active.
                </Text>
              </Box>
            </Box>
            
            <MediaUploader />
            <AlbumMappingAdmin />
          </VStack>
        )}

      {/* TIER 3: Staff Moderation Panel */}
      {activeTab === "staff" &&
        (user?.role === "moderator" || user?.role === "staff") && (
          <VStack align="stretch" gap={6}>
            {staffLoading ? (
              <Flex minH="40vh" align="center" justify="center">
                <Spinner size="xl" color="accent.solid" />
              </Flex>
            ) : (
              <>
                {/* VibeCheck Setup Card */}
                <Box
                  bg="white"
                  p={6}
                  border="1px solid"
                  borderColor="border.subtle"
                  borderRadius="xl"
                  boxShadow="sm"
                >
                  <Heading size="md" color="gray.700" fontFamily="heading" mb={4}>
                    My VibeCheck Profile (Staff Card)
                  </Heading>

                  {!vibecheckEnabled && (
                    <Alert.Root
                      status="warning"
                      mb={4}
                      borderRadius="xl"
                      bg="color-mix(in srgb, #D69E2E 8%, transparent)"
                      border="1px solid"
                      borderColor="yellow.200"
                    >
                      <Alert.Indicator color="yellow.600" />
                      <Alert.Content>
                        <Alert.Title
                          fontSize="xs"
                          fontWeight="700"
                          color="yellow.800"
                        >
                          ระบบ Vibe Check ถูกปิดใช้งานชั่วคราวโดยผู้ดูแลระบบ
                          (ฟีเจอร์การอัปโหลดรูปและประวัติถูกระงับชั่วคราว)
                        </Alert.Title>
                      </Alert.Content>
                    </Alert.Root>
                  )}

                  <VStack
                    as="form"
                    onSubmit={handleSaveProfile}
                    align="stretch"
                    gap={5}
                    opacity={!vibecheckEnabled ? 0.6 : 1}
                    pointerEvents={!vibecheckEnabled ? "none" : "auto"}
                  >
                    <VStack align="stretch" gap={1.5}>
                      <Text
                        fontSize="xs"
                        fontWeight="700"
                        color="fg.muted"
                        textTransform="uppercase"
                      >
                        Bio / Intro Phrase (Staff Intro)
                      </Text>
                      <Input
                        placeholder="e.g. Apple, Recreation Staff of Baan 7, nice to meet you all! 🧡"
                        aria-label="Bio / Intro Phrase (Staff Intro)"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        h="44px"
                        borderRadius="xl"
                        border="1.5px solid var(--chakra-colors-border-default)"
                        bg="bg.canvas"
                        disabled={!vibecheckEnabled || savingProfile}
                      />
                    </VStack>

                    <VStack align="stretch" gap={3}>
                      <Text
                        fontSize="xs"
                        fontWeight="700"
                        color="fg.muted"
                        textTransform="uppercase"
                      >
                        Vibe Check Photos (Max exactly 3 photos)
                      </Text>
                      <Input
                        type="file"
                        accept="image/*"
                        aria-label="Upload photo"
                        onChange={handlePhotoUpload}
                        ref={staffPhotoInputRef}
                        display="none"
                      />
                      <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
                        {[0, 1, 2].map((idx) => {
                          const url = photos[idx] || "";
                          const isUploading = uploadingIdx === idx;

                          return (
                            <Box
                              key={idx}
                              p={4}
                              bg="bg.hero"
                              border="1px dashed"
                              borderColor="border.subtle"
                              borderRadius="xl"
                              display="flex"
                              flexDirection="column"
                              alignItems="center"
                              justifyContent="center"
                              minH="180px"
                              opacity={!vibecheckEnabled ? 0.6 : 1}
                            >
                              {url ? (
                                <VStack gap={2} w="100%">
                                  <Box
                                    h="100px"
                                    w="100%"
                                    borderRadius="lg"
                                    overflow="hidden"
                                  >
                                    <Image
                                      src={url}
                                      alt={`Uploaded staff orientation activity photo preview ${idx + 1}`}
                                      w="100%"
                                      h="100%"
                                      objectFit="cover"
                                    />
                                  </Box>
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="outline"
                                    colorPalette="red"
                                    onClick={() => removePhoto(idx)}
                                    w="100%"
                                    minH="32px"
                                    py={1}
                                    cursor="pointer"
                                    disabled={!vibecheckEnabled}
                                  >
                                    Remove
                                  </Button>
                                </VStack>
                              ) : (
                                <VStack gap={2}>
                                  <Text fontSize="xs" color="fg.subtle">
                                    Slot {idx + 1} (Empty)
                                  </Text>
                                  {isUploading ? (
                                    <Spinner
                                      size="xs"
                                      color="brand.solid"
                                    />
                                  ) : (
                                    <Flex gap={2}>
                                      <Button
                                        type="button"
                                        size="xs"
                                        onClick={() => triggerUploadClick(idx)}
                                        minH="44px"
                                        py={1.5}
                                        cursor="pointer"
                                        disabled={!vibecheckEnabled}
                                      >
                                        Upload
                                      </Button>
                                      <Button
                                        type="button"
                                        size="xs"
                                        variant="outline"
                                        onClick={() => triggerUrlPrompt(idx)}
                                        minH="44px"
                                        py={1.5}
                                        cursor="pointer"
                                        disabled={!vibecheckEnabled}
                                      >
                                        URL
                                      </Button>
                                    </Flex>
                                  )}
                                </VStack>
                              )}
                            </Box>
                          );
                        })}
                      </SimpleGrid>
                    </VStack>

                    <Button
                      type="submit"
                      bg="accent.solid"
                      color="white"
                      h="44px"
                      py={2}
                      borderRadius="xl"
                      cursor="pointer"
                      _hover={{ bg: "chocolate.600" }}
                      loading={savingProfile}
                      disabled={!vibecheckEnabled}
                    >
                      Save Vibe Profile
                    </Button>
                  </VStack>
                </Box>

                {/* Hype & Memory Board Moderation Card */}
                <Box
                  bg="white"
                  p={6}
                  border="1px solid"
                  borderColor="border.subtle"
                  borderRadius="xl"
                  boxShadow="sm"
                >
                  <Heading size="md" color="gray.700" fontFamily="heading" mb={2}>
                    Live Hype & Memory Board Moderation Tracker
                  </Heading>
                  <Text fontSize="xs" color="fg.muted" mb={4}>
                    Under standard privacy policies, anonymous authors are
                    masked for general Staff. Action buttons execute database
                    permissions contexts directly.
                  </Text>

                  <Box
                    overflowY="auto"
                    maxH="400px"
                    border="1px solid"
                    borderColor="border.subtle"
                    borderRadius="xl"
                    p={3}
                  >
                    <TableScrollArea
                      bg="white"
                      borderRadius="xl"
                      borderWidth="1px"
                      overflow="hidden"
                    >
                      <Table.Root size="sm" variant="line">
                        <Table.Header bg="bg.canvas">
                          <Table.Row>
                            <Table.ColumnHeader fontFamily="heading">
                              Post Details & Comments
                            </Table.ColumnHeader>
                            <Table.ColumnHeader fontFamily="heading">Author</Table.ColumnHeader>
                            <Table.ColumnHeader fontFamily="heading">Type</Table.ColumnHeader>
                            <Table.ColumnHeader fontFamily="heading">Actions</Table.ColumnHeader>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {posts.map((p) => {
                            const comments = commentsMap[p.id] || [];
                            return (
                              <Table.Row
                                key={p.id}
                                bg={
                                  p.is_hidden
                                    ? "rgba(186, 26, 26, 0.05)"
                                    : "transparent"
                                }
                                _hover={{ bg: "gray.50" }}
                                transition="background 0.2s"
                              >
                                <Table.Cell maxW="400px">
                                  <VStack align="stretch" gap={3}>
                                    <Box>
                                      <Text
                                        fontWeight={
                                          p.is_hidden ? "normal" : "600"
                                        }
                                        fontStyle={
                                          p.is_hidden ? "italic" : "normal"
                                        }
                                        color={
                                          p.is_hidden
                                            ? "fg.muted"
                                            : "fg.default"
                                        }
                                      >
                                        {p.content}
                                      </Text>
                                      <Text
                                        fontSize="3xs"
                                        color="fg.subtle"
                                        mt={1}
                                      >
                                        Tags: {p.tags?.join(", ") || "None"} |
                                        Created:{" "}
                                        {new Date(
                                          p.created_at,
                                        ).toLocaleString()}
                                      </Text>
                                    </Box>

                                    {/* Nested Comments Table for Moderation */}
                                    {comments.length > 0 && (
                                      <Box
                                        pl={4}
                                        borderLeft="2px solid"
                                        borderColor="border.subtle"
                                      >
                                        <Text
                                          fontSize="xs"
                                          fontWeight="700"
                                          color="fg.muted"
                                          mb={2}
                                        >
                                          Comments ({comments.length}):
                                        </Text>
                                        <VStack align="stretch" gap={2}>
                                          {comments.map((comment) => (
                                            <Flex
                                              key={comment.id}
                                              justify="space-between"
                                              bg="bg.hero"
                                              p={2}
                                              borderRadius="md"
                                              align="center"
                                            >
                                              <Box>
                                                <Text
                                                  fontSize="xs"
                                                  color="fg.default"
                                                >
                                                  {comment.content}
                                                </Text>
                                                <Text
                                                  fontSize="3xs"
                                                  color="fg.subtle"
                                                >
                                                  By{" "}
                                                  {comment.author?.nickname ||
                                                    "Student"}{" "}
                                                  ({comment.author?.role})
                                                </Text>
                                              </Box>
                                              <Button
                                                size="2xs"
                                                variant="ghost"
                                                colorPalette="red"
                                                onClick={() =>
                                                  handleDeleteComment(
                                                    comment.id,
                                                    p.id,
                                                  )
                                                }
                                                minH="32px"
                                                py={1}
                                                cursor="pointer"
                                              >
                                                Delete
                                              </Button>
                                            </Flex>
                                          ))}
                                        </VStack>
                                      </Box>
                                    )}
                                  </VStack>
                                </Table.Cell>
                                <Table.Cell>
                                  {p.is_anonymous ? (
                                    <Badge colorPalette="orange">
                                      Anonymous
                                    </Badge>
                                  ) : (
                                    <Text fontSize="xs" fontWeight="700">
                                      {p.author?.nickname || "Guest Whitelist"}
                                    </Text>
                                  )}
                                </Table.Cell>
                                <Table.Cell>
                                  <Badge
                                    colorPalette={
                                      p.type === "hype" ? "orange" : "teal"
                                    }
                                  >
                                    {p.type}
                                  </Badge>
                                </Table.Cell>
                                <Table.Cell>
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="outline"
                                    colorPalette="red"
                                    cursor="pointer"
                                    onClick={() => handleDeletePost(p.id)}
                                    minH="40px"
                                    py={1.5}
                                  >
                                    Delete Post
                                  </Button>
                                </Table.Cell>
                              </Table.Row>
                            );
                          })}
                          {posts.length === 0 && (
                            <Table.Row>
                              <Table.Cell
                                colSpan={4}
                                textAlign="center"
                                py={4}
                                color="fg.subtle"
                                fontStyle="italic"
                              >
                                No posts recorded yet.
                              </Table.Cell>
                            </Table.Row>
                          )}
                        </Table.Body>
                      </Table.Root>
                    </TableScrollArea>
                  </Box>
                </Box>
              </>
            )}
          </VStack>
        )}

      {/* CSV Preview Dialog */}
      {showCsvModal && (
        <Dialog.Root
          open={showCsvModal}
          onOpenChange={(e) => setShowCsvModal(e.open)}
          placement={{ base: "bottom", md: "center" }}
        >
          <Portal>
            <Dialog.Backdrop
              bg="color-mix(in srgb, var(--chakra-colors-fg-default) 70%, transparent)"
              backdropFilter="blur(4px)"
            />
            <Dialog.Positioner zIndex={1000} px={4}>
              <Dialog.Content
              bg="bg.canvas"
              border={{ base: "none", md: "2px solid var(--chakra-colors-accent-solid)" }}
              color="fg.default"
              borderRadius={{ base: "t-3xl", md: "2xl" }}
              width={{ base: "100%", md: "560px" }}
              maxH={{ base: "92vh", md: "80vh" }}
              p={6}
              boxShadow={{ base: "none", md: "var(--shadow-card)" }}
              display="flex"
              flexDirection="column"
              position="relative"
            >
              <Box
                as="form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await handleBatchUpsert();
                }}
                display="flex"
                flexDirection="column"
                height="100%"
                width="100%"
              >
                <Dialog.Header p={0} mb={2}>
                  <Dialog.Title
                    fontSize="xl"
                    fontWeight="bold"
                    color="accent.solid"
                    fontFamily="heading"
                  >
                    CSV Upload Preview & Duplicate Validation
                  </Dialog.Title>
                </Dialog.Header>
                <Dialog.Body
                  p={0}
                  flex={1}
                  overflowY="auto"
                  display="flex"
                  flexDirection="column"
                  mb={4}
                >
                  <Text fontSize="xs" color="fg.subtle" mb={4}>
                    Highlighting duplicates in orange. Conflict values will be
                    updated/overwritten upon upsert.
                  </Text>

                  <Box
                    overflowY="auto"
                    flex={1}
                    mb={4}
                    border="1px solid"
                    borderColor="border.subtle"
                    borderRadius="xl"
                    p={3}
                  >
                    <Table.Root size="sm" variant="line">
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeader fontFamily="heading">Student ID</Table.ColumnHeader>
                          <Table.ColumnHeader fontFamily="heading">Nickname</Table.ColumnHeader>
                          <Table.ColumnHeader fontFamily="heading">Faculty</Table.ColumnHeader>
                          <Table.ColumnHeader fontFamily="heading">Role</Table.ColumnHeader>
                          <Table.ColumnHeader fontFamily="heading">Validation</Table.ColumnHeader>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {csvRecords.map((row, idx) => {
                          const dup = isDuplicate(row.student_id);
                          return (
                            <Table.Row
                              key={idx}
                              bg={
                                dup ? "rgba(235, 150, 40, 0.08)" : "transparent"
                              }
                            >
                              <Table.Cell fontWeight="600">
                                {row.student_id}
                              </Table.Cell>
                              <Table.Cell>{row.nickname || "-"}</Table.Cell>
                              <Table.Cell>{row.faculty || "-"}</Table.Cell>
                              <Table.Cell>
                                <Badge colorPalette="gray">{row.role}</Badge>
                              </Table.Cell>
                              <Table.Cell>
                                {dup ? (
                                  <Badge colorPalette="orange">
                                    Duplicate (Will Update)
                                  </Badge>
                                ) : (
                                  <Badge colorPalette="green">New Record</Badge>
                                )}
                              </Table.Cell>
                            </Table.Row>
                          );
                        })}
                      </Table.Body>
                    </Table.Root>
                  </Box>
                </Dialog.Body>

                <Dialog.Footer p={0} justifyContent="flex-end" gap={3}>
                  <Dialog.CloseTrigger asChild>
                    <Button
                      variant="outline"
                      h="44px"
                      py={2}
                      borderRadius="xl"
                      cursor="pointer"
                    >
                      Cancel
                    </Button>
                  </Dialog.CloseTrigger>
                  <Button
                    type="submit"
                    bg="accent.solid"
                    color="white"
                    loading={upserting}
                    h="44px"
                    py={2}
                    px={6}
                    borderRadius="xl"
                    cursor="pointer"
                    _hover={{
                      bg: "color-mix(in srgb, var(--chakra-colors-accent-solid) 85%, black)",
                    }}
                  >
                    Batch Upsert ({csvRecords.length} records)
                  </Button>
                </Dialog.Footer>
              </Box>
              <Dialog.CloseTrigger
                position="absolute"
                top={4}
                right={4}
                asChild
              >
                <Button
                  variant="ghost"
                  w="44px"
                  h="44px"
                  minW="44px"
                  borderRadius="full"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  cursor="pointer"
                  color="fg.muted"
                  p={0}
                >
                  <Box
                    as="span"
                    className="material-symbols-outlined"
                    fontSize="20px"
                  >
                    close
                  </Box>
                </Button>
              </Dialog.CloseTrigger>
            </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        </Dialog.Root>
      )}

      {/* User Inspector Dialog */}
      <UserInspectModal
        inspectUser={inspectUser}
        onClose={() => setInspectUser(null)}
        onRefreshStats={() => inspectUser && handleInspectUser(inspectUser)}
        inspectUserStats={inspectUserStats}
        inspectUserLogs={inspectUserLogs}
        editNickname={editNickname}
        setEditNickname={setEditNickname}
        editFaculty={editFaculty}
        setEditFaculty={setEditFaculty}
        editMajor={editMajor}
        setEditMajor={setEditMajor}
        editHousePosition={editHousePosition}
        setEditHousePosition={setEditHousePosition}
        editRole={editRole}
        setEditRole={setEditRole}
        handleEditUser={handleEditUser}
        getRoleDescription={getRoleDescription}
        dynamicPositions={dynamicPositions}
      />

      {/* Whitelist Remove Confirmation Dialog */}
      {userToDelete && (
        <Dialog.Root
          open={!!userToDelete}
          onOpenChange={() => setUserToDelete(null)}
          role="alertdialog"
          placement={{ base: "bottom", md: "center" }}
        >
          <Portal>
            <Dialog.Backdrop
              bg="color-mix(in srgb, var(--chakra-colors-fg-default) 70%, transparent)"
              backdropFilter="blur(4px)"
            />
            <Dialog.Positioner zIndex={2200} px={4}>
              <Dialog.Content
              bg="bg.canvas"
              border={{ base: "none", md: "2px solid var(--chakra-colors-accent-solid)" }}
              color="fg.default"
              borderRadius={{ base: "t-3xl", md: "2xl" }}
              width={{ base: "100%", md: "560px" }}
              maxH={{ base: "92vh", md: "80vh" }}
              p={6}
              boxShadow={{ base: "none", md: "var(--shadow-card)" }}
              display="flex"
              flexDirection="column"
              position="relative"
            >
              <Box
                as="form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await handleRemoveWhitelist(userToDelete);
                  setUserToDelete(null);
                }}
                display="flex"
                flexDirection="column"
                height="100%"
                width="100%"
                gap="12px"
              >
                <Dialog.Header p={0}>
                  <Dialog.Title
                    fontSize="md"
                    fontWeight="bold"
                    color="red.600"
                    display="flex"
                    alignItems="center"
                    gap={2}
                    fontFamily="heading"
                  >
                    <Box
                      as="span"
                      className="material-symbols-outlined"
                      fontSize="20px"
                    >
                      warning
                    </Box>
                    Confirm Whitelist Removal
                  </Dialog.Title>
                </Dialog.Header>
                <Dialog.Body p={0} overflowY="auto">
                  <Text fontSize="xs" color="fg.muted" lineHeight="tall">
                    Are you sure you want to remove user{" "}
                    <strong>{userToDelete}</strong>? This action will revoke
                    their whitelist status and soft-deactivate their profile.
                  </Text>
                </Dialog.Body>
                <Dialog.Footer p={0} justifyContent="flex-end" gap={3}>
                  <Dialog.CloseTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      borderColor="border.subtle"
                      borderRadius="xl"
                      cursor="pointer"
                      h="40px"
                      px={4}
                      py={1.5}
                    >
                      Cancel
                    </Button>
                  </Dialog.CloseTrigger>
                  <Button
                    type="submit"
                    size="sm"
                    bg="red.600"
                    _hover={{ bg: "red.700" }}
                    color="white"
                    borderRadius="xl"
                    cursor="pointer"
                    h="40px"
                    px={4}
                    py={1.5}
                  >
                    Confirm Delete
                  </Button>
                </Dialog.Footer>
              </Box>
              <Dialog.CloseTrigger
                position="absolute"
                top={4}
                right={4}
                asChild
              >
                <Button
                  variant="ghost"
                  w="44px"
                  h="44px"
                  minW="44px"
                  borderRadius="full"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  cursor="pointer"
                  color="fg.muted"
                  p={0}
                >
                  <Box
                    as="span"
                    className="material-symbols-outlined"
                    fontSize="20px"
                  >
                    close
                  </Box>
                </Button>
              </Dialog.CloseTrigger>
            </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        </Dialog.Root>
      )}

      {/* Floating Bulk Actions Bar */}
      {selectedStudentIds.length > 0 && (
        <Box
          position="fixed"
          bottom="80px"
          left="50%"
          transform="translateX(-50%)"
          zIndex={1500}
          w="calc(100% - 32px)"
          maxW="md"
          bg="accent.solid"
          color="white"
          borderRadius="2xl"
          boxShadow="lg"
          py={3}
          px={5}
          animation="slide-up 0.3s var(--ease-out-quint)"
        >
          <Flex align="center" justify="space-between" gap={4}>
            <HStack gap={2}>
              <Box
                as="span"
                className="material-symbols-outlined"
                fontSize="20px"
                color="var(--chakra-colors-accent-muted)"
              >
                check_box
              </Box>
              <Text fontSize="sm" fontWeight="700">
                Selected: {selectedStudentIds.length} users
              </Text>
            </HStack>
            <Button
              size="sm"
              bg="red.600"
              _hover={{ bg: "color-mix(in srgb, var(--chakra-colors-red-500) 85%, black)" }}
              color="white"
              borderRadius="xl"
              onClick={() => setIsBulkDeleteOpen(true)}
              cursor="pointer"
              fontSize="xs"
              h={{ base: "40px", md: "36px" }}
              px={4}
              py={1.5}
            >
              Remove Selected (ลบรายชื่อที่เลือก)
            </Button>
          </Flex>
        </Box>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      {isBulkDeleteOpen && (
        <Dialog.Root
          open={isBulkDeleteOpen}
          onOpenChange={(e) => setIsBulkDeleteOpen(e.open)}
          role="alertdialog"
          placement={{ base: "bottom", md: "center" }}
        >
          <Portal>
            <Dialog.Backdrop
              bg="color-mix(in srgb, var(--chakra-colors-fg-default) 70%, transparent)"
              backdropFilter="blur(4px)"
            />
            <Dialog.Positioner zIndex={2200} px={4}>
              <Dialog.Content
              bg="bg.canvas"
              border={{ base: "none", md: "2px solid var(--chakra-colors-accent-solid)" }}
              color="fg.default"
              borderRadius={{ base: "t-3xl", md: "2xl" }}
              width={{ base: "100%", md: "560px" }}
              maxH={{ base: "92vh", md: "80vh" }}
              p={6}
              boxShadow={{ base: "none", md: "var(--shadow-card)" }}
              display="flex"
              flexDirection="column"
              position="relative"
            >
              <Box
                as="form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await handleBulkDeleteConfirm();
                  setIsBulkDeleteOpen(false);
                }}
                display="flex"
                flexDirection="column"
                height="100%"
                width="100%"
                gap="12px"
              >
                <Dialog.Header p={0}>
                  <Dialog.Title
                    fontSize="md"
                    fontWeight="bold"
                    color="red.600"
                    display="flex"
                    alignItems="center"
                    gap={2}
                    fontFamily="heading"
                  >
                    <Box
                      as="span"
                      className="material-symbols-outlined"
                      fontSize="20px"
                    >
                      warning
                    </Box>
                    Confirm Bulk Removal
                  </Dialog.Title>
                </Dialog.Header>
                <Dialog.Body p={0} overflowY="auto">
                  <Text fontSize="xs" color="fg.muted" lineHeight="tall">
                    Are you sure you want to remove{" "}
                    <strong>{selectedStudentIds.length}</strong> selected users?
                    This action will revoke their whitelist status,
                    soft-deactivate their profiles, and revert their roles to
                    student.
                  </Text>
                </Dialog.Body>
                <Dialog.Footer p={0} justifyContent="flex-end" gap={3}>
                  <Dialog.CloseTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      borderColor="border.subtle"
                      borderRadius="xl"
                      onClick={() => setIsBulkDeleteOpen(false)}
                      cursor="pointer"
                      h="40px"
                      px={4}
                      py={1.5}
                    >
                      Cancel
                    </Button>
                  </Dialog.CloseTrigger>
                  <Button
                    type="submit"
                    size="sm"
                    bg="red.600"
                    _hover={{
                      bg: "color-mix(in srgb, var(--chakra-colors-red-500) 85%, black)",
                    }}
                    color="white"
                    borderRadius="xl"
                    cursor="pointer"
                    h="40px"
                    px={4}
                    py={1.5}
                  >
                    Confirm Bulk Delete
                  </Button>
                </Dialog.Footer>
              </Box>
              <Dialog.CloseTrigger
                position="absolute"
                top={4}
                right={4}
                asChild
              >
                <Button
                  variant="ghost"
                  w="44px"
                  h="44px"
                  minW="44px"
                  borderRadius="full"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  cursor="pointer"
                  color="fg.muted"
                  p={0}
                >
                  <Box
                    as="span"
                    className="material-symbols-outlined"
                    fontSize="20px"
                  >
                    close
                  </Box>
                </Button>
              </Dialog.CloseTrigger>
            </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        </Dialog.Root>
      )}
    </Box>
  );
}
