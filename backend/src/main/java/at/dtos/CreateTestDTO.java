package at.dtos;

import at.enums.TestCreationStates;

import java.util.List;
import java.util.Map;

public record CreateTestDTO(
        String authToken,
        Long schoolId,
        String name,
        String note,
        List<TestExampleDTO> exampleList,
        int duration,
        TestCreationStates state,
        Integer defaultTaskSpacing,
        Map<Integer, Integer> taskSpacingMap,
        String gradingMode,
        Map<Integer, Integer> gradePercentages,
        Map<Integer, Integer> manualGradeMinimums
) {
}
