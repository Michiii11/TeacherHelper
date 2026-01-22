package at.dtos;

import at.enums.TestCreationStates;

public record TestOverviewDTO(Long id, String name, int amountOfQuestions, int duration, TestCreationStates state, String adminUsername, Long adminId) {
}
