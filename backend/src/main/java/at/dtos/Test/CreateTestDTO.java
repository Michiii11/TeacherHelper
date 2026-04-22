package at.dtos.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record CreateTestDTO(
        String authToken,
        Long schoolId,
        String name,
        String note,
        List<TestExampleDTO> exampleList,
        int duration,
        Integer defaultTaskSpacing,
        Map<UUID, Integer> taskSpacingMap,
        String gradingMode,
        String gradingSystemName,
        List<GradingLevelDTO> gradingSchema,
        Map<Integer, Integer> gradePercentages,
        Map<Integer, Integer> manualGradeMinimums,
        Long folderId
) {
}
