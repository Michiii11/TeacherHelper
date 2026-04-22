package at.dtos.User;

public record FullUserDTO(
        String username,
        String email,
        String password,
        String language,
        Boolean darkMode
) {}