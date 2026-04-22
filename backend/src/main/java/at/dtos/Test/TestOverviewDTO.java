package at.dtos.Test;

import java.sql.Timestamp;
import java.util.UUID;

public record TestOverviewDTO(UUID id, String name, int amountOfQuestions, int duration, String adminUsername, UUID adminId, Timestamp createdAt, Timestamp updatedAt, UUID folderId) {
}
