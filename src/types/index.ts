import { Timestamp } from "firebase/firestore";

export type UserRole = "speaker" | "learner" | "admin";
export type SpeakerStatus = "online" | "busy" | "offline";
export type SessionStatus = "waiting" | "active" | "ended" | "rejected";
export type BookingStatus = "pending" | "admitted" | "rejected";
export type TopicCategory = "everyday" | "travel" | "work" | "culture";
export type SlotStatus = "available" | "booked" | "cancelled";

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
  bio?: string;
  status?: SpeakerStatus;
  hourlyRate?: number;
  rating?: number;
  totalSessions?: number;
  introVideoURL?: string;
  createdAt: Timestamp;
}

export interface Session {
  sessionId: string;
  speakerId: string;
  learnerIds: string[];
  status: SessionStatus;
  jitsiRoomId: string;
  topicId?: string;
  speakerNotes?: string;
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
}

export interface AvailabilitySlot {
  slotId: string;
  speakerId: string;
  scheduledFor: Timestamp;
  durationMinutes: number; // always 30 for MVP
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
  autoConfirm: boolean;
  active: boolean;
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
