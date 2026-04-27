package at.dtos.Folder;

import java.util.UUID;

public record CreateFolderDTO(
        String name,
        UUID parentId
) {
}
