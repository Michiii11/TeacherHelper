package at.dtos.Folder;

import java.util.UUID;

public record MoveTestToFolderDTO(
        String authToken,
        UUID folderId
) {
}