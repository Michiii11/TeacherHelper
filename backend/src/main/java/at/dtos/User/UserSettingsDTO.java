package at.dtos.User;

public record UserSettingsDTO(
        Boolean darkMode,
        String language,
        Boolean allowInvitations
) {
}