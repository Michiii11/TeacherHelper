package at.dtos.User;

import at.enums.SubscriptionModel;

public record UserProfileDTO(
        Long id,
        String username,
        String email,
        boolean emailVerified,
        String pendingEmail,
        SubscriptionModel subscriptionModel,
        String profileImageUrl,
        UserSettingsDTO settings
) {}