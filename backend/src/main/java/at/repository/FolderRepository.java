package at.repository;

import at.dtos.Folder.CreateFolderDTO;
import at.model.Collection;
import at.model.Folder;
import at.websocket.CollectionSocket;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;

import java.util.*;
import java.util.stream.Collectors;

@ApplicationScoped
@Transactional
public class FolderRepository {

    @Inject
    EntityManager em;

    @Inject
    CollectionRepository collectionRepository;

    public Response getFolders(UUID collectionId, UUID userId) {
        Collection collection = em.find(Collection.class, collectionId);
        if (collection == null || !collectionRepository.isUserPartOfCollection(collectionId, userId)) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }

        return Response.ok(em.createQuery(
                        "SELECT f FROM Folder f WHERE f.collection.id = :collectionId ORDER BY f.name ASC",
                        Folder.class
                )
                .setParameter("collectionId", collectionId)
                .getResultList()
                .stream()
                .map(Folder::toDto)
                .collect(Collectors.toList())).build();
    }

    public Response createFolder(UUID collectionId, UUID userId, CreateFolderDTO dto) {
        Collection collection = em.find(Collection.class, collectionId);
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
            if (parent == null || !parent.getCollection().getId().equals(collectionId)) {
                return Response.status(Response.Status.BAD_REQUEST).entity("Ungültiger Parent-Ordner.").build();
            }
        }

        Folder folder = new Folder(name, collection, parent);
        em.persist(folder);
        em.flush();
        CollectionSocket.broadcast(folder.getCollection().getId());
        return Response.ok(folder.toDto()).build();
    }

    public Response updateFolder(UUID folderId, UUID userId, CreateFolderDTO dto) {
        Folder folder = em.find(Folder.class, folderId);
        if (folder == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Ordner nicht gefunden.").build();
        }

        if (!collectionRepository.isUserPartOfCollection(folder.getCollection().getId(), userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("Nicht berechtigt.").build();
        }

        String name = dto.name() == null ? "" : dto.name().trim();
        if (name.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Name darf nicht leer sein.").build();
        }

        Folder newParent = null;
        if (dto.parentId() != null) {
            newParent = em.find(Folder.class, dto.parentId());

            if (newParent == null || !newParent.getCollection().getId().equals(folder.getCollection().getId())) {
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
        CollectionSocket.broadcast(folder.getCollection().getId());
        return Response.ok(folder.toDto()).build();
    }

    public Response deleteFolder(UUID folderId, UUID userId) {
        Folder folder = em.find(Folder.class, folderId);

        if (folder == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("Ordner nicht gefunden.")
                    .build();
        }

        UUID collectionId = folder.getCollection().getId();

        if (!collectionRepository.isUserPartOfCollection(collectionId, userId)) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity("Nicht berechtigt.")
                    .build();
        }

        List<UUID> folderIds = new ArrayList<>();
        collectFolderIds(folderId, folderIds);

        long exampleCount = countExamplesInFolders(folderIds);
        long testCount = countTestsInFolders(folderIds);
        int childFolderCount = Math.max(folderIds.size() - 1, 0);

        deleteFolderTree(folderIds);

        em.clear();
        CollectionSocket.broadcast(collectionId);

        return Response.ok(
                "Ordner wurde gelöscht. Entfernt: " + childFolderCount + " Unterordner, " + exampleCount + " Beispiele, " + testCount + " Tests."
        ).build();
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

        List<UUID> testExampleIds = collectTestExampleIds(testIds, exampleIds);

        if (!testExampleIds.isEmpty()) {
            em.createNativeQuery("""
                DELETE FROM test_example_variable_values
                WHERE test_example_id IN (:testExampleIds)
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
            deleteTestElementCollections(testIds);

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

    private long countExamplesInFolders(List<UUID> folderIds) {
        return em.createQuery("""
            SELECT COUNT(e)
            FROM Example e
            WHERE e.folder.id IN :folderIds
            """, Long.class)
                .setParameter("folderIds", folderIds)
                .getSingleResult();
    }

    private long countTestsInFolders(List<UUID> folderIds) {
        return em.createQuery("""
            SELECT COUNT(t)
            FROM Test t
            WHERE t.folder.id IN :folderIds
            """, Long.class)
                .setParameter("folderIds", folderIds)
                .getSingleResult();
    }

    private List<UUID> collectTestExampleIds(List<UUID> testIds, List<UUID> exampleIds) {
        Set<UUID> ids = new java.util.LinkedHashSet<>();

        if (!testIds.isEmpty()) {
            ids.addAll(em.createQuery("""
                SELECT te.id
                FROM TestExample te
                WHERE te.test.id IN :testIds
                """, UUID.class)
                    .setParameter("testIds", testIds)
                    .getResultList());
        }

        if (!exampleIds.isEmpty()) {
            ids.addAll(em.createQuery("""
                SELECT te.id
                FROM TestExample te
                WHERE te.example.id IN :exampleIds
                """, UUID.class)
                    .setParameter("exampleIds", exampleIds)
                    .getResultList());
        }

        return new ArrayList<>(ids);
    }

    private void deleteTestElementCollections(List<UUID> testIds) {
        em.createNativeQuery("DELETE FROM test_task_spacing WHERE test_id IN (:testIds)")
                .setParameter("testIds", testIds)
                .executeUpdate();

        em.createNativeQuery("DELETE FROM test_grading_levels WHERE test_id IN (:testIds)")
                .setParameter("testIds", testIds)
                .executeUpdate();

        em.createNativeQuery("DELETE FROM test_grade_percentages WHERE test_id IN (:testIds)")
                .setParameter("testIds", testIds)
                .executeUpdate();

        em.createNativeQuery("DELETE FROM test_manual_grade_minimums WHERE test_id IN (:testIds)")
                .setParameter("testIds", testIds)
                .executeUpdate();
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
