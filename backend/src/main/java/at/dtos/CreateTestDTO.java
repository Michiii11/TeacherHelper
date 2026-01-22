package at.dtos;

import at.enums.TestCreationStates;
import at.model.Example;

import java.util.Set;

public record CreateTestDTO (String authToken, Long schoolId, String name, Set<Example> exampleList, int duration, TestCreationStates state) {
}
