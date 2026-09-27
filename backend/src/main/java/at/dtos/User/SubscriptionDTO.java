package at.dtos.User;

import at.enums.SubscriptionModel;
import at.enums.SubscriptionSource;
import at.enums.SubscriptionStatus;

import java.time.LocalDateTime;

public record SubscriptionDTO(
        SubscriptionModel plan,
        SubscriptionStatus status,
        SubscriptionSource source,
        Integer seats,
        Boolean cancelAtPeriodEnd,
        LocalDateTime periodStart,
        LocalDateTime periodEnd,
        UsageDTO usage,
        LimitsDTO limits
) {
    public record UsageDTO(
            long collections,
            long examples,
            long tests,
            long schoolUsers,
            int maxCollectionMembers
    ) {}

    public record LimitsDTO(
            Integer collections,
            Integer membersPerCollection,
            Integer examples,
            Integer tests,
            Integer schoolUsers
    ) {}
}
