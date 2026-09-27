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

  revenueTotalCents: number;
  revenueMonthCents: number;
  successfulPayments: number;
  failedPayments: number;
  schoolSeatsTotal: number;

  collections: AdminCountPeriodDTO;
  examples: AdminCountPeriodDTO;
  tests: AdminCountPeriodDTO;
  users: AdminUserDashboardDTO[];
}

export interface AdminUserDashboardDTO {
  id: string;
  username: string;
  profileImageUrl: string | null;
  createdAt: string;
  lastActive: string;

  collections: number;
  examples: number;
  tests: number;

  subscriptionModel: 'FREE' | 'PRO' | 'SCHOOL' | 'ADMIN';
  subscriptionStatus: 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'INCOMPLETE';
  subscriptionSource: 'FREE' | 'STRIPE' | 'ADMIN';

  subscriptionSeats: number | null;
  subscriptionValidUntil: string | null;
  subscriptionPeriodStart: string | null;
  subscriptionPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;

  locked: boolean;

  paymentCount: number;
  totalPaidCents: number;
}

export interface AdminCountPeriodDTO{
  hour: number;
  day: number;
  week: number;
  month: number;
  year: number;
}
