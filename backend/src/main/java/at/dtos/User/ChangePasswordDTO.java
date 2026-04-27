package at.dtos.User;

public record ChangePasswordDTO(String currentPassword, String newPassword) {
}