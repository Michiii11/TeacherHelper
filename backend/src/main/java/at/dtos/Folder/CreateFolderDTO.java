package at.dtos.Folder;

public record CreateFolderDTO(
        String authToken,
        String name,
        Long parentId
) {
}
