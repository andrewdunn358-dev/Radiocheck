// Veteran Voices — admin portal types (PR #B2).
// Mirrors `backend/models/clips.py` + `backend/routers/clips_admin.py`.
// Keep these in sync if the backend shapes ever change.

export type ClipStatus = 'draft' | 'published' | 'archived';

export type ClipProcessingStatus =
  | 'pending'
  | 'transcoding'
  | 'transcribing'
  | 'ready'
  | 'failed';

// User situation categories — must match `ClipCategory` in
// backend/models/clips.py. Order here drives the form picker order.
export const CLIP_CATEGORIES = [
  'couldnt_sleep',
  'anniversary',
  'lost_purpose',
  'family_doesnt_get_it',
  'money_worries',
  'anger',
  'transition',
  'loss',
  'addiction_recovery',
  'physical_injury',
  'identity',
  'faith',
  'just_need_to_hear_a_voice',
] as const;

export type ClipCategory = (typeof CLIP_CATEGORIES)[number];

// Content-warning flags — must match `SensitivityFlag` in
// backend/models/clips.py. `none` is the default for safe clips.
export const SENSITIVITY_FLAGS = [
  'none',
  'loss',
  'MST',
  'suicidal_ideation',
  'addiction',
  'violence',
] as const;

export type SensitivityFlag = (typeof SENSITIVITY_FLAGS)[number];

export interface CaptionSegment {
  start: number; // seconds
  end: number;
  text: string;
}

// Compact row returned by GET /api/admin/clips (list view).
export interface ClipAdminListItem {
  id: string;
  contributorName: string;
  durationSeconds: number;
  status: ClipStatus;
  processingStatus: ClipProcessingStatus;
  categories: string[];
  sensitivityFlags: string[];
  createdAt: string;
  updatedAt: string;
}

// Full admin payload from GET /api/admin/clips/{id}.
// Includes transcript + internal notes — NEVER expose these to veterans.
export interface ClipAdminResponse {
  id: string;
  contributorName: string;
  contributorBio: string;
  contributorPhotoUrl?: string | null;
  audioFilename: string;
  durationSeconds: number;
  transcript: string;
  captions: CaptionSegment[];
  categories: string[];
  sensitivityFlags: string[];
  recordingDate?: string | null;
  status: ClipStatus;
  consentConfirmed: boolean;
  uploadedByAdminId?: string | null;
  adminNotes?: string | null;
  internalNotes?: string | null;
  processingStatus: ClipProcessingStatus;
  processingError?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Body shape for PATCH /api/admin/clips/{id}. All fields optional.
export interface ClipUpdateRequest {
  contributorName?: string;
  contributorBio?: string;
  contributorPhotoUrl?: string | null;
  transcript?: string;
  captions?: CaptionSegment[];
  categories?: string[];
  sensitivityFlags?: string[];
  recordingDate?: string | null;
  consentConfirmed?: boolean;
  adminNotes?: string | null;
  internalNotes?: string | null;
  status?: ClipStatus;
}
