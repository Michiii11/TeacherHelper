export interface UserSettings {
  darkMode: boolean | null;
  language: 'de' | 'en' | null;
  allowInvitations?: boolean | null;
}

export interface User {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  pendingEmail?: string | null;
  subscriptionModel: 'FREE' | 'PRO' | 'ENTERPRISE' | 'ADMIN';
  profileImageUrl?: string | null;
  createdAt?: string | null;
  lastActivityAt?: string | null;
  active?: boolean;
  locked?: boolean;
  settings: UserSettings;
}

export interface UserDTO {
  id: string;
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
  userId: string | null;
  token: string | null;
}



export interface AdminDashboardDTO {
  amountUsers: number;
  activeUsersMonth: number;
  activeUsersWeek: number;
  newUsersMonth: number;
  freeAbos: number;
  proAbos: number;
  schoolAbos: number;
  cashflow: number;
  collections: AdminCountPeriodDTO;
  examples: AdminCountPeriodDTO;
  tests: AdminCountPeriodDTO;
  users: AdminUserDashboardDTO[]
}

export interface AdminUserDashboardDTO {
  id: string;
  username: string;
  createdAt: string;
  lastActive: string;
  collections: number;
  examples: number;
  tests: number;
}

export interface AdminCountPeriodDTO{
  hour: number;
  day: number;
  week: number;
  month: number;
  year: number;
}
