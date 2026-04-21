package at.dtos.Folder;

public record FolderDTO(
        Long id,
        String name,
        Long schoolId,
        Long parentId,
        String createdAt,
        String updatedAt
) {
}
