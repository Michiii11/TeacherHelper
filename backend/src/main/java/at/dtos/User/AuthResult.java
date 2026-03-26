package at.dtos.User;

public record AuthResult(boolean success, String code, String message, String token, Long userId) {
    public static AuthResult success(Long userId, String token) {
        return new AuthResult(true, "OK", "Operation successful", token, userId);
    }

    public static AuthResult failure(String code, String message) {
        return new AuthResult(false, code, message, null, null);
    }
}
