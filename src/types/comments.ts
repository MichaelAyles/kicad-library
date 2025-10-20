// Types for the comments system

export interface Profile {
  id: string;
  username: string;
  avatar_url?: string;
}

export interface Comment {
  id: string;
  circuit_id: string;
  user_id: string;
  parent_comment_id: string | null;
  content: string;
  likes_count: number;
  created_at: string;
  updated_at: string;
  is_edited: boolean;

  // Joined data
  user?: Profile;
  replies?: Comment[];

  // Current user state
  is_liked_by_user?: boolean;
}

export interface CommentLike {
  id: string;
  comment_id: string;
  user_id: string;
  created_at: string;
}

export interface CreateCommentInput {
  circuit_id: string;
  content: string;
  parent_comment_id?: string | null;
}

export interface UpdateCommentInput {
  content: string;
}
