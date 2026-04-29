export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  subscriptionModel: 'FREE' | 'PRO' | 'SCHOOL' | 'ADMIN';
  profileImageUrl: string | null;
  emailVerified: boolean;
  pendingEmail: string | null;
  darkMode: boolean;
  language: string;
  createdAt: string;
  lastActivityAt: string;
  locked: boolean;
  settings: UserSettings;
}

export interface UserDTO {
  id: string;
  username: string;
  profileImageUrl: string;
}

export interface LoginDTO {
  email: string;
  password: string;
  language: string;
  darkMode: boolean;
}

export interface AuthResult {
  success: boolean;
  code: string;
  message: string;
  userId: string;
  token: string;
}

export interface UserSettings {
  darkMode: boolean;
  language: 'de' | 'en';
  allowInvitations: boolean;
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
