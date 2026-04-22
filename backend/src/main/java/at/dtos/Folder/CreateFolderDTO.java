package at.dtos.Folder;

import java.util.UUID;

public record CreateFolderDTO(
        String authToken,
        String name,
        UUID parentId
) {
}
