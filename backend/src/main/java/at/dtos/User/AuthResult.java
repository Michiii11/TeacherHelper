package at.dtos.User;

import java.util.UUID;

public record AuthResult(boolean success, String code, String message, String token, UUID userId) {
    public static AuthResult success(UUID userId, String token) {
        return new AuthResult(true, "OK", "Operation successful", token, userId);
    }

    public static AuthResult failure(String code, String message) {
        return new AuthResult(false, code, message, null, null);
    }
}
