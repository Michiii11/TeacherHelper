package at.dtos.User;

public record ResetPasswordDTO(String token, String newPassword) {
}