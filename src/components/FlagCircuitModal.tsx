"use client";

import { useState } from "react";
import { X, Flag, AlertTriangle } from "lucide-react";
import { createCircuitFlag } from "@/lib/flags";
import { FLAG_REASONS, type FlagReason } from "@/types/flags";

interface FlagCircuitModalProps {
  circuitId: string;
  circuitTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function FlagCircuitModal({
  circuitId,
  circuitTitle,
  isOpen,
  onClose,
  onSuccess,
}: FlagCircuitModalProps) {
  const [reason, setReason] = useState<FlagReason>('other');
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason) {
      alert("Please select a reason");
      return;
    }

    setIsSubmitting(true);

    try {
      await createCircuitFlag({
        circuit_id: circuitId,
        reason,
        details: details.trim() || undefined,
      });

      alert("Thank you for your report. We will review it shortly.");
      onSuccess();
      handleClose();
    } catch (error) {
      console.error("Failed to flag circuit:", error);
      alert("Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason('other');
    setDetails("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-background border rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-destructive" />
            <h2 className="text-xl font-semibold">Flag Circuit</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Warning message */}
          <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 flex gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <p className="font-medium mb-1">Report: {circuitTitle}</p>
              <p className="text-xs">
                Please only report content that violates our community guidelines.
                False reports may result in account restrictions.
              </p>
            </div>
          </div>

          {/* Reason selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Reason for flagging *
            </label>
            <div className="space-y-2">
              {(Object.keys(FLAG_REASONS) as FlagReason[]).map((flagReason) => (
                <label
                  key={flagReason}
                  className="flex items-start gap-3 p-3 border rounded-md hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name="reason"
                    value={flagReason}
                    checked={reason === flagReason}
                    onChange={(e) => setReason(e.target.value as FlagReason)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      {FLAG_REASONS[flagReason].label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {FLAG_REASONS[flagReason].description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Additional details */}
          <div>
            <label htmlFor="details" className="block text-sm font-medium mb-2">
              Additional details (optional)
            </label>
            <textarea
              id="details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide any additional context that may help us review this report..."
              className="w-full px-3 py-2 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
              maxLength={500}
              disabled={isSubmitting}
            />
            <div className="text-xs text-muted-foreground mt-1">
              {details.length}/500 characters
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border rounded-md text-sm hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Flag className="w-4 h-4" />
              {isSubmitting ? "Submitting..." : "Submit Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
