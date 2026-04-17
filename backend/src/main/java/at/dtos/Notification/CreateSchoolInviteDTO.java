package at.dtos.Notification;

public record CreateSchoolInviteDTO(
        String authToken,
        String email
) {
}