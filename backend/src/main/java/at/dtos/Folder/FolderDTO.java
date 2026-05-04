package at.dtos.Folder;

import java.time.LocalDateTime;
import java.util.UUID;

public record FolderDTO(
        UUID id,
        String name,
        UUID collectionId,
        UUID parentId,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
