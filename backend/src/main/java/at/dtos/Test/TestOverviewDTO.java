package at.dtos.Test;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.UUID;

public record TestOverviewDTO(UUID id, String name, int amountOfQuestions, int duration, String adminUsername, UUID adminId, LocalDateTime createdAt, LocalDateTime updatedAt, UUID folderId) {
}
