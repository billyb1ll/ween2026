/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { hashPin } from "../utils/crypto";
import { useActiveSession, useClaimedFaceStatus, useUpdateProfileMutation, useClaimProfileMutation, userQueryKeys } from "../hooks/useUserQueries";

export interface User {
  student_id: string;
  // pin_hash is intentionally absent: never returned to the client layer.
  nickname: string | null;
  faculty: string | null;
  major: string | null;
  ig: string | null;
  role: "moderator" | "staff" | "student";
  avatar_color: string;
  images: string[];
  tags: string[];
  bio: string | null;
  profile_pic_url: string | null;
  photo_pool: string[];
  house_position: string | null;
  immich_asset_id: string | null;
  // full_name is not a DB column; kept as optional so legacy UI guards remain valid.
  full_name?: string | null;
  has_accepted_tos: boolean;
  created_at: string;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  hasClaimedFace: boolean;
  refreshClaimedFaceStatus: (currentStudentId?: string) => Promise<void>;
  checkStudentId: (
    studentId: string,
  ) => Promise<{ exists: boolean; hasPin: boolean; user?: User }>;
  login: (studentId: string, pin: string) => Promise<boolean>;
  registerPin: (studentId: string, pin: string) => Promise<boolean>;
  updateProfile: (profile: {
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
  }) => Promise<boolean>;
  acceptTos: () => Promise<boolean>;
  logout: () => void;
  // Returns the current session's hashed PIN for admin RPC calls.
  // Stored in sessionStorage only — never in the User object or query cache.
  getAdminPin: () => string;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const queryClient = useQueryClient();
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem("baan7_session_token");
    } catch {
      return null;
    }
  });

  const { data: user, isLoading: sessionLoading } = useActiveSession(sessionToken);
  const { data: hasClaimedFace } = useClaimedFaceStatus(user?.student_id);
  const updateProfileMutation = useUpdateProfileMutation();
  const claimProfileMutation = useClaimProfileMutation();

  useEffect(() => {
    // If we have a session token but the query finishes loading and returns null,
    // the session has either expired or been invalidated on the server.
    if (!sessionLoading && sessionToken && user === null) {
      console.warn("Session expired or invalid, cleaning up local storage.");
      localStorage.removeItem("baan7_session_token");
      sessionStorage.removeItem("baan7_admin_pin");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSessionToken(null);
    }
  }, [user, sessionLoading, sessionToken]);

  const refreshClaimedFaceStatus = useCallback(async (currentStudentId?: string) => {
    const studentId = currentStudentId || user?.student_id;
    if (studentId) {
      await queryClient.invalidateQueries({ queryKey: userQueryKeys.claimedFace(studentId) });
    }
  }, [user?.student_id, queryClient]);

  const checkStudentId = async (studentId: string) => {
    try {
      // Select only the minimal fields required to verify existence and PIN
      // status. Returning pin_hash to callers is intentionally prohibited.
      const { data, error } = await supabase
        .from("users")
        .select("student_id, pin_hash, role")
        .eq("student_id", studentId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return { exists: false, hasPin: false };
      }

      // Strip pin_hash before surfacing any user data to the caller.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { pin_hash: _discarded, ...safeFields } = data;

      return {
        exists: true,
        hasPin: !!data.pin_hash,
        user: safeFields as User,
      };
    } catch (err) {
      console.error("Check student ID error:", err);
      return { exists: false, hasPin: false };
    }
  };

  const login = async (studentId: string, pin: string): Promise<boolean> => {
    try {
      const hashedPin = await hashPin(pin, studentId);
      const { data, error } = await supabase.rpc("verify_user_login", {
        p_student_id: studentId,
        p_pin_hash: hashedPin,
      }).maybeSingle();

      if (error) throw error;

      if (!data) {
        return false;
      }

      const verifiedUser = data as unknown as User;

      // Generate a session in the database
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: sessionData, error: sessionError } = await supabase
        .from("user_sessions")
        .insert({
          student_id: verifiedUser.student_id,
          expires_at: expiresAt,
        })
        .select("session_token")
        .single();

      if (sessionError || !sessionData) {
        console.error("Session creation failed:", sessionError);
        return false;
      }

      // Store hashed PIN in sessionStorage for admin RPC calls.
      // sessionStorage is scoped to the tab and cleared on browser close.
      // It is NOT stored in the User object or TanStack Query cache.
      sessionStorage.setItem("baan7_admin_pin", hashedPin);

      localStorage.removeItem("baan7_student_id");
      localStorage.setItem("baan7_session_token", sessionData.session_token);

      // Update local React state and invalidate queries to fetch fresh profile
      setSessionToken(sessionData.session_token);
      await queryClient.invalidateQueries({ queryKey: userQueryKeys.session(sessionData.session_token) });
      return true;
    } catch (err) {
      console.error("Login error:", err);
      return false;
    }
  };

  const registerPin = async (
    studentId: string,
    pin: string,
  ): Promise<boolean> => {
    try {
      const sessionDataToken = await claimProfileMutation.mutateAsync({ studentId, pin });
      const hashedPin = await hashPin(pin, studentId);

      localStorage.removeItem("baan7_student_id");
      localStorage.setItem("baan7_session_token", sessionDataToken);
      sessionStorage.setItem("baan7_admin_pin", hashedPin);

      // Update state and refresh
      setSessionToken(sessionDataToken);
      return true;
    } catch (err: unknown) {
      console.error("PIN registration error:", err);
      // Re-throw if it's our explicit DB exception so the UI can catch it
      if (err instanceof Error && err.message?.includes("PROFILE_ALREADY_CLAIMED")) {
        throw err;
      }
      return false;
    }
  };

  const updateProfile = async (profile: {
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
  }): Promise<boolean> => {
    if (!user) return false;

    try {
      await updateProfileMutation.mutateAsync({
        studentId: user.student_id,
        profile,
      });
      return true;
    } catch (err) {
      console.error("Update profile error:", err);
      return false;
    }
  };

  const acceptTos = async (): Promise<boolean> => {
    if (!user) return false;
    try {
      const { data, error } = await supabase
        .from("users")
        .update({ has_accepted_tos: true })
        .eq("student_id", user.student_id)
        .select()
        .single();

      if (error) throw error;
      if (!data) return false;

      // Update query client cache
      queryClient.setQueryData(userQueryKeys.session(sessionToken || ""), data);
      return true;
    } catch (err) {
      console.error("Accept ToS error:", err);
      return false;
    }
  };

  const logout = async () => {
    const savedToken = sessionToken;
    if (savedToken) {
      try {
        await supabase
          .from("user_sessions")
          .delete()
          .eq("session_token", savedToken);
      } catch (err) {
        console.error("Logout DB cleanup failed:", err);
      }
    }

    // Clear session credentials
    localStorage.removeItem("baan7_session_token");
    localStorage.removeItem("baan7_student_id");
    sessionStorage.removeItem("baan7_admin_pin");
    queryClient.removeQueries({ queryKey: ["user_session"] });
    if (user?.student_id) {
      queryClient.removeQueries({ queryKey: userQueryKeys.claimedFace(user.student_id) });
    }
    setSessionToken(null);
  };

  // Returns the hashed PIN for the current session.
  // Falls back to empty string if the session was restored from a page refresh
  // (sessionStorage is cleared on tab close). In that case, admin actions
  // requiring PIN auth will prompt for re-authentication.
  const getAdminPin = (): string => {
    return sessionStorage.getItem("baan7_admin_pin") ?? "";
  };

  const loading = sessionToken ? sessionLoading : false;

  return (
    <UserContext.Provider
      value={{
        user: user || null,
        loading,
        hasClaimedFace: !!hasClaimedFace,
        refreshClaimedFaceStatus,
        checkStudentId,
        login,
        registerPin,
        updateProfile,
        acceptTos,
        logout,
        getAdminPin,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
