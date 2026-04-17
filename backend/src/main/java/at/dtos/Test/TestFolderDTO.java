package at.dtos.Test;

public record TestFolderDTO(
        String id,
        String name,
        String schoolId,
        String parentId,
        String createdAt,
        String updatedAt
) {
}