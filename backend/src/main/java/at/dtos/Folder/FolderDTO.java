package at.dtos.Folder;

import java.util.UUID;

public record FolderDTO(
        UUID id,
        String name,
        UUID schoolId,
        UUID parentId,
        String createdAt,
        String updatedAt
) {
}
