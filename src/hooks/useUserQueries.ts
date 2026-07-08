import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
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
        .select("student_id, expires_at, users (*)")
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
        // Expired session
        await supabase
          .from("user_sessions")
          .delete()
          .eq("session_token", token);
        return null;
      }

      return data.users as unknown as User;
    },
    enabled: !!token,
    staleTime: 60000, // Keep sessions fresh for 1 minute
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
      const updates: Partial<User> = {};

      if (profile.nickname !== undefined) updates.nickname = profile.nickname;
      if (profile.faculty !== undefined) updates.faculty = profile.faculty;
      if (profile.major !== undefined) updates.major = profile.major || null;
      if (profile.ig !== undefined) updates.ig = profile.ig || null;
      if (profile.bio !== undefined) updates.bio = profile.bio || null;
      if (profile.profilePicUrl !== undefined) updates.profile_pic_url = profile.profilePicUrl || null;
      if (profile.photoPool !== undefined) updates.photo_pool = profile.photoPool;
      if (profile.housePosition !== undefined) updates.house_position = profile.housePosition || null;
      if (profile.immichAssetId !== undefined) updates.immich_asset_id = profile.immichAssetId || null;
      if (profile.avatarColor !== undefined) updates.avatar_color = profile.avatarColor;

      const { data, error } = await supabase
        .from("users")
        .update(updates)
        .eq("student_id", studentId)
        .select()
        .single();

      if (error) {
        console.error("Update profile DB error:", error);
        throw error;
      }

      return data as User;
    },
    onSuccess: () => {
      // Invalidate all active session queries to trigger UI refresh across app
      queryClient.invalidateQueries({ queryKey: ["user_session"] });
    },
  });
}
