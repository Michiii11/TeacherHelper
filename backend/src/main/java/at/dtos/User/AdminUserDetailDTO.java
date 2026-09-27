package at.dtos.User;

import at.dtos.Collection.CollectionDTO;
import at.enums.PaymentStatus;
import at.enums.SubscriptionModel;
import at.enums.SubscriptionSource;
import at.enums.SubscriptionStatus;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record AdminUserDetailDTO(
        UUID id,
        String username,
        String email,
        LocalDateTime createdAt,
        LocalDateTime lastActive,

        SubscriptionModel subscriptionModel,
        SubscriptionStatus subscriptionStatus,
        SubscriptionSource subscriptionSource,
        Integer subscriptionSeats,
        LocalDateTime subscriptionValidUntil,
        LocalDateTime subscriptionPeriodStart,
        LocalDateTime subscriptionPeriodEnd,
        Boolean cancelAtPeriodEnd,

        boolean locked,

        long paymentCount,
        long totalPaidCents,
        List<PaymentDTO> payments,

        List<CollectionDTO> collections
) {
    public record PaymentDTO(
            UUID id,
            String stripeInvoiceId,
            long amountCents,
            String currency,
            PaymentStatus status,
            String invoiceUrl,
            String invoicePdfUrl,
            LocalDateTime paidAt,
            LocalDateTime createdAt
    ) {
    }
}
