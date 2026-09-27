package at.dtos.User;

import at.enums.SubscriptionModel;

import java.time.LocalDateTime;

public record AdminSubscriptionUpdateDTO(
        SubscriptionModel subscriptionModel,
        LocalDateTime validUntil,
        Integer seats
) {
}
