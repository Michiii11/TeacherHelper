package at.dtos.Folder;

import java.util.UUID;

public record MoveToFolderDTO(
        String authToken,
        UUID folderId
) {
}