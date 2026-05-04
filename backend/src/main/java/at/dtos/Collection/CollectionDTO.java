package at.dtos.Collection;

import at.dtos.User.UserDTO;

import java.util.List;
import java.util.UUID;

public record CollectionDTO(
        UUID id,
        String name,
        String logoUrl,
        UserDTO admin,
        int exampleCount,
        List<UserDTO> members
) {
}