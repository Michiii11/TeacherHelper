package at.dtos.Test;

import java.sql.Timestamp;
import java.util.UUID;

public record TestOverviewDTO(Long id, String name, int amountOfQuestions, int duration, String adminUsername, UUID adminId, Timestamp createdAt, Timestamp updatedAt, Long folderId) {
}
