package at.repository;

import at.dtos.Example.CreateExampleFolderDTO;
import at.dtos.Example.ExampleFolderDTO;
import at.dtos.Example.UpdateExampleFolderDTO;
import at.model.Example;
import at.model.ExampleFolder;
import at.model.School;
import at.model.User;
import at.security.TokenService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;

import java.util.List;
import java.util.stream.Collectors;

@ApplicationScoped
public class ExampleFolderRepository {

    @Inject
    EntityManager em;

    @Inject
    TokenService tokenService;

    public List<ExampleFolderDTO> getFolders(Long schoolId, String authToken) {
        Long userId = tokenService.validateTokenAndGetUserId(authToken);
        if (userId == null) {
            return List.of();
        }

        School school = em.find(School.class, schoolId);
        if (school == null || !isSchoolMember(school, userId)) {
            return List.of();
        }

        return em.createQuery(
                        "SELECT f FROM ExampleFolder f WHERE f.school.id = :schoolId ORDER BY f.name ASC",
                        ExampleFolder.class
                )
                .setParameter("schoolId", schoolId)
                .getResultList()
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public Response createFolder(Long schoolId, CreateExampleFolderDTO dto) {
        Long userId = tokenService.validateTokenAndGetUserId(dto.authToken());
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).build();
        }

        School school = em.find(School.class, schoolId);
        if (school == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Schule nicht gefunden.").build();
        }

        if (!isSchoolMember(school, userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("Nicht berechtigt.").build();
        }

        String name = dto.name() == null ? "" : dto.name().trim();
        if (name.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Name darf nicht leer sein.").build();
        }

        ExampleFolder parent = null;
        if (dto.parentId() != null && !dto.parentId().isBlank()) {
            parent = em.find(ExampleFolder.class, dto.parentId());
            if (parent == null || !parent.getSchool().getId().equals(schoolId)) {
                return Response.status(Response.Status.BAD_REQUEST).entity("Ungültiger Parent-Ordner.").build();
            }
        }

        ExampleFolder folder = new ExampleFolder(name, school, parent);
        em.persist(folder);
        em.flush();

        return Response.ok(toDto(folder)).build();
    }

    @Transactional
    public Response updateFolder(String folderId, UpdateExampleFolderDTO dto) {
        Long userId = tokenService.validateTokenAndGetUserId(dto.authToken());
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).build();
        }

        ExampleFolder folder = em.find(ExampleFolder.class, folderId);
        if (folder == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Ordner nicht gefunden.").build();
        }

        if (!isSchoolMember(folder.getSchool(), userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("Nicht berechtigt.").build();
        }

        String name = dto.name() == null ? "" : dto.name().trim();
        if (name.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Name darf nicht leer sein.").build();
        }

        ExampleFolder newParent = null;
        if (dto.parentId() != null && !dto.parentId().isBlank()) {
            newParent = em.find(ExampleFolder.class, dto.parentId());

            if (newParent == null || !newParent.getSchool().getId().equals(folder.getSchool().getId())) {
                return Response.status(Response.Status.BAD_REQUEST).entity("Ungültiger Parent-Ordner.").build();
            }

            if (newParent.getId().equals(folder.getId())) {
                return Response.status(Response.Status.BAD_REQUEST)
                        .entity("Ein Ordner kann nicht in sich selbst verschoben werden.")
                        .build();
            }

            if (isDescendant(newParent, folder.getId())) {
                return Response.status(Response.Status.BAD_REQUEST)
                        .entity("Ein Ordner kann nicht in einen eigenen Unterordner verschoben werden.")
                        .build();
            }
        }

        folder.setName(name);
        folder.setParent(newParent);

        em.merge(folder);
        em.flush();

        return Response.ok(toDto(folder)).build();
    }

    @Transactional
    public Response deleteFolder(String folderId, String authToken) {
        Long userId = tokenService.validateTokenAndGetUserId(authToken);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).build();
        }

        ExampleFolder folder = em.find(ExampleFolder.class, folderId);
        if (folder == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Ordner nicht gefunden.").build();
        }

        if (!isSchoolMember(folder.getSchool(), userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("Nicht berechtigt.").build();
        }

        Long childCount = em.createQuery(
                        "SELECT COUNT(f) FROM ExampleFolder f WHERE f.parent.id = :folderId",
                        Long.class
                )
                .setParameter("folderId", folderId)
                .getSingleResult();

        Long itemCount = em.createQuery(
                        "SELECT COUNT(e) FROM Example e WHERE e.folder.id = :folderId",
                        Long.class
                )
                .setParameter("folderId", folderId)
                .getSingleResult();

        if (childCount > 0 || itemCount > 0) {
            return Response.status(Response.Status.CONFLICT)
                    .entity("Der Ordner ist nicht leer.")
                    .build();
        }

        em.remove(folder);
        return Response.ok().build();
    }

    public ExampleFolder findById(String folderId) {
        return em.find(ExampleFolder.class, folderId);
    }

    public ExampleFolderDTO toDto(ExampleFolder folder) {
        return new ExampleFolderDTO(
                folder.getId(),
                folder.getName(),
                String.valueOf(folder.getSchool().getId()),
                folder.getParent() != null ? folder.getParent().getId() : null,
                folder.getCreatedAt().toString(),
                folder.getUpdatedAt().toString()
        );
    }

    private boolean isDescendant(ExampleFolder candidateParent, String folderId) {
        ExampleFolder current = candidateParent;

        while (current != null) {
            if (current.getId().equals(folderId)) {
                return true;
            }
            current = current.getParent();
        }

        return false;
    }

    private boolean isSchoolMember(School school, Long userId) {
        if (school.getAdmin() != null && school.getAdmin().getId().equals(userId)) {
            return true;
        }

        return school.getUsers()
                .stream()
                .map(User::getId)
                .anyMatch(id -> id.equals(userId));
    }
}