package at.dtos.User;

import at.dtos.Collection.CollectionDTO;

import java.util.List;
import java.util.UUID;

public record AdminUserDetailDTO(
        UUID id,
        List<CollectionDTO> collections
) {
}