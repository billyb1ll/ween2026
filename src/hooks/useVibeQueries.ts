import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

export interface VibeMission {
  id: number;
  sequence_order: number;
  target_role: string;
  required_count: number;
  created_at?: string;
}

export interface DBStaff {
  student_id: string;
  nickname: string | null;
  faculty: string | null;
  major: string | null;
  avatar_color: string;
  profile_pic_url: string | null;
  bio: string | null;
  ig: string | null;
  images: string[];
  tags: string[];
  role: string;
  house_position: string | null;
}

export interface VibeStatus {
  student_id: string;
  current_mission_id: number | null;
  strike_count: number;
  lock_count: number;
  locked_until: string | null;
  vibe_missions?: VibeMission | null;
}

export const vibeQueryKeys = {
  status: (studentId: string) => ["vibe_status", studentId] as const,
  config: () => ["vibecheck_enabled"] as const,
  collected: (studentId: string) => ["collected_cards", studentId] as const,
  allStaff: () => ["all_staff"] as const,
  deck: (studentId: string) => ["vibe_deck", studentId] as const,
  staffMetrics: (staffId: string) => ["staff_metrics", staffId] as const,
  staffDetectives: (staffId: string) => ["staff_detectives", staffId] as const,
};

/**
 * Fetch a student's Vibe Status (mission, strikes, lockout time).
 */
export function useVibeStatus(studentId: string | undefined) {
  return useQuery<VibeStatus | null>({
    queryKey: vibeQueryKeys.status(studentId || ""),
    queryFn: async () => {
      if (!studentId) return null;
      const { data, error } = await supabase
        .from("user_vibe_status")
        .select("*, vibe_missions(*)")
        .eq("student_id", studentId)
        .maybeSingle();

      if (error) {
        console.error("Fetch user vibe status error:", error);
        throw error;
      }

      if (!data) {
        // First-time user initialization: Query all missions and shuffle
        const { data: allMissions, error: missionError } = await supabase
          .from("vibe_missions")
          .select("id");

        if (missionError) {
          console.error("Fetch missions error during init:", missionError);
          return null;
        }

        if (allMissions && allMissions.length > 0) {
          const shuffledMissions = [...allMissions].sort(() => Math.random() - 0.5);
          const firstMissionId = shuffledMissions[0].id;
          const missionQueue = shuffledMissions.slice(1).map(m => m.id);

          const { data: insertedData, error: insertError } = await supabase
            .from("user_vibe_status")
            .insert({
              student_id: studentId,
              current_mission_id: firstMissionId,
              mission_queue: missionQueue,
              strike_count: 0,
              lock_count: 0,
              locked_until: null,
            })
            .select("*, vibe_missions(*)")
            .maybeSingle();

          if (insertError) {
            console.error("Auto-initialize user status error:", insertError);
            return null;
          }
          return insertedData as VibeStatus;
        }
      }

      return data as VibeStatus;
    },
    enabled: !!studentId,
  });
}

/**
 * Fetch whether the Vibe Check system is globally enabled.
 */
export function useVibecheckEnabled() {
  return useQuery<boolean>({
    queryKey: vibeQueryKeys.config(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_config")
        .select("*")
        .eq("key", "vibecheck_enabled")
        .maybeSingle();

      if (error) {
        console.error("Fetch vibecheck_enabled config error:", error);
        throw error;
      }
      return data ? Boolean(data.value) : true;
    },
  });
}

/**
 * Fetch the max allowed strikes config value for UI display.
 */
export function useMaxStrikesConfig() {
  return useQuery<number>({
    queryKey: ["max_allowed_strikes"] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_config")
        .select("int_value")
        .eq("key", "max_allowed_strikes")
        .maybeSingle();

      if (error) {
        console.error("Fetch max_allowed_strikes error:", error);
        return 5;
      }
      return data?.int_value ?? 5;
    },
  });
}
/**
 * Fetch all stickers (collected cards) obtained by the student.
 */
export function useCollectedCards(studentId: string | undefined) {
  return useQuery<Set<string>>({
    queryKey: vibeQueryKeys.collected(studentId || ""),
    queryFn: async () => {
      if (!studentId) return new Set();
      const { data, error } = await supabase
        .from("collected_cards")
        .select("staff_id")
        .eq("student_id", studentId);

      if (error) {
        console.error("Fetch collected cards error:", error);
        throw error;
      }
      return new Set((data ?? []).map((c) => c.staff_id));
    },
    enabled: !!studentId,
  });
}

/**
 * Fetch all whitelisted staff members.
 */
export function useWhitelistedStaff() {
  return useQuery<DBStaff[]>({
    queryKey: vibeQueryKeys.allStaff(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select(
          "student_id, nickname, faculty, major, avatar_color, profile_pic_url, bio, ig, images, tags, role, house_position"
        )
        .in("role", ["staff", "media_admin", "moderator"]);

      if (error) {
        console.error("Fetch staff error:", error);
        throw error;
      }

      return (data as DBStaff[]).sort((a, b) =>
        (a.nickname || "").localeCompare(b.nickname || "")
      );
    },
  });
}

/**
 * Fetch the active swiper deck cards (uncollected staff members only) dynamically filtered against server state.
 */
