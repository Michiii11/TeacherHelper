package at.dtos.Folder;

import java.util.UUID;

public record UpdateFolderDTO(
        String authToken,
        String name,
        UUID parentId
) {
}
