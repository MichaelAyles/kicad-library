"use client";

import { useState } from "react";
import { Send, X, Eye } from "lucide-react";
import { createComment } from "@/lib/comments";
import { useAuth } from "@/hooks/useAuth";
import type { CreateCommentInput } from "@/types/comments";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface CommentFormProps {
  circuitId: string;
  parentCommentId?: string | null;
  onSuccess: () => void;
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function CommentForm({
  circuitId,
  parentCommentId = null,
  onSuccess,
  onCancel,
  placeholder = "Write a comment...",
  autoFocus = false,
}: CommentFormProps) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      alert("Please log in to comment");
      return;
    }

    if (!content.trim()) {
      alert("Comment cannot be empty");
      return;
    }

    setIsSubmitting(true);

    try {
      const input: CreateCommentInput = {
        circuit_id: circuitId,
        content: content.trim(),
        parent_comment_id: parentCommentId,
      };

      await createComment(input);
      setContent("");
      onSuccess();
    } catch (error) {
      console.error("Failed to create comment:", error);
      alert("Failed to post comment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="bg-muted/30 border border-muted rounded-lg p-6 text-center">
        <p className="text-muted-foreground mb-3">
          Please{" "}
          <a href="/login" className="text-primary hover:underline">
            log in
          </a>{" "}
          to leave a comment
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-start gap-3">
        {/* User avatar */}
        <div className="flex-shrink-0">
          {user.user_metadata?.avatar_url ? (
            <img
              src={user.user_metadata.avatar_url}
              alt={user.user_metadata?.username || "You"}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
              {user.user_metadata?.username?.[0]?.toUpperCase() || "?"}
            </div>
          )}
        </div>

        {/* Textarea */}
        <div className="flex-1">
          {/* Tabs for Write/Preview */}
          <div className="flex gap-2 border-b mb-2">
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className={`px-3 py-1 text-sm font-medium transition-colors ${
                !showPreview
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className={`px-3 py-1 text-sm font-medium transition-colors flex items-center gap-1 ${
                showPreview
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
          </div>

          {/* Editor or Preview */}
          {showPreview ? (
            <div className="min-h-[80px] px-4 py-3 border rounded-lg bg-muted/30">
              {content.trim() ? (
                <MarkdownRenderer content={content} />
              ) : (
                <p className="text-sm text-muted-foreground italic">Nothing to preview</p>
              )}
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={placeholder}
              className="w-full px-4 py-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              rows={parentCommentId ? 2 : 3}
              maxLength={10000}
              disabled={isSubmitting}
              autoFocus={autoFocus}
            />
          )}

          <div className="flex justify-between items-center mt-2">
            <span className={`text-xs ${content.length >= 9000 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
              {content.length.toLocaleString()}/10,000 • Markdown supported
            </span>
            <div className="flex gap-2">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="px-4 py-2 border rounded-md text-sm hover:bg-muted/50 transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting || !content.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? "Posting..." : parentCommentId ? "Reply" : "Comment"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
