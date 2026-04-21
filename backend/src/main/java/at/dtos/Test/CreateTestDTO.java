package at.dtos.Test;

import java.util.List;
import java.util.Map;

public record CreateTestDTO(
        String authToken,
        Long schoolId,
        String name,
        String note,
        List<TestExampleDTO> exampleList,
        int duration,
        Integer defaultTaskSpacing,
        Map<Integer, Integer> taskSpacingMap,
        String gradingMode,
        String gradingSystemName,
        List<GradingLevelDTO> gradingSchema,
        Map<Integer, Integer> gradePercentages,
        Map<Integer, Integer> manualGradeMinimums,
        Long folderId
) {
}
