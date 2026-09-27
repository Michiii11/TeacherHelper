export type PaymentStatus = 'PAID' | 'FAILED' | 'REFUNDED';

export interface PaymentRecordDTO {
  id: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  invoiceUrl: string | null;
  invoicePdfUrl: string | null;
  paidAt: string | null;
  createdAt: string;
}
