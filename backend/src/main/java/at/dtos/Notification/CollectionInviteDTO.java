package at.dtos.Notification;

import at.dtos.Collection.CollectionDTO;
import at.dtos.User.UserDTO;
import at.enums.InviteStatus;
import at.enums.InviteType;

import java.time.LocalDateTime;
import java.util.UUID;

public record CollectionInviteDTO(
        UUID id,
        CollectionDTO collection,
        UserDTO sender,
        UserDTO recipient,
        InviteType type,
        InviteStatus status,
        String message,
        LocalDateTime createdAt,
        LocalDateTime decidedAt
) {
}