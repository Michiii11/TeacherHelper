package at.dtos.Notification;

import at.dtos.School.SchoolDTO;
import at.dtos.User.UserDTO;
import at.enums.SchoolInviteStatus;
import at.enums.SchoolInviteType;

import java.time.LocalDateTime;
import java.util.UUID;

public record SchoolInviteDTO(
        UUID id,
        SchoolDTO school,
        UserDTO sender,
        UserDTO recipient,
        SchoolInviteType type,
        SchoolInviteStatus status,
        String message,
        LocalDateTime createdAt,
        LocalDateTime decidedAt
) {
}