export type BoardTab = "hype" | "memory";

export interface DBPost {
  id: number;
  content: string;
  createdAt: string;
  likes: number;
  comment_count: number;
  tags: string[];
  is_anonymous: boolean;
  is_hidden: boolean;
  student_id: string;
  type: BoardTab;
  liked_by: string[];
  image_url: string | null;
  is_pinned?: boolean;
  author: {
    student_id: string;
    nickname: string | null;
    avatar_color: string;
    role: string;
    profile_pic_url: string | null;
  };
}

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
