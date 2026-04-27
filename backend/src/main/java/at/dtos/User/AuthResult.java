package at.dtos.User;

import java.util.UUID;

public record AuthResult(boolean success, String code, String message, String token, UUID userId) {

    public static AuthResult success(UUID userId, String token) {
        return new AuthResult(true, "AUTH_SUCCESS", null, token, userId);
    }

    public static AuthResult failure(String code) {
        return new AuthResult(false, code, null, null, null);
    }

    public static AuthResult info(String code) {
        return new AuthResult(true, code, null, null, null);
    }
}