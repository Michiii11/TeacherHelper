package at.dtos.User;

public record UpdateUserSettingsDTO(
        String authToken,
        UserSettingsDTO settings
) {
}