package at.dtos.School;

import at.dtos.User.UserDTO;

import java.util.List;
import java.util.UUID;

public record SchoolDTO(
        UUID id,
        String name,
        String logoUrl,
        UserDTO admin,
        int exampleCount,
        List<UserDTO> members
) {
}