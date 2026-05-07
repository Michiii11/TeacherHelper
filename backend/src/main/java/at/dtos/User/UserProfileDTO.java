package at.dtos.User;

import at.enums.SubscriptionModel;

import java.util.UUID;

public record UserProfileDTO(
        UUID id,
        String username,
        String email,
        SubscriptionModel subscriptionModel,
        String profileImageUrl,
        UserSettingsDTO settings
) {}
