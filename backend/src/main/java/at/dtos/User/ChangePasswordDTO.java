package at.dtos.User;

public record ChangePasswordDTO(String authToken, String currentPassword, String newPassword) {
}