import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

export interface DBUser {
  student_id: string;
  nickname: string | null;
  faculty: string | null;
  role: "moderator" | "media_admin" | "staff" | "student";
  created_at: string;
  major: string | null;
  house_position: string | null;
  profile_pic_url: string | null;
  bio: string | null;
  ig: string | null;
  avatar_color: string;
}

export interface VibeMission {
  id: number;
  sequence_order: number;
  target_role: string;
  required_count: number;
  created_at?: string;
}

export interface AuditLog {
  id: number;
  moderator_id: string | null;
  action_type: string;
  target_id: string | null;
  details: string | null;
  created_at: string;
  users?: {
    nickname: string | null;
  } | null;
}

export interface SystemConfig {
  key: string;
  value: boolean;
  text_value: string | null;
  int_value: number | null;
}

export const adminQueryKeys = {
  users: () => ["admin_users"] as const,
  missions: () => ["admin_missions"] as const,
  auditLogs: () => ["admin_audit_logs"] as const,
  configs: () => ["admin_configs"] as const,
};

/**
 * Fetch all users whitelisted / registered in the system.
 */
export function useAdminUsers(enabled: boolean) {
  return useQuery<DBUser[]>({
    queryKey: adminQueryKeys.users(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select(
          "student_id, nickname, faculty, role, created_at, major, house_position, profile_pic_url, bio, ig, avatar_color"
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Fetch admin users error:", error);
        throw error;
      }
      return data as unknown as DBUser[];
    },
    enabled,
  });
}

/**
 * Fetch all vibe missions.
 */
export function useAdminMissions(enabled: boolean) {
  return useQuery<VibeMission[]>({
    queryKey: adminQueryKeys.missions(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vibe_missions")
        .select("*")
        .order("sequence_order", { ascending: true });

      if (error) {
        console.error("Fetch admin missions error:", error);
        throw error;
      }
      return data as VibeMission[];
    },
    enabled,
  });
}

/**
 * Fetch recent administrative audit logs.
 */
export function useAdminAuditLogs(enabled: boolean) {
  return useQuery<AuditLog[]>({
    queryKey: adminQueryKeys.auditLogs(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*, users(nickname)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Fetch admin audit logs error:", error);
        throw error;
      }
      return data as unknown as AuditLog[];
    },
    enabled,
  });
}

/**
 * Fetch all system configurations.
 */
export function useAdminConfigs(enabled: boolean) {
  return useQuery<SystemConfig[]>({
    queryKey: adminQueryKeys.configs(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_config")
        .select("*");

      if (error) {
        console.error("Fetch admin system configs error:", error);
        throw error;
      }
      return data as SystemConfig[];
    },
    enabled,
  });
}

/**
 * Mutation to log an administrative audit action.
 */
export function useLogAuditActionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      moderatorId,
      actionType,
      targetId,
      details,
    }: {
      moderatorId: string | null;
      actionType: string;
      targetId: string | null;
      details: string;
    }) => {
      const { error } = await supabase.from("audit_logs").insert({
        moderator_id: moderatorId,
        action_type: actionType,
        target_id: targetId,
        details,
      });

      if (error) {
        console.error("Insert audit log error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.auditLogs() });
    },
  });
}

/**
 * Mutation to update user details (role config, nickname, etc.).
 */
export function useUpdateUserAdminMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      studentId,
      nickname,
      faculty,
      major,
      role,
      housePosition,
    }: {
      studentId: string;
      nickname: string | null;
      faculty: string | null;
      major: string | null;
      role: string;
      housePosition: string | null;
    }) => {
      const { data, error } = await supabase
        .from("users")
        .update({
          nickname,
          faculty,
          major,
          role,
          house_position: housePosition,
        })
        .eq("student_id", studentId)
        .select()
        .single();

      if (error) {
        console.error("Update user admin error:", error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.users() });
    },
  });
}

/**
 * Mutation to update system configurations.
 */
export function useUpdateSystemConfigMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      key,
      value,
      textValue,
      intValue,
    }: {
      key: string;
      value?: boolean;
      textValue?: string | null;
      intValue?: number | null;
    }) => {
      const updates: Partial<SystemConfig> = {};
      if (value !== undefined) updates.value = value;
      if (textValue !== undefined) updates.text_value = textValue;
      if (intValue !== undefined) updates.int_value = intValue;

      const { data, error } = await supabase
        .from("system_config")
        .update(updates)
        .eq("key", key)
        .select()
        .single();

      if (error) {
        console.error("Update system config error:", error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.configs() });
    },
  });
}

/**
 * Mutation to reset a user's vibecheck progress.
 */
export function useResetVibecheckMutation(adminId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      targetId,
      pinHash,
    }: {
      targetId: string;
      pinHash: string;
    }) => {
      const { error } = await supabase.rpc("admin_reset_vibecheck", {
        p_admin_id:  adminId,
        p_admin_pin: pinHash,
        p_target_id: targetId,
      });

      if (error) {
        console.error("Reset vibecheck error:", error);
        throw error;
      }

      // Broadcast to force target user to refresh
      supabase.channel("live_chat:system_config_sync").send({
        type:  "broadcast",
        event: "force_vibe_refresh",
        payload: { target_student_id: targetId },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
    },
  });
}

/**
 * Mutation to manually set a user's active mission.
 */
export function useSetMissionMutation(adminId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      targetId,
      missionId,
      pinHash,
    }: {
      targetId: string;
      missionId: number;
      pinHash: string;
    }) => {
      const { error } = await supabase.rpc("admin_set_mission", {
        p_admin_id:   adminId,
        p_admin_pin:  pinHash,
        p_target_id:  targetId,
        p_mission_id: missionId,
      });

      if (error) {
        console.error("Set mission error:", error);
        throw error;
      }

      supabase.channel("live_chat:system_config_sync").send({
        type:  "broadcast",
        event: "force_vibe_refresh",
        payload: { target_student_id: targetId },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
    },
  });
}

/**
 * Mutation to update a user's profile and role via secure RPC.
 * Replaces direct .from("users").update() to prevent client-side privilege escalation.
 */
export function useUpdateUserProfileRpcMutation(adminId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pinHash,
      targetId,
      newRole,
      nickname,
      faculty,
      major,
      housePosition,
    }: {
      pinHash: string;
      targetId: string;
      newRole: string;
      nickname: string;
      faculty: string;
      major: string;
      housePosition: string;
    }) => {
      const { data, error } = await supabase.rpc("admin_update_user_profile", {
        p_admin_id:       adminId,
        p_admin_pin:      pinHash,
        p_target_id:      targetId,
        p_new_role:       newRole,
        p_nickname:       nickname,
        p_faculty:        faculty,
        p_major:          major,
        p_house_position: housePosition,
      });

      if (error) {
        console.error("Admin update user profile error:", error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.users() });
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.auditLogs() });
    },
  });
}

/**
 * Mutation to delete a mission and reorder sequence via PIN-authenticated RPC.
 */
export function useDeleteMissionReorderMutation(adminId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      missionId,
      pinHash,
    }: {
      missionId: number;
      pinHash: string;
    }) => {
      const { error } = await supabase.rpc("admin_delete_mission_reorder", {
        p_admin_id:   adminId,
        p_admin_pin:  pinHash,
        p_mission_id: missionId,
      });

      if (error) {
        console.error("Delete mission reorder error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.missions() });
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.auditLogs() });
    },
  });
}
