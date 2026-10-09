// Shared helpers and constants

export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'INDETERMINATE'];
export const CASE_CATEGORIES = [
  'DEEPFAKE_FACE',
  'VOICE_CLONING_OR_AUDIO_SPOOF',
  'VIDEO_REPLAY_OR_PRESENTATION_ATTACK',
  'DOCUMENT_MANIPULATION',
  'IDENTITY_DISCREPANCY',
  'POTENTIAL_DUPLICATE_IDENTITY',
  'MULTIPLE_RISK_SIGNALS',
  'OTHER_SUSPICIOUS_KYC',
];
export const CASE_STATUSES = [
  'CREATED', 'SHARED', 'ACKNOWLEDGED', 'UNDER_REVIEW',
  'NEEDS_MORE_INFORMATION', 'DISPUTED', 'ESCALATED',
  'RESOLVED', 'CLOSED_WITHOUT_FINDING',
];

export const CHECK_NAMES = [
  { key: 'deepfake_liveness', label: 'Deepfake / Liveness' },
  { key: 'video_replay', label: 'Video Replay / Presentation Attack' },
  { key: 'voice_spoofing', label: 'Voice Spoofing / Cloning' },
  { key: 'audio_video_sync', label: 'Audio-Video Synchronisation' },
  { key: 'document_tampering', label: 'Document Tampering' },
  { key: 'document_field_consistency', label: 'Document Field Consistency' },
  { key: 'face_document_comparison', label: 'Face-to-Document Comparison' },
  { key: 'identity_discrepancy', label: 'Identity Discrepancy' },
  { key: 'duplicate_submission', label: 'Duplicate/Suspicious Submission' },
];

export const ROLES = {
  BANK_KYC_OFFICER: 'KYC Officer',
  BANK_FRAUD_INVESTIGATOR: 'Fraud Investigator',
  BANK_ADMINISTRATOR: 'Administrator',
  NETWORK_AUDITOR: 'Network Auditor',
};

export function riskBadgeClass(risk) {
  switch (risk?.toUpperCase()) {
    case 'LOW': return 'risk-badge-low';
    case 'MEDIUM': return 'risk-badge-medium';
    case 'HIGH': return 'risk-badge-high';
    default: return 'risk-badge-indeterminate';
  }
}

export function statusColor(status) {
  const map = {
    CREATED: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    SHARED: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    ACKNOWLEDGED: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
    UNDER_REVIEW: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    NEEDS_MORE_INFORMATION: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    DISPUTED: 'text-red-400 bg-red-500/10 border-red-500/30',
    ESCALATED: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    RESOLVED: 'text-green-400 bg-green-500/10 border-green-500/30',
    CLOSED_WITHOUT_FINDING: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
  };
  return map[status] || 'text-gray-400 bg-gray-500/10 border-gray-500/30';
}

export function checkStatusColor(status) {
  const map = {
    PASS: 'text-green-400 bg-green-500/10 border-green-500/30',
    REVIEW: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    FAIL: 'text-red-400 bg-red-500/10 border-red-500/30',
    UNAVAILABLE: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
  };
  return map[status?.toUpperCase()] || 'text-gray-400 bg-gray-500/10 border-gray-500/30';
}

export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function formatDateLong(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export function truncate(str, n = 12) {
  if (!str) return '—';
  return str.length > n ? `${str.slice(0, n)}…` : str;
}

export function eventTypeIcon(eventType) {
  const map = {
    CREATED: '🔵',
    SHARED: '📤',
    ACKNOWLEDGED: '✅',
    REVIEW_FINDING: '🔍',
    REQUEST_INFORMATION: '❓',
    DISPUTED: '⚠️',
    ESCALATED: '🚨',
    RESOLVED: '🟢',
    CLOSED_WITHOUT_FINDING: '⬜',
    CORRECTION: '✏️',
  };
  return map[eventType] || '📋';
}

export const ORG_COLORS = {
  'org-alpha': 'text-blue-400',
  'org-beta': 'text-purple-400',
  'org-gamma': 'text-teal-400',
};

export const ORG_BG = {
  'org-alpha': 'bg-blue-500/15 border-blue-500/30',
  'org-beta': 'bg-purple-500/15 border-purple-500/30',
  'org-gamma': 'bg-teal-500/15 border-teal-500/30',
};
