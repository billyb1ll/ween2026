import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

export interface LikedUser {
  student_id: string;
  nickname: string | null;
  avatar_color: string;
  role: string;
  profile_pic_url: string | null;
  faculty: string | null;
  house_position: string | null;
}

export function useLikedByUsers(studentIds: string[], enabled: boolean = true) {
  const cleanIds = Array.from(
    new Set((studentIds || []).filter((id): id is string => Boolean(id) && typeof id === "string"))
  ).sort();

  const sortedKey = cleanIds.join(",");

  return useQuery<LikedUser[]>({
    queryKey: ["liked_by_users", sortedKey],
    queryFn: async () => {
      if (cleanIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("users")
        .select("student_id, nickname, avatar_color, role, profile_pic_url, faculty, house_position")
        .in("student_id", cleanIds);

      if (error) {
        console.error("Error fetching liked_by users from Supabase:", error);
        throw error;
      }

      return (data as LikedUser[]) ?? [];
    },
    enabled: enabled && cleanIds.length > 0,
    staleTime: 60000,
  });
}