export function useVibeDeck(studentId: string | undefined, currentMissionTargetRole: string | undefined) {
  return useQuery<DBStaff[]>({
    queryKey: [...vibeQueryKeys.deck(studentId || ""), currentMissionTargetRole],
    queryFn: async () => {
      if (!studentId) return [];

      // 1. Fetch collected cards
      const { data: collectedData, error: collectedError } = await supabase
        .from("collected_cards")
        .select("staff_id")
        .eq("student_id", studentId);

      if (collectedError) {
        console.error("Fetch collected cards error:", collectedError);
        throw collectedError;
      }

      const collectedIds = new Set((collectedData ?? []).map((c) => c.staff_id));

      // 2. Fetch staff members
      const { data: staffData, error: staffError } = await supabase
        .from("users")
        .select(
          "student_id, nickname, faculty, major, avatar_color, profile_pic_url, bio, ig, images, tags, role, house_position"
        )
        .in("role", ["staff", "media_admin", "moderator"]);

      if (staffError) {
        console.error("Fetch staff error:", staffError);
        throw staffError;
      }

      const allStaff = staffData as DBStaff[];

      // Return only uncollected staff members.
      // Memory trap detection and penalty logic is handled server-side
      // inside swipe_card_secure_v2 via historical collected_cards lookup.
      return allStaff.filter((s) => !collectedIds.has(s.student_id));
    },
    enabled: !!studentId,
  });
}

/**
 * Perform swipe card collection / check via secure database RPC.
 */
export function useSwipeCardMutation(studentId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      staffId,
      direction,
      pinHash,
    }: {
      staffId: string;
      direction: "right" | "left";
      pinHash: string;
    }) => {
      if (!studentId) throw new Error("Unauthorized");
      // p_is_memory_trap has been removed: trap detection is now evaluated
      // entirely server-side within swipe_card_secure_v2.
      const { data, error } = await supabase.rpc("swipe_card_secure_v2", {
        p_student_id: studentId,
        p_staff_id: staffId,
        p_direction: direction,
        p_pin_hash: pinHash,
      });

      if (error) {
        console.error("Swipe card RPC error:", error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      if (studentId) {
        queryClient.invalidateQueries({ queryKey: vibeQueryKeys.status(studentId) });
        queryClient.invalidateQueries({ queryKey: vibeQueryKeys.collected(studentId) });
      }
    },
  });
}

/**
 * Fetch Spy Metrics for a specific staff member.
 */
export function useStaffMetrics(staffId: string | undefined) {
  return useQuery<{ correctMatches: number; incorrectGuesses: number; totalAttempts: number; accuracyRatio: number }>({
    queryKey: vibeQueryKeys.staffMetrics(staffId || ""),
    queryFn: async () => {
      if (!staffId) return { correctMatches: 0, incorrectGuesses: 0, totalAttempts: 0, accuracyRatio: 0 };

      // 1. Fetch correct matches
      const { count: correctCount, error: err1 } = await supabase
        .from("collected_cards")
        .select("*", { count: "exact", head: true })
        .eq("staff_id", staffId);

      if (err1) throw err1;

      // 2. Fetch incorrect guesses (warnings / strikes / lockouts) from audit_logs that contain staffId in details
      const { count: incorrectCount, error: err2 } = await supabase
        .from("audit_logs")
        .select("*", { count: "exact", head: true })
        .in("action_type", ["system_strike", "system_lockout"])
        .or(`details.ilike.%collect on staff ID: ${staffId}%,details.ilike.%skip on staff ID: ${staffId}%`);

      if (err2) throw err2;

      const correct = correctCount || 0;
      const incorrect = incorrectCount || 0;
      const total = correct + incorrect;
      const accuracy = total > 0 ? (correct / total) * 100 : 0;

      return {
        correctMatches: correct,
        incorrectGuesses: incorrect,
        totalAttempts: total,
        accuracyRatio: parseFloat(accuracy.toFixed(1)),
      };
    },
    enabled: !!staffId,
  });
}

/**
 * Fetch list of students who have successfully collected this staff member's sticker.
 */
export function useStaffDetectives(staffId: string | undefined) {
  return useQuery<Array<{
    student_id: string;
    nickname: string | null;
    faculty: string | null;
    profile_pic_url: string | null;
    avatar_color: string;
    collected_at: string;
  }>>({
    queryKey: vibeQueryKeys.staffDetectives(staffId || ""),
    queryFn: async () => {
      if (!staffId) return [];

      const { data, error } = await supabase
        .from("collected_cards")
        .select("collected_at, users_collected_cards_student_idTousers(student_id, nickname, faculty, profile_pic_url, avatar_color)")
        .eq("staff_id", staffId)
        .order("collected_at", { ascending: false });

      if (error) {
        console.error("Fetch detectives error:", error);
        throw error;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []).map((row: any) => {
        const student = row.users_collected_cards_student_idTousers;
        return {
          student_id: student?.student_id || "",
          nickname: student?.nickname || "Secret Agent",
          faculty: student?.faculty || "Baan 7",
          profile_pic_url: student?.profile_pic_url || null,
          avatar_color: student?.avatar_color || "#496268",
          collected_at: row.collected_at,
        };
      });
    },
    enabled: !!staffId,
  });
}

/**
 * Mutation to update staff profile clues (bio and tags).
 */
export function useUpdateCluesMutation(staffId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bio, tags }: { bio: string; tags: string[] }) => {
      if (!staffId) throw new Error("Unauthorized");

      const { data, error } = await supabase
        .from("users")
        .update({ bio, tags })
        .eq("student_id", staffId)
        .select()
        .single();

      if (error) {
        console.error("Update clues error:", error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      // Invalidate the staff details cache
      queryClient.invalidateQueries({ queryKey: vibeQueryKeys.allStaff() });
      if (staffId) {
        queryClient.invalidateQueries({ queryKey: vibeQueryKeys.staffMetrics(staffId) });
      }
    },
  });
}
