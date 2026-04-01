export interface UserSettings {
  darkMode: boolean | null;
  language: 'de' | 'en' | null;
  allowInvitations: boolean;
}

export interface User {
  id: number;
  username: string;
  email: string;
  emailVerified: boolean;
  pendingEmail?: string | null;
  subscriptionModel: 'FREE' | 'PRO' | 'ENTERPRISE' | 'ADMIN';
  profileImageUrl?: string | null;
  settings: UserSettings;
}

export interface UserDTO {
  id: number;
  username: string;
  email: string;
  password: string;
  profileImageUrl: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  code: string;
  message: string;
  userId: number;
  token: string;
}
