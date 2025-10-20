"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Loader } from "lucide-react";
import { Comment } from "@/components/Comment";
import { CommentForm } from "@/components/CommentForm";
import { getCircuitComments } from "@/lib/comments";
import { useAuth } from "@/hooks/useAuth";
import type { Comment as CommentType } from "@/types/comments";

interface CommentListProps {
  circuitId: string;
}

export function CommentList({ circuitId }: CommentListProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const loadComments = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getCircuitComments(circuitId, user?.id);
      setComments(data);
    } catch (err) {
      console.error("Failed to load comments:", err);
      setError("Failed to load comments");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circuitId, user?.id]);

  const handleCommentSuccess = () => {
    loadComments();
    setReplyingTo(null);
  };

  const handleReply = (commentId: string) => {
    setReplyingTo(commentId);
  };

  const totalComments = comments.reduce((acc, comment) => {
    const countReplies = (c: CommentType): number => {
      return 1 + (c.replies?.reduce((sum, reply) => sum + countReplies(reply), 0) || 0);
    };
    return acc + countReplies(comment);
  }, 0);

  return (
    <div className="bg-card border rounded-lg p-6">
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-6">
        <MessageSquare className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">
          Comments {totalComments > 0 && `(${totalComments})`}
        </h2>
      </div>

      {/* Top-level comment form */}
      <div className="mb-8">
        <CommentForm
          circuitId={circuitId}
          onSuccess={handleCommentSuccess}
          placeholder="Share your thoughts, ask questions, or provide feedback..."
        />
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadComments}
            className="mt-2 text-sm text-red-600 hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Comments list */}
      {!isLoading && !error && (
        <>
          {comments.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                No comments yet. Be the first to share your thoughts!
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {comments.map((comment) => (
                <div key={comment.id}>
                  <Comment
                    comment={comment}
                    onReply={handleReply}
                    onUpdate={loadComments}
                  />

                  {/* Reply form */}
                  {replyingTo === comment.id && (
                    <div className="ml-12 mt-3">
                      <CommentForm
                        circuitId={circuitId}
                        parentCommentId={comment.id}
                        onSuccess={handleCommentSuccess}
                        onCancel={() => setReplyingTo(null)}
                        placeholder={`Reply to @${comment.user?.username}...`}
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
