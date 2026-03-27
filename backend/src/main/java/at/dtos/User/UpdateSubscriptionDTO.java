package at.dtos.User;

import at.enums.SubscriptionModel;

public record UpdateSubscriptionDTO(String authToken, SubscriptionModel subscriptionModel) {
}