// API functions for comments system using Supabase

import { createClient } from "@/lib/supabase/client";
import type {
  Comment,
  CreateCommentInput,
  UpdateCommentInput,
} from "@/types/comments";

const supabase = createClient();

/**
 * Fetch all comments for a circuit with user data and nested replies
 */
export async function getCircuitComments(
  circuitId: string,
  userId?: string,
): Promise<Comment[]> {
  try {
    // Fetch all comments for this circuit
    const { data: comments, error } = await supabase
      .from("circuit_comments")
      .select(
        `
        *,
        user:profiles(id, username, avatar_url)
      `,
      )
      .eq("circuit_id", circuitId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    if (!comments) return [];

    // If user is logged in, fetch their likes
    let userLikes: Set<string> = new Set();
    if (userId) {
      const { data: likes } = await supabase
        .from("comment_likes")
        .select("comment_id")
        .eq("user_id", userId);

      if (likes) {
        userLikes = new Set(likes.map((like) => like.comment_id));
      }
    }

    // Build threaded structure: separate top-level comments and replies
    const topLevelComments: Comment[] = [];
    const repliesMap: Map<string, Comment[]> = new Map();

    comments.forEach((comment) => {
      const commentWithLike = {
        ...comment,
        is_liked_by_user: userLikes.has(comment.id),
        replies: [],
      };

      if (!comment.parent_comment_id) {
        // Top-level comment
        topLevelComments.push(commentWithLike);
      } else {
        // Reply to another comment
        if (!repliesMap.has(comment.parent_comment_id)) {
          repliesMap.set(comment.parent_comment_id, []);
        }
        repliesMap.get(comment.parent_comment_id)!.push(commentWithLike);
      }
    });

    // Attach replies to their parent comments
    function attachReplies(comment: Comment): Comment {
      const replies = repliesMap.get(comment.id) || [];
      return {
        ...comment,
        replies: replies.map(attachReplies), // Recursively attach nested replies
      };
    }

    return topLevelComments.map(attachReplies);
  } catch (error) {
    console.error("Error fetching comments:", error);
    throw error;
  }
}

// Maximum comment length
const MAX_COMMENT_LENGTH = 10000;

/**
 * Create a new comment or reply
 */
export async function createComment(
  input: CreateCommentInput,
): Promise<Comment> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User must be authenticated to comment");

    // Validate content length
    const trimmedContent = input.content.trim();
    if (!trimmedContent) {
      throw new Error("Comment cannot be empty");
    }
    if (trimmedContent.length > MAX_COMMENT_LENGTH) {
      throw new Error(
        `Comment must be ${MAX_COMMENT_LENGTH.toLocaleString()} characters or less`,
      );
    }

    const { data, error } = await supabase
      .from("circuit_comments")
      .insert({
        circuit_id: input.circuit_id,
        user_id: user.id,
        parent_comment_id: input.parent_comment_id || null,
        content: trimmedContent,
      })
      .select(
        `
        *,
        user:profiles(id, username, avatar_url)
      `,
      )
      .single();

    if (error) throw error;
    if (!data) throw new Error("Failed to create comment");

    return {
      ...data,
      is_liked_by_user: false,
      replies: [],
    };
  } catch (error) {
    console.error("Error creating comment:", error);
    throw error;
  }
}

/**
 * Update a comment (edit content)
 */
export async function updateComment(
  commentId: string,
  input: UpdateCommentInput,
): Promise<Comment> {
  try {
    // Validate content length
    const trimmedContent = input.content.trim();
    if (!trimmedContent) {
      throw new Error("Comment cannot be empty");
    }
    if (trimmedContent.length > MAX_COMMENT_LENGTH) {
      throw new Error(
        `Comment must be ${MAX_COMMENT_LENGTH.toLocaleString()} characters or less`,
      );
    }

    const { data, error } = await supabase
      .from("circuit_comments")
      .update({ content: trimmedContent })
      .eq("id", commentId)
      .select(
        `
        *,
        user:profiles(id, username, avatar_url)
      `,
      )
      .single();

    if (error) throw error;
    if (!data) throw new Error("Failed to update comment");

    return data;
  } catch (error) {
    console.error("Error updating comment:", error);
    throw error;
  }
}

/**
 * Delete a comment
 */
export async function deleteComment(commentId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("circuit_comments")
      .delete()
      .eq("id", commentId);

    if (error) throw error;
  } catch (error) {
    console.error("Error deleting comment:", error);
    throw error;
  }
}

/**
 * Toggle like on a comment
 */
export async function toggleCommentLike(commentId: string): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User must be authenticated to like comments");

    // Check if already liked
    const { data: existingLike } = await supabase
      .from("comment_likes")
      .select("id")
      .eq("comment_id", commentId)
      .eq("user_id", user.id)
      .single();

    if (existingLike) {
      // Unlike: remove the like
      const { error } = await supabase
        .from("comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", user.id);

      if (error) throw error;
      return false; // Now unliked
    } else {
      // Like: add the like
      const { error } = await supabase.from("comment_likes").insert({
        comment_id: commentId,
        user_id: user.id,
      });

      if (error) throw error;
      return true; // Now liked
    }
  } catch (error) {
    console.error("Error toggling comment like:", error);
    throw error;
  }
}

/**
 * Get comment count for a circuit
 */
export async function getCommentCount(circuitId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from("circuit_comments")
      .select("*", { count: "exact", head: true })
      .eq("circuit_id", circuitId);

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error("Error getting comment count:", error);
    return 0;
  }
}
