package at.dtos.Test;

public record UpdateTestFolderDTO(
        String authToken,
        String name,
        String parentId
) {
}