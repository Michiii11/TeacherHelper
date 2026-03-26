package at.dtos.Notification;

import at.dtos.School.SchoolDTO;
import at.dtos.User.UserDTO;
import at.enums.NotificationActionType;
import at.enums.NotificationType;

import java.time.LocalDateTime;

public record NotificationDTO(
        Long id,
        UserDTO actor,
        SchoolDTO school,
        NotificationType type,
        String title,
        String message,
        String link,
        boolean read,
        boolean archived,
        Long relatedEntityId,
        NotificationActionType primaryAction,
        NotificationActionType secondaryAction,
        LocalDateTime createdAt
) {
}