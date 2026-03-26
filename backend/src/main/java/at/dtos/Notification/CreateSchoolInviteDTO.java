package at.dtos.Notification;

public record CreateSchoolInviteDTO(
        String authToken,
        Integer teacherId,
        String message
) {
}