package at.dtos.Test;

import java.sql.Timestamp;

public record TestOverviewDTO(Long id, String name, int amountOfQuestions, int duration, String adminUsername, Long adminId, Timestamp createdAt, Timestamp updatedAt, String folderId) {
}
