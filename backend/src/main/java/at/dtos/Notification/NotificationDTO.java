package at.dtos.Notification;

import at.dtos.Collection.CollectionDTO;
import at.dtos.User.UserDTO;
import at.enums.NotificationActionType;
import at.enums.NotificationType;

import java.time.LocalDateTime;
import java.util.UUID;

public record NotificationDTO(
        UUID id,
        UserDTO actor,
        CollectionDTO collection,
        NotificationType type,
        String title,
        String message,
        String link,
        boolean read,
        UUID relatedEntityId,
        NotificationActionType primaryAction,
        NotificationActionType secondaryAction,
        LocalDateTime createdAt
) {
}