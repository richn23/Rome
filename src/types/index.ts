import { Timestamp } from "firebase/firestore";

export type UserRole = "speaker" | "learner" | "admin";
export type SpeakerStatus = "online" | "busy" | "offline";
export type SessionStatus = "waiting" | "active" | "ended" | "rejected";
export type BookingStatus = "pending" | "admitted" | "rejected" | "cancelled";
export type TopicCategory = "everyday" | "travel" | "work" | "culture";
export type SlotStatus = "available" | "booked" | "cancelled";
export type LevelSignalType = "too_easy" | "just_right" | "too_hard";

export const LEVELS = {
  "1a": "Beginner (lower)",
  "1b": "Beginner (upper)",
  "2a": "Developing (lower)",
  "2b": "Developing (upper)",
  "3a": "Confident (lower)",
  "3b": "Confident (upper)",
  "4a": "Fluent (lower)",
  "4b": "Fluent (upper)",
} as const;

export type LevelCode = keyof typeof LEVELS;

export interface UserProfile {
  uid: string;
  role: UserRole;
  displayName: string;
  email: string;
  photoURL: string;
  level?: LevelCode;
  nativeLanguage?: string;
  learningLanguage?: string;
  bio?: string;
  status?: SpeakerStatus;
  hourlyRate?: number;
  rating?: number;
  totalSessions?: number;
  introVideoURL?: string;
  awayMode?: boolean;
  /** Set true by an admin to lock the user out — RouteGuard bounces to /suspended. */
  suspended?: boolean;
  createdAt: Timestamp;
}

export interface Session {
  sessionId: string;
  speakerId: string;
  learnerIds: string[];
  status: SessionStatus;
  jitsiRoomId: string;
  topicId?: string;
  /** Speaker's private notes captured during the live call. */
  speakerNotes?: string;
  /** Recap / advice written for the learner — shown to them in session history. */
  notesToLearner?: string;
  /** Handoff notes for whoever teaches this learner next. */
  notesToNextSpeaker?: string;
  /** 1-5. 1-2 = slow down, 3 = average, 4 = doing well, 5 = ready for a challenge. */
  challengeRating?: number;
  /** Free-text list of topics covered in the session. Shared with learner + next speaker. */
  topicsDiscussed?: string[];
  scheduledAt?: Timestamp;
  startedAt?: Timestamp;
  endedAt?: Timestamp;
  endedBy?: string;
  durationMinutes?: number;
  amountCharged?: number;
  platformCut?: number;
  speakerPayout?: number;
}

export interface ChatMessage {
  messageId: string;
  senderId: string;
  text: string;
  sentAt: Timestamp;
}

export interface Topic {
  topicId: string;
  title: string;
  category: TopicCategory;
  level: LevelCode;
  promptQuestions: string[];
  vocabularyHints: string[];
  isActive: boolean;
  createdBy: string;
  createdAt: Timestamp;
}

export interface Booking {
  bookingId: string;
  learnerId: string;
  speakerId: string;
  requestedAt: Timestamp;
  status: BookingStatus;
  topicSuggestion?: string;
  sessionId?: string;
  // Scheduled booking fields (null/undefined = instant)
  scheduledFor?: Timestamp | null;
  slotId?: string;
  /** Present when the booking was created by a speaker claiming an open
   *  learner-posted request (marketplace flow #1). */
  requestId?: string;
  // Learner can ask to be pushed up a level for this session
  challengeUp?: boolean;
}

export type RequestStatus = "open" | "claimed" | "cancelled" | "expired";

/**
 * Marketplace flow #1 — a learner posts "I want a session at this time, any
 * speaker." Speakers browse a board of open requests and claim one, which
 * atomically turns the request into an admitted booking.
 *
 * Learner profile fields are denormalized onto the doc so speakers browsing
 * the board don't need to fetch N user docs.
 */
export interface SessionRequest {
  requestId: string;
  learnerId: string;
  // Denormalized learner fields (snapshot at post time)
  learnerName: string;
  learnerPhotoURL?: string;
  learnerLevel?: LevelCode;
  // When the learner wants the session
  requestedFor: Timestamp;
  durationMinutes: SlotDuration;
  // Which language they want to practise
  language: string;
  topic?: string;
  /** Optional max hourly rate — speakers above this see a grey-out hint. */
  budgetMax?: number;
  status: RequestStatus;
  // Populated once a speaker claims
  claimedBySpeakerId?: string;
  claimedAt?: Timestamp;
  bookingId?: string;
  createdAt: Timestamp;
}

export type SlotDuration = 30 | 45;

export interface AvailabilitySlot {
  slotId: string;
  speakerId: string;
  scheduledFor: Timestamp;
  durationMinutes: SlotDuration;
  autoConfirm: boolean;
  status: SlotStatus;
  bookingId?: string | null;
  recurrenceId?: string | null;
  createdAt: Timestamp;
}

export interface RecurrenceRule {
  recurrenceId: string;
  speakerId: string;
  dayOfWeek: number; // 0=Sun, 6=Sat
  hour: number; // 0-23
  minute: number; // 0 or 30
  durationMinutes: SlotDuration;
  autoConfirm: boolean;
  active: boolean;
  createdAt: Timestamp;
}

export interface LevelSignal {
  signalId: string;
  sessionId: string;
  speakerId: string;
  learnerId: string;
  signalType: LevelSignalType;
  atLevel: LevelCode; // learner's level at the time the signal was given
  createdAt: Timestamp;
}

export interface Rating {
  ratingId: string;
  sessionId: string;
  learnerId: string;
  speakerId: string;
  score: number;
  comment?: string;
  createdAt: Timestamp;
}

/**
 * Cross-speaker handoff note. Written when a speaker ends a session and
 * fills out the feedback form; read by whichever speaker picks up this
 * learner next. Lives in its own collection so we don't widen read access
 * on `sessions` (which contains private chat messages).
 */
export interface Handoff {
  handoffId: string;
  learnerId: string;
  speakerId: string;
  speakerName: string;
  sessionId: string;
  notesToNextSpeaker: string;
  topicsDiscussed: string[];
  challengeRating?: number;
  atLevel?: LevelCode;
  createdAt: Timestamp;
}

/**
 * A file resource uploaded by a speaker or admin and shared with all
 * speakers. Stored in Firebase Storage; this document holds the metadata.
 */
export interface Resource {
  resourceId: string;
  title: string;
  description?: string;
  uploaderUid: string;
  uploaderName: string;
  uploaderRole: "speaker" | "admin";
  fileURL: string;
  storagePath: string; // so we can delete from Storage
  fileName: string;
  fileSizeBytes: number;
  contentType: string;
  tags?: string[];
  /** Admin can hide a resource — kept on file but excluded from the speaker library. */
  hidden?: boolean;
  createdAt: Timestamp;
}

/**
 * A policy document (terms, privacy, code of conduct, refund policy, etc.).
 * Slugs are admin-defined. Multiple versions per slug are kept; only one has
 * `isCurrent: true` per slug.
 */
export interface Policy {
  policyId: string;
  slug: string;
  title: string;
  fileURL: string;
  storagePath: string;
  fileName: string;
  version: string;
  effectiveDate: Timestamp;
  uploadedBy: string;
  uploadedAt: Timestamp;
  isCurrent: boolean;
}

export type GuidanceAudience = "speaker" | "learner";

/**
 * A guidance article shown to either speakers or learners (rules, FAQs,
 * how-to pieces). Body is markdown-ish plain text with blank lines for
 * paragraphs. Admin can edit title and body in-app.
 */
export interface GuidanceDoc {
  docId: string;
  audience: GuidanceAudience;
  slug: string;
  title: string;
  summary: string;
  body: string;
  order: number;
  updatedAt: Timestamp;
  updatedBy?: string;
}
