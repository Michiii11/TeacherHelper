package at.dtos.Example;

public record ExampleFolderDTO(
        String id,
        String name,
        String schoolId,
        String parentId,
        String createdAt,
        String updatedAt
) {
}