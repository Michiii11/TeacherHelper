package at.dtos;

import at.enums.ExampleDifficulty;
import at.enums.ExampleTypes;

public record ExampleOverviewDTO(Long id, ExampleTypes type, String instruction, String question, ExampleDifficulty difficulty, String adminUsername) {
}
