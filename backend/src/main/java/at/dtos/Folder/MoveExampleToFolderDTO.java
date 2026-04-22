package at.dtos.Folder;

import java.util.UUID;

public record MoveExampleToFolderDTO(
        String authToken,
        UUID folderId
) {
}