/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { hashPin } from "../utils/crypto";

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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [hasClaimedFace, setHasClaimedFace] = useState<boolean>(false);

  const refreshClaimedFaceStatus = useCallback(async (currentStudentId?: string) => {
    const studentId = currentStudentId || user?.student_id;
    if (!studentId) {
      setHasClaimedFace(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_faces")
        .select("immich_person_id")
        .eq("student_id", studentId);

      if (error) throw error;
      setHasClaimedFace(!!(data && data.length > 0));
    } catch (err) {
      console.error("Error checking claimed faces:", err);
      setHasClaimedFace(false);
    }
  }, [user?.student_id]);

  useEffect(() => {
    let active = true;
    if (user) {
      const run = async () => {
        const studentId = user.student_id;
        try {
          const { data, error } = await supabase
            .from("user_faces")
            .select("immich_person_id")
            .eq("student_id", studentId);

          if (error) throw error;
          if (active) {
            setHasClaimedFace(!!(data && data.length > 0));
          }
        } catch (err) {
          console.error("Error in claimed face check:", err);
          if (active) {
            setHasClaimedFace(false);
          }
        }
      };
      run();
    } else {
      Promise.resolve().then(() => {
        if (active) {
          setHasClaimedFace(false);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      const savedToken = localStorage.getItem("baan7_session_token");
      if (savedToken) {
        try {
          const { data, error } = await supabase
            .from("user_sessions")
            .select("student_id, expires_at, users (*)")
            .eq("session_token", savedToken)
            .maybeSingle();

          if (!active) return;

          if (error || !data || !data.users) {
            console.error("Session restore failed or expired:", error);
            localStorage.removeItem("baan7_session_token");
          } else {
            const expiresAt = new Date(data.expires_at);
            if (expiresAt < new Date()) {
              console.log("Session token expired, deleting on-demand");
              await supabase
                .from("user_sessions")
                .delete()
                .eq("session_token", savedToken);
              localStorage.removeItem("baan7_session_token");
            } else {
              setUser(data.users as unknown as User);
            }
          }
        } catch (err) {
          console.error("Session restore failed:", err);
          if (active) localStorage.removeItem("baan7_session_token");
        }
      }
      if (active) setLoading(false);
    };

    restoreSession();
    return () => {
      active = false;
    };
  }, []);

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

      setUser(data as User);
      localStorage.removeItem("baan7_student_id"); // remove legacy key
      localStorage.setItem("baan7_session_token", sessionData.session_token);
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

      setUser(data as User);
      localStorage.removeItem("baan7_student_id"); // remove legacy key
      localStorage.setItem("baan7_session_token", sessionData.session_token);
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
      const updates: Partial<User> = {
        nickname: profile.nickname,
        faculty: profile.faculty,
        major: profile.major || null,
        ig: profile.ig || null,
        bio: profile.bio || null,
        profile_pic_url: profile.profilePicUrl || null,
        photo_pool: profile.photoPool || [],
        house_position: profile.housePosition || null,
        immich_asset_id: profile.immichAssetId || null,
      };

      if (profile.avatarColor) {
        updates.avatar_color = profile.avatarColor;
      }

      const { data, error } = await supabase
        .from("users")
        .update(updates)
        .eq("student_id", user.student_id)
        .select()
        .single();

      if (error) throw error;

      if (!data) return false;

      setUser(data as User);
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

      setUser(data as User);
      return true;
    } catch (err) {
      console.error("Accept ToS error:", err);
      return false;
    }
  };

  const logout = async () => {
    const savedToken = localStorage.getItem("baan7_session_token");
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
    setUser(null);
    localStorage.removeItem("baan7_session_token");
    localStorage.removeItem("baan7_student_id");
  };


  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        hasClaimedFace,
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
