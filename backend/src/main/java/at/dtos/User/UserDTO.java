package at.dtos.User;

import java.util.UUID;

public record UserDTO(UUID id, String username, String profileImageUrl) {
}
