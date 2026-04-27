package at.dtos.User;

public record AdminCountPeriodDTO(
        long hour,
        long day,
        long week,
        long month,
        long year
) {
}