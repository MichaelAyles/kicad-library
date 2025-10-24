/**
 * Circuit Flag Types
 *
 * Types for circuit content moderation and flagging system
 */

export type FlagReason =
  | 'inappropriate_content'
  | 'copyright_violation'
  | 'spam'
  | 'broken_circuit'
  | 'duplicate'
  | 'other';

export type FlagStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

export interface CircuitFlag {
  id: string;
  circuit_id: string;
  flagged_by: string;
  reason: FlagReason;
  details: string | null;
  status: FlagStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFlagInput {
  circuit_id: string;
  reason: FlagReason;
  details?: string;
}

export interface UpdateFlagInput {
  status?: FlagStatus;
  admin_notes?: string;
}

export const FLAG_REASONS: Record<FlagReason, { label: string; description: string }> = {
  inappropriate_content: {
    label: 'Inappropriate Content',
    description: 'Contains offensive, harmful, or inappropriate content',
  },
  copyright_violation: {
    label: 'Copyright Violation',
    description: 'Violates copyright or intellectual property rights',
  },
  spam: {
    label: 'Spam',
    description: 'Spam, advertisement, or off-topic content',
  },
  broken_circuit: {
    label: 'Broken Circuit',
    description: 'Circuit is invalid, corrupted, or does not work',
  },
  duplicate: {
    label: 'Duplicate',
    description: 'This circuit is a duplicate of another existing circuit',
  },
  other: {
    label: 'Other',
    description: 'Other reason not listed above',
  },
};
