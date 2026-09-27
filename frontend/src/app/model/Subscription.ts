export type SubscriptionPlan = 'FREE' | 'PRO' | 'SCHOOL' | 'ADMIN';
export type PaidSubscriptionPlan = Extract<SubscriptionPlan, 'PRO' | 'SCHOOL'>;
export type SubscriptionStatus = 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'INCOMPLETE';
export type SubscriptionSource = 'FREE' | 'STRIPE' | 'ADMIN';

export interface SubscriptionUsageDTO {
  collections: number;
  examples: number;
  tests: number;
  schoolUsers: number;
  maxCollectionMembers: number;
}

export interface SubscriptionLimitsDTO {
  collections: number | null;
  membersPerCollection: number | null;
  examples: number | null;
  tests: number | null;
  schoolUsers: number | null;
}

export interface SubscriptionDTO {
  plan: SubscriptionPlan;
  status: SubscriptionStatus | null;
  source: SubscriptionSource | null;
  seats: number | null;
  cancelAtPeriodEnd: boolean;
  periodStart: string | null;
  periodEnd: string | null;
  usage: SubscriptionUsageDTO;
  limits: SubscriptionLimitsDTO;
}

export interface SubscriptionCheckoutDTO {
  sessionId: string;
  url: string;
}

export interface SubscriptionPlanChangePreviewDTO {
  plan: PaidSubscriptionPlan;
  seats: number;
  currentMonthlyAmountCents: number;
  newMonthlyAmountCents: number;
  monthlyDifferenceCents: number;
  currentPeriodAdjustmentCents: number;
  nextInvoiceAmountCents: number;
  nextBillingAt: number;
  currency: string;
  prorationDate: number;
}

export interface SubscriptionPlanChangeResultDTO {
  plan: PaidSubscriptionPlan;
  seats: number;
  subscriptionId: string;
  subscriptionItemId: string;
}

export interface SubscriptionActionResultDTO {
  subscriptionId: string;
  cancelAtPeriodEnd: boolean;
}

export interface SubscriptionPortalDTO {
  url: string;
}

export interface SubscriptionCheckoutConfirmationDTO {
  confirmed: boolean;
  subscriptionId: string;
}
