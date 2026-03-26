package at.dtos.Notification;

public record RespondSchoolInviteDTO(
        String authToken,
        boolean accept
) {
}