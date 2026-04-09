package at.dtos.Test;

public record CreateTestFolderDTO(
        String authToken,
        String name,
        String parentId
) {
}