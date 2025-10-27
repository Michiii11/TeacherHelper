package at.dtos;

import at.model.User;

public record SchoolDTO(Long id, String name, UserDTO admin) {
}
