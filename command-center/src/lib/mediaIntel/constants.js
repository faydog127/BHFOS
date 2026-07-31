import { MAX_PRACTICAL_HASH_BYTES } from './checksum';

export const MIL_ORIGINALS_BUCKET = 'media-intel-originals';
export const MIL_DERIVATIVES_BUCKET = 'media-intel-derivatives';
export const MIL_WEBSITE_BUCKET = 'website-public-media';

export const MIL_SUPPORTED_MIME = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
];

// Pre-staging hardening: capped to the practical in-browser SHA-256 hashing limit
// (see checksum.js). Do not advertise 2 GB in UI copy until chunked hashing exists.
export const MIL_MAX_FILE_BYTES = MAX_PRACTICAL_HASH_BYTES;

/** Upload batch label for contributor phone self-shots (Submit Content / legacy Upload my shots). */
export const CONTRIBUTOR_SELF_SOURCE_LABEL = 'contributor_self';

/** Contributor deliberate submission types (business type — not inferred from MIME). */
export const SUBMISSION_TYPES = [
  { id: 'reel', label: 'Reel', badge: 'REEL' },
  { id: 'raw_video', label: 'Raw video', badge: 'RAW VIDEO' },
  { id: 'social_post', label: 'Social media post', badge: 'SOCIAL POST' },
];

export const DEFAULT_SUBMISSION_TYPE = 'reel';

export const SUBMISSION_REVIEW_LABELS = {
  draft: 'Draft',
  awaiting_owner_review: 'Awaiting owner review',
  changes_requested: 'Changes requested',
  approved: 'Approved',
  rejected: 'Rejected',
  ready_to_post: 'Ready to post',
};

export const REVIEW_QUEUE_FILTERS = [
  { id: 'needs_review', label: 'Needs review' },
  { id: 'reel', label: 'Reels' },
  { id: 'raw_video', label: 'Raw media' },
  { id: 'social_post', label: 'Social posts' },
  { id: 'changes_requested', label: 'Changes requested' },
  { id: 'approved', label: 'Approved' },
  { id: 'all', label: 'All' },
];

export const MIL_NAV = [
  { id: 'dashboard', name: 'Dashboard', path: 'dashboard' },
  { id: 'uploads', name: 'Uploads', path: 'uploads' },
  { id: 'upload', name: 'Phone upload', path: 'upload' },
  { id: 'received', name: 'Received', path: 'received' },
  { id: 'review', name: 'Review Queue', path: 'review' },
  { id: 'quality-cleanup', name: 'Quality Cleanup', path: 'quality-cleanup' },
  { id: 'all', name: 'All Media', path: 'all' },
  { id: 'collections', name: 'Collections', path: 'collections' },
  { id: 'before-after', name: 'Before & After', path: 'before-after' },
  { id: 'reel-review', name: 'Reel Review', path: 'reel-review' },
  { id: 'approved', name: 'Approved to Post', path: 'approved-to-post' },
  { id: 'archive', name: 'Archive / Trash', path: 'archive' },
  { id: 'settings', name: 'Settings', path: 'settings' },
];

export const HUMAN_REVIEW_LABELS = {
  pending: 'Awaiting review',
  in_review: 'In review',
  verified: 'Verified',
  rejected: 'Rejected',
  archived: 'Archived',
};

export const PROCESSING_LABELS = {
  uploaded: 'Uploaded',
  queued: 'Queued for analysis',
  analyzing: 'Analyzing',
  analyzed: 'Analyzed',
  processing_failed: 'Analysis failed',
};

export const PRIVACY_LABELS = {
  clear: 'Privacy clear',
  needs_review: 'Needs privacy review',
  needs_redaction: 'Needs redaction',
  restricted: 'Restricted',
};

export const REEL_STATUS_LABELS = {
  creator_draft: 'Draft',
  submitted_for_review: 'Submitted for review',
  revision_requested: 'Revision requested',
  approved_to_post: 'Approved to post',
  denied: 'Denied',
  superseded: 'Superseded',
  archived: 'Archived',
};

export const UPLOAD_PHONE_NOTICE =
  'Keep original media on the phone until this transfer is verified and an independent backup is confirmed. This app never deletes files from your phone.';
