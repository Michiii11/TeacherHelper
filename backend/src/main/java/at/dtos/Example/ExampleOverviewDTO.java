package at.dtos.Example;

import at.enums.ExampleTypes;
import at.model.helper.Focus;

import java.sql.Timestamp;
import java.util.List;
import java.util.UUID;

public record ExampleOverviewDTO(
        UUID id,
        ExampleTypes type,
        String instruction,
        String question,
        String adminUsername,
        UUID adminId,
        List<Focus> focusList,
        Long folderId,
        Timestamp createdAt,
        Timestamp updatedAt
) {
}