package at.dtos;

import at.enums.ExampleDifficulty;
import at.enums.ExampleTypes;
import at.model.helper.Focus;

import java.util.List;
import java.util.Set;

public record ExampleOverviewDTO(Long id, ExampleTypes type, String instruction, String question, ExampleDifficulty difficulty, String adminUsername, Long adminId, Set<Focus> focusList) {
}
