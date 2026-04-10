package at.dtos.Example;

public record UpdateExampleFolderDTO(
        String authToken,
        String name,
        String parentId
) {
}