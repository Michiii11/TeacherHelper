package at.dtos.Example;

public record CreateExampleFolderDTO(
        String authToken,
        String name,
        String parentId
) {
}