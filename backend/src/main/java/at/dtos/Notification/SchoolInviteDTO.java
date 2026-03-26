package at.dtos.Notification;

import at.dtos.School.SchoolDTO;
import at.dtos.User.UserDTO;
import at.enums.SchoolInviteStatus;
import at.enums.SchoolInviteType;

import java.time.LocalDateTime;

public record SchoolInviteDTO(
        Long id,
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