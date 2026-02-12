package at.dtos;

import at.enums.TestCreationStates;
import at.model.Example;
import at.model.TestExample;

import java.util.List;
import java.util.Set;

public record CreateTestDTO (String authToken, Long schoolId, String name, String note, List<TestExampleDTO> exampleList, int duration, TestCreationStates state) {
}
