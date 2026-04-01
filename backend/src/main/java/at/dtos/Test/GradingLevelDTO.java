package at.dtos.Test;

public record GradingLevelDTO(
        String key,
        String label,
        String shortLabel,
        Integer order,
        Integer percentageFrom,
        Integer minimumPoints
) {
}
