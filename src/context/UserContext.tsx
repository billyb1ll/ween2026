/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { hashPin } from "../utils/crypto";
import { useActiveSession, useClaimedFaceStatus, useUpdateProfileMutation, userQueryKeys } from "../hooks/useUserQueries";

export interface User {
  student_id: string;
  pin_hash: string | null;
  nickname: string | null;
  faculty: string | null;
  major: string | null;
  ig: string | null;
  role: "moderator" | "media_admin" | "staff" | "student";
  avatar_color: string;
  images: string[];
  tags: string[];
  bio: string | null;
  profile_pic_url: string | null;
  photo_pool: string[];
  house_position: string | null;
  immich_asset_id: string | null;
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

  const refreshClaimedFaceStatus = useCallback(async (currentStudentId?: string) => {
    const studentId = currentStudentId || user?.student_id;
    if (studentId) {
      await queryClient.invalidateQueries({ queryKey: userQueryKeys.claimedFace(studentId) });
    }
  }, [user?.student_id, queryClient]);

  const checkStudentId = async (studentId: string) => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("student_id", studentId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return { exists: false, hasPin: false };
      }

      return {
        exists: true,
        hasPin: !!data.pin_hash,
        user: data as User,
      };
    } catch (err) {
      console.error("Check student ID error:", err);
      return { exists: false, hasPin: false };
    }
  };

  const login = async (studentId: string, pin: string): Promise<boolean> => {
    try {
      const hashedPin = await hashPin(pin);
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("student_id", studentId)
        .eq("pin_hash", hashedPin)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return false;
      }

      // Generate a session in the database
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: sessionData, error: sessionError } = await supabase
        .from("user_sessions")
        .insert({
          student_id: data.student_id,
          expires_at: expiresAt,
        })
        .select("session_token")
        .single();

      if (sessionError || !sessionData) {
        console.error("Session creation failed:", sessionError);
        return false;
      }

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
      const hashedPin = await hashPin(pin);
      const { data, error } = await supabase
        .from("users")
        .update({ pin_hash: hashedPin })
        .eq("student_id", studentId)
        .is("pin_hash", null)
        .select()
        .single();

      if (error) throw error;

      if (!data) {
        return false;
      }

      // Generate a session in the database
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: sessionData, error: sessionError } = await supabase
        .from("user_sessions")
        .insert({
          student_id: data.student_id,
          expires_at: expiresAt,
        })
        .select("session_token")
        .single();

      if (sessionError || !sessionData) {
        console.error("Session creation failed:", sessionError);
        return false;
      }

      localStorage.removeItem("baan7_student_id");
      localStorage.setItem("baan7_session_token", sessionData.session_token);

      // Update state and refresh
      setSessionToken(sessionData.session_token);
      await queryClient.invalidateQueries({ queryKey: userQueryKeys.session(sessionData.session_token) });
      return true;
    } catch (err) {
      console.error("PIN registration error:", err);
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
    
    // Clear tokens and local query caches
    localStorage.removeItem("baan7_session_token");
    localStorage.removeItem("baan7_student_id");
    queryClient.removeQueries({ queryKey: ["user_session"] });
    if (user?.student_id) {
      queryClient.removeQueries({ queryKey: userQueryKeys.claimedFace(user.student_id) });
    }
    setSessionToken(null);
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
