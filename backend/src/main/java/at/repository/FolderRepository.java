package at.repository;

import at.dtos.Folder.CreateFolderDTO;
import at.dtos.Folder.FolderDTO;
import at.model.School;
import at.model.Folder;
import at.model.User;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;

import java.util.UUID;
import java.util.stream.Collectors;

@ApplicationScoped
@Transactional
public class FolderRepository {

    @Inject
    EntityManager em;

    public Response getFolders(UUID collectionId, UUID userId) {
        School collection = em.find(School.class, collectionId);
        if (collection == null || !isSchoolMember(collection, userId)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }

        return Response.ok(em.createQuery(
                        "SELECT f FROM Folder f WHERE f.school.id = :collectionId ORDER BY f.name ASC",
                        Folder.class
                )
                .setParameter("collectionId", collectionId)
                .getResultList()
                .stream()
                .map(Folder::toDto)
                .collect(Collectors.toList())).build();
    }

    public Response createFolder(UUID collectionId, UUID userId, CreateFolderDTO dto) {
        School collection = em.find(School.class, collectionId);
        if (collection == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Schule nicht gefunden.").build();
        }

        if (!isSchoolMember(collection, userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("Nicht berechtigt.").build();
        }

        String name = dto.name() == null ? "" : dto.name().trim();
        if (name.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Name darf nicht leer sein.").build();
        }

        Folder parent = null;
        if (dto.parentId() != null) {
            parent = em.find(Folder.class, dto.parentId());
            if (parent == null || !parent.getSchool().getId().equals(collectionId)) {
                return Response.status(Response.Status.BAD_REQUEST).entity("Ungültiger Parent-Ordner.").build();
            }
        }

        Folder folder = new Folder(name, collection, parent);
        em.persist(folder);
        em.flush();

        return Response.ok(folder.toDto()).build();
    }

    public Response updateFolder(UUID folderId, UUID userId, CreateFolderDTO dto) {
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

        return Response.ok(folder.toDto()).build();
    }

    public Response deleteFolder(UUID folderId, UUID userId) {
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

    public Folder findById(UUID folderId) {
        return em.find(Folder.class, folderId);
    }

    private boolean isDescendant(Folder candidateParent, UUID folderId) {
        Folder current = candidateParent;

        while (current != null) {
            if (current.getId().equals(folderId)) {
                return true;
            }
            current = current.getParent();
        }

        return false;
    }

    private boolean isSchoolMember(School school, UUID userId) {
        if (school.getAdmin() != null && school.getAdmin().getId().equals(userId)) {
            return true;
        }

        return school.getUsers()
                .stream()
                .map(User::getId)
                .anyMatch(id -> id.equals(userId));
    }
}
