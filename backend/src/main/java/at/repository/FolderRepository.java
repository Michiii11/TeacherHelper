package at.repository;

import at.dtos.Folder.CreateFolderDTO;
import at.dtos.Folder.FolderDTO;
import at.dtos.Folder.UpdateFolderDTO;
import at.model.Folder;
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
public class FolderRepository {

    @Inject
    EntityManager em;

    @Inject
    TokenService tokenService;

    public List<FolderDTO> getFolders(Long schoolId, String authToken) {
        Long userId = tokenService.validateTokenAndGetUserId(authToken);
        if (userId == null) {
            return List.of();
        }

        School school = em.find(School.class, schoolId);
        if (school == null || !isSchoolMember(school, userId)) {
            return List.of();
        }

        return em.createQuery(
                        "SELECT f FROM Folder f WHERE f.school.id = :schoolId ORDER BY f.name ASC",
                        Folder.class
                )
                .setParameter("schoolId", schoolId)
                .getResultList()
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public Response createFolder(Long schoolId, CreateFolderDTO dto) {
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

        Folder parent = null;
        if (dto.parentId() != null) {
            parent = em.find(Folder.class, dto.parentId());
            if (parent == null || !parent.getSchool().getId().equals(schoolId)) {
                return Response.status(Response.Status.BAD_REQUEST).entity("Ungültiger Parent-Ordner.").build();
            }
        }

        Folder folder = new Folder(name, school, parent);
        em.persist(folder);
        em.flush();

        return Response.ok(toDto(folder)).build();
    }

    @Transactional
    public Response updateFolder(Long folderId, UpdateFolderDTO dto) {
        Long userId = tokenService.validateTokenAndGetUserId(dto.authToken());
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).build();
        }

        Folder folder = em.find(Folder.class, folderId);
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

        Folder newParent = null;
        if (dto.parentId() != null) {
            newParent = em.find(Folder.class, dto.parentId());

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
    public Response deleteFolder(Long folderId, String authToken) {
        Long userId = tokenService.validateTokenAndGetUserId(authToken);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).build();
        }

        Folder folder = em.find(Folder.class, folderId);
        if (folder == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Ordner nicht gefunden.").build();
        }

        if (!isSchoolMember(folder.getSchool(), userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("Nicht berechtigt.").build();
        }

        Long childCount = em.createQuery(
                        "SELECT COUNT(f) FROM Folder f WHERE f.parent.id = :folderId",
                        Long.class
                )
                .setParameter("folderId", folderId)
                .getSingleResult();

        Long exampleCount = em.createQuery(
                        "SELECT COUNT(e) FROM Example e WHERE e.folder.id = :folderId",
                        Long.class
                )
                .setParameter("folderId", folderId)
                .getSingleResult();

        Long testCount = em.createQuery(
                        "SELECT COUNT(t) FROM Test t WHERE t.folder.id = :folderId",
                        Long.class
                )
                .setParameter("folderId", folderId)
                .getSingleResult();

        if (childCount > 0 || exampleCount > 0 || testCount > 0) {
            return Response.status(Response.Status.CONFLICT)
                    .entity("Der Ordner ist nicht leer.")
                    .build();
        }

        em.remove(folder);
        return Response.ok().build();
    }

    public Folder findById(Long folderId) {
        return em.find(Folder.class, folderId);
    }

    public FolderDTO toDto(Folder folder) {
        return new FolderDTO(
                folder.getId(),
                folder.getName(),
                folder.getSchool().getId(),
                folder.getParent() != null ? folder.getParent().getId() : null,
                folder.getCreatedAt().toString(),
                folder.getUpdatedAt().toString()
        );
    }

    private boolean isDescendant(Folder candidateParent, Long folderId) {
        Folder current = candidateParent;

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
