import { Role, AuthProvider } from './auth';

export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  authProvider?: AuthProvider | 'QUICK_BITE_SSO' | string;
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface AdminCreateUserRequest {
  username: string;
  email: string;
  fullName: string;
  password: string;
  role: UserRole;
}

export interface AdminUpdateProfileRequest {
  fullName: string;
  email?: string;
  username?: string;
}

export interface AdminResetPasswordRequest {
  newPassword: string;
}

export interface UpdateUserRoleRequest {
  role: UserRole;
}

import type { PageResponse, QuestionType, ExamStatus } from './exam';

export interface UserFilterParams {
  role?: UserRole;
  isActive?: boolean;
  search?: string;
  page?: number;
  size?: number;
  sort?: string;
}

export interface AdminModerationOption {
  id: string;
  orderIndex: number;
  content: string | null;
  imageUrl: string | null;
  imagePublicId: string | null;
  isCorrect: boolean;
}

export interface AdminModerationQuestion {
  id: string;
  orderIndex: number;
  content: string | null;
  imageUrl: string | null;
  imagePublicId: string | null;
  questionType: QuestionType;
  points: number;
  sampleAnswer?: string | null;
  numericTolerance?: number | null;
  gradingRubric?: string | null;
  isSafe: boolean;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  reviewedByName?: string | null;
  hasImage: boolean;
  exam: {
    id: string;
    title: string;
    accessCode: string;
    status: ExamStatus;
  } | null;
  teacher: {
    id: string;
    fullName: string;
    email: string;
    username: string;
  } | null;
  options: AdminModerationOption[];
  attemptsCount: number;
}

export interface AdminModerationStats {
  totalQuestions: number;
  questionsWithImages: number;
  unreviewedQuestions: number;
  safeQuestions: number;
}

export interface ModerationFilterParams {
  isSafe?: boolean;
  hasImage?: boolean;
  questionType?: QuestionType;
  search?: string;
  page?: number;
  size?: number;
  sort?: string;
}

export interface AiModerationJobStatusResponse {
  running: boolean;
  processedCount: number;
  safeCount: number;
  unsafeCount: number;
  lastProcessedId: string | null;
  message: string;
}

