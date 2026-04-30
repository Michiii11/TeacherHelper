package at.repository;

import at.dtos.Folder.CreateFolderDTO;
import at.model.Example;
import at.model.School;
import at.model.Folder;
import at.model.Test;
import at.websocket.CollectionSocket;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@ApplicationScoped
@Transactional
public class FolderRepository {

    @Inject
    EntityManager em;

    @Inject
    SchoolRepository collectionRepository;

    public Response getFolders(UUID collectionId, UUID userId) {
        School collection = em.find(School.class, collectionId);
        if (collection == null || !collectionRepository.isUserPartOfCollection(collectionId, userId)) {
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

        if (!collectionRepository.isUserPartOfCollection(collectionId, userId)) {
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
        CollectionSocket.broadcast(folder.getSchool().getId());
        return Response.ok(folder.toDto()).build();
    }

    public Response updateFolder(UUID folderId, UUID userId, CreateFolderDTO dto) {
        Folder folder = em.find(Folder.class, folderId);
        if (folder == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Ordner nicht gefunden.").build();
        }

        if (!collectionRepository.isUserPartOfCollection(folder.getSchool().getId(), userId)) {
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
        CollectionSocket.broadcast(folder.getSchool().getId());
        return Response.ok(folder.toDto()).build();
    }

    public Response deleteFolder(UUID folderId, UUID userId) {
        Folder folder = em.find(Folder.class, folderId);

        if (folder == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("Ordner nicht gefunden.")
                    .build();
        }

        UUID schoolId = folder.getSchool().getId();

        if (!collectionRepository.isUserPartOfCollection(schoolId, userId)) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity("Nicht berechtigt.")
                    .build();
        }

        List<UUID> folderIds = new ArrayList<>();
        collectFolderIds(folderId, folderIds);

        deleteFolderTree(folderIds);

        em.clear();
        CollectionSocket.broadcast(schoolId);

        return Response.ok().build();
    }

    private void collectFolderIds(UUID folderId, List<UUID> folderIds) {
        folderIds.add(folderId);

        List<UUID> childFolderIds = em.createQuery("""
            SELECT f.id
            FROM Folder f
            WHERE f.parent.id = :folderId
            """, UUID.class)
                .setParameter("folderId", folderId)
                .getResultList();

        for (UUID childId : childFolderIds) {
            collectFolderIds(childId, folderIds);
        }
    }

    private void deleteFolderTree(List<UUID> folderIds) {
        List<UUID> testIds = em.createQuery("""
            SELECT t.id
            FROM Test t
            WHERE t.folder.id IN :folderIds
            """, UUID.class)
                .setParameter("folderIds", folderIds)
                .getResultList();

        List<UUID> exampleIds = em.createQuery("""
            SELECT e.id
            FROM Example e
            WHERE e.folder.id IN :folderIds
            """, UUID.class)
                .setParameter("folderIds", folderIds)
                .getResultList();

        List<UUID> testExampleIds = em.createQuery("""
            SELECT te.id
            FROM TestExample te
            WHERE te.test.id IN :testIds
               OR te.example.id IN :exampleIds
            """, UUID.class)
                .setParameter("testIds", testIds.isEmpty() ? List.of(UUID.randomUUID()) : testIds)
                .setParameter("exampleIds", exampleIds.isEmpty() ? List.of(UUID.randomUUID()) : exampleIds)
                .getResultList();

        if (!testExampleIds.isEmpty()) {
            em.createQuery("""
                DELETE FROM TestExampleVariableValue v
                WHERE v.testExample.id IN :testExampleIds
                """)
                    .setParameter("testExampleIds", testExampleIds)
                    .executeUpdate();

            em.createQuery("""
                DELETE FROM TestExample te
                WHERE te.id IN :testExampleIds
                """)
                    .setParameter("testExampleIds", testExampleIds)
                    .executeUpdate();
        }

        if (!testIds.isEmpty()) {
            em.createQuery("""
                DELETE FROM Test t
                WHERE t.id IN :testIds
                """)
                    .setParameter("testIds", testIds)
                    .executeUpdate();
        }

        if (!exampleIds.isEmpty()) {
            em.createQuery("""
                DELETE FROM Example e
                WHERE e.id IN :exampleIds
                """)
                    .setParameter("exampleIds", exampleIds)
                    .executeUpdate();
        }

        List<UUID> reversedFolderIds = new ArrayList<>(folderIds);
        Collections.reverse(reversedFolderIds);

        for (UUID folderId : reversedFolderIds) {
            em.createQuery("""
                DELETE FROM Folder f
                WHERE f.id = :folderId
                """)
                    .setParameter("folderId", folderId)
                    .executeUpdate();
        }

        em.clear();
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
}
