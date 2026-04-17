package at.dtos.Example;

import at.enums.ExampleTypes;
import at.model.helper.Focus;

import java.sql.Timestamp;
import java.util.List;

public record ExampleOverviewDTO(
        Long id,
        ExampleTypes type,
        String instruction,
        String question,
        String adminUsername,
        Long adminId,
        List<Focus> focusList,
        String folderId,
        Timestamp createdAt,
        Timestamp updatedAt
) {
}