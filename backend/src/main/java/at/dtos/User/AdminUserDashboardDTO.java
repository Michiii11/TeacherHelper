package at.dtos.User;

import at.enums.SubscriptionModel;
import at.enums.SubscriptionSource;
import at.enums.SubscriptionStatus;

import java.time.LocalDateTime;
import java.util.UUID;

public record AdminUserDashboardDTO(
        UUID id,
        String username,
        String profileImageUrl,
        LocalDateTime createdAt,
        LocalDateTime lastActive,
        long collections,
        long examples,
        long tests,

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
        long totalPaidCents
) {
}
