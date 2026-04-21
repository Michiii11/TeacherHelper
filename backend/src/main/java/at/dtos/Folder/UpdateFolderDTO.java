package at.dtos.Folder;

public record UpdateFolderDTO(
        String authToken,
        String name,
        Long parentId
) {
}
