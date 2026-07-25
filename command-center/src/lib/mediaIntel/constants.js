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

export const MIL_MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GiB

export const MIL_NAV = [
  { id: 'dashboard', name: 'Dashboard', path: 'dashboard' },
  { id: 'uploads', name: 'Uploads', path: 'uploads' },
  { id: 'upload', name: 'Phone upload', path: 'upload' },
  { id: 'review', name: 'Review Queue', path: 'review' },
  { id: 'all', name: 'All Media', path: 'all' },
  { id: 'collections', name: 'Collections', path: 'collections' },
  { id: 'before-after', name: 'Before & After', path: 'before-after' },
  { id: 'reel-review', name: 'Reel Review', path: 'reel-review' },
  { id: 'approved', name: 'Approved to Post', path: 'approved-to-post' },
  { id: 'archive', name: 'Archive / Restricted', path: 'archive' },
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
