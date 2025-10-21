"use client";

import { useState } from "react";
import { Heart, Reply, Trash2, Edit2, Check, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Comment as CommentType } from "@/types/comments";
import { toggleCommentLike, updateComment, deleteComment } from "@/lib/comments";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

interface CommentProps {
  comment: CommentType;
  onReply: (commentId: string) => void;
  onUpdate: () => void;
  depth?: number;
}

export function Comment({ comment, onReply, onUpdate, depth = 0 }: CommentProps) {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(comment.is_liked_by_user || false);
  const [likesCount, setLikesCount] = useState(comment.likes_count);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOwner = user?.id === comment.user_id;
  const maxDepth = 3; // Maximum nesting depth for replies
  const canReply = depth < maxDepth;

  const handleLike = async () => {
    if (!user) {
      alert("Please log in to like comments");
      return;
    }

    try {
      const newLikedState = await toggleCommentLike(comment.id);
      setIsLiked(newLikedState);
      setLikesCount(prev => newLikedState ? prev + 1 : prev - 1);
    } catch (error) {
      console.error("Failed to toggle like:", error);
      alert("Failed to update like");
    }
  };

  const handleEdit = async () => {
    if (!editContent.trim()) {
      alert("Comment cannot be empty");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateComment(comment.id, { content: editContent });
      setIsEditing(false);
      onUpdate(); // Refresh comments
    } catch (error) {
      console.error("Failed to update comment:", error);
      alert("Failed to update comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this comment?")) {
      return;
    }

    try {
      await deleteComment(comment.id);
      onUpdate(); // Refresh comments
    } catch (error) {
      console.error("Failed to delete comment:", error);
      alert("Failed to delete comment");
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditContent(comment.content);
  };

  return (
    <div className={`${depth > 0 ? 'ml-8 mt-4' : 'mt-4'} border-l-2 border-muted pl-4`}>
      {/* Comment Header */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {comment.user?.avatar_url ? (
            <img
              src={comment.user.avatar_url}
              alt={comment.user.username}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
              {comment.user?.username?.[0]?.toUpperCase() || "?"}
            </div>
          )}
        </div>

        {/* Comment Body */}
        <div className="flex-1 min-w-0">
          {/* User and timestamp */}
          <div className="flex items-center gap-2 text-sm mb-1">
            <Link
              href="/profile"
              className="font-medium text-primary hover:underline"
            >
              @{comment.user?.username || "Unknown"}
            </Link>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
            {comment.is_edited && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground italic">edited</span>
              </>
            )}
          </div>

          {/* Comment Content */}
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full px-3 py-2 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                rows={3}
                maxLength={5000}
                disabled={isSubmitting}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleEdit}
                  disabled={isSubmitting}
                  className="px-3 py-1 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <Check className="w-4 h-4" />
                  Save
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={isSubmitting}
                  className="px-3 py-1 border rounded-md text-sm hover:bg-muted/50 transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap break-words">{comment.content}</p>
          )}

          {/* Actions */}
          {!isEditing && (
            <div className="flex items-center gap-4 mt-2">
              {/* Like button */}
              <button
                onClick={handleLike}
                className={`flex items-center gap-1 text-sm transition-colors ${
                  isLiked ? "text-red-500" : "text-muted-foreground hover:text-red-500"
                }`}
              >
                <Heart className={`w-4 h-4 ${isLiked ? "fill-current" : ""}`} />
                <span>{likesCount}</span>
              </button>

              {/* Reply button */}
              {canReply && (
                <button
                  onClick={() => onReply(comment.id)}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <Reply className="w-4 h-4" />
                  Reply
                </button>
              )}

              {/* Edit button (owner only) */}
              {isOwner && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
              )}

              {/* Delete button (owner only) */}
              {isOwner && (
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Nested Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2">
          {comment.replies.map((reply) => (
            <Comment
              key={reply.id}
              comment={reply}
              onReply={onReply}
              onUpdate={onUpdate}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
