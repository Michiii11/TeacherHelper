package at.dtos.School;

import at.dtos.User.UserDTO;

import java.util.List;

public record SchoolDTO(
        Long id,
        String name,
        String logoUrl,
        UserDTO admin,
        int exampleCount,
        List<UserDTO> members
) {
}