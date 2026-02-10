package at.dtos;

import at.enums.TestCreationStates;
import at.model.Example;
import at.model.TestExample;

import java.util.Set;

public record CreateTestDTO (String authToken, Long schoolId, String name, Set<TestExample> exampleList, int duration, TestCreationStates state) {
}
