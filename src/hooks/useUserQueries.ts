import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { hashPin } from "../utils/crypto";
import type { User } from "../context/UserContext";

// Query keys
export const userQueryKeys = {
  session: (token: string) => ["user_session", token] as const,
  claimedFace: (studentId: string) => ["claimed_face", studentId] as const,
};

/**
 * Hook to retrieve user profile based on a session token.
 */
export function useActiveSession(token: string | null) {
  return useQuery<User | null>({
    queryKey: userQueryKeys.session(token || ""),
    queryFn: async () => {
      if (!token) return null;
      const { data, error } = await supabase
        .from("user_sessions")
        // Explicit join projection — pin_hash is intentionally excluded from
        // the users column list so it never enters the client query cache.
        .select(
          "student_id, expires_at, users (student_id, role, nickname, faculty, major, house_position, avatar_color, images, tags, bio, profile_pic_url, photo_pool, immich_asset_id, ig, has_accepted_tos, created_at)"
        )
        .eq("session_token", token)
        .maybeSingle();

      if (error) {
        console.error("Session fetch failed:", error);
        throw error;
      }

      if (!data || !data.users) {
        return null;
      }

      const expiresAt = new Date(data.expires_at);
      if (expiresAt < new Date()) {
        // Expired session — delete from DB
        await supabase
          .from("user_sessions")
          .delete()
          .eq("session_token", token);
        return null;
      }

      return data.users as unknown as User;
    },
    enabled: !!token,
    staleTime: 0,        // Always revalidate — never serve a stale session
    retry: false,        // Don't retry on 401/session-not-found; treat as expired
    gcTime: 0,           // Immediately evict from cache when session ends
  });
}

/**
 * Hook to fetch claimed face status for a student ID.
 */
export function useClaimedFaceStatus(studentId: string | undefined) {
  return useQuery<boolean>({
    queryKey: userQueryKeys.claimedFace(studentId || ""),
    queryFn: async () => {
      if (!studentId) return false;
      const { data, error } = await supabase
        .from("user_faces")
        .select("immich_person_id")
        .eq("student_id", studentId);

      if (error) {
        console.error("Claimed face fetch failed:", error);
        throw error;
      }

      return !!(data && data.length > 0);
    },
    enabled: !!studentId,
  });
}

/**
 * Mutation hook to claim an unclaimed profile securely.
 */
export function useClaimProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ studentId, pin }: { studentId: string; pin: string }) => {
      const hashedPin = await hashPin(pin, studentId);
      
      const { error } = await supabase.rpc("claim_profile_secure", {
        p_student_id: studentId,
        p_pin_hash: hashedPin
      });

      if (error) {
        throw error;
      }

      // Generate session in database
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: sessionData, error: sessionError } = await supabase
        .from("user_sessions")
        .insert({
          student_id: studentId,
          expires_at: expiresAt,
        })
        .select("session_token")
        .single();

      if (sessionError || !sessionData) {
        throw new Error("SESSION_CREATION_FAILED");
      }

      return sessionData.session_token;
    },
    onSuccess: (sessionToken) => {
      queryClient.invalidateQueries({ queryKey: userQueryKeys.session(sessionToken) });
      queryClient.invalidateQueries({ queryKey: ["available_profiles"] });
    },
  });
}

/**
 * Mutation hook to update the user's profile.
 */
export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      studentId,
      profile,
    }: {
      studentId: string;
      profile: {
        nickname: string;
        faculty: string;
        major?: string;
        ig?: string;
        avatarColor?: string;
        bio?: string;
        profilePicUrl?: string;
        photoPool?: string[];
        housePosition?: string;
        immichAssetId?: string | null;
      };
    }) => {
      const { error } = await supabase.rpc("update_user_profile_secure", {
        p_student_id: studentId,
        p_nickname: profile.nickname,
        p_faculty: profile.faculty,
        p_major: profile.major || null,
        p_ig: profile.ig || null,
        p_avatar_color: profile.avatarColor || null,
        p_bio: profile.bio || null,
        p_profile_pic_url: profile.profilePicUrl || null,
        p_photo_pool: profile.photoPool || null,
        p_house_position: profile.housePosition || null,
        p_immich_asset_id: profile.immichAssetId || null,
      });

      if (error) {
        console.error("Update profile DB error:", error);
        throw error;
      }

      // Return a partial object or boolean since RPC returns boolean
      return { student_id: studentId } as User;
    },
    onSuccess: () => {
      // Invalidate all active session queries to trigger UI refresh across app
      queryClient.invalidateQueries({ queryKey: ["user_session"] });
    },
  });
}
