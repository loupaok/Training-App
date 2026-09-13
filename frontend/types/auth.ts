export type UserRole = "admin" | "coach" | "moderator" | "client";

export interface AuthUser {
  id: number;
  email: string;
  fullName?: string;
  role: UserRole;
  status?: "pending_payment" | "active" | "expired" | string;
  onboardingCompleted?: boolean;
  profilePhoto?: string;
  profileTitle?: string;
  redirectTo?: string;
  [key: string]: unknown;
}

export interface AuthResult {
  success: boolean;
  redirectTo?: string;
  message?: string;
}
