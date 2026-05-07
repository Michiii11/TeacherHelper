package at.repository;

import at.dtos.Collection.CollectionDTO;
import at.dtos.Example.ExampleOverviewDTO;
import at.dtos.Notification.CollectionInviteDTO;
import at.dtos.Test.TestOverviewDTO;
import at.enums.NotificationActionType;
import at.enums.NotificationType;
import at.enums.InviteStatus;
import at.enums.InviteType;
import at.model.*;
import at.model.helper.Focus;
import at.security.TokenService;
import at.service.MediaStorageService;
import at.websocket.CollectionSocket;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;
import org.jboss.resteasy.reactive.multipart.FileUpload;

import java.io.IOException;
import java.nio.file.Files;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@ApplicationScoped
@Transactional
public class CollectionRepository {
    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    private static final long MAX_PROFILE_IMAGE_SIZE = 2L * 1024L * 1024L;

    @Inject
    EntityManager em;

    @Inject
    TokenService tokenService;

    @Inject
    NotificationRepository notificationRepository;

    @Inject
    MediaStorageService mediaStorageService;

    public Response getYourCollections(UUID userId) {
        User user = em.find(User.class, userId);

        if (user == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity("User not found").build();
        }

        List<Collection> collections = em.createQuery(
                        """
                        SELECT DISTINCT c
                        FROM Collection c
                        LEFT JOIN FETCH c.admin
                        LEFT JOIN FETCH c.users
                        WHERE c.admin.id = :userId OR :user MEMBER OF c.users
                        ORDER BY c.name
                        """, Collection.class)
                .setParameter("userId", userId)
                .setParameter("user", user)
                .getResultList();

        return Response.ok(collections.stream()
                .map(this::toCollectionDTOWithCounts)
                .toList()).build();
    }


    private CollectionDTO toCollectionDTOWithCounts(Collection collection) {
        List<ExampleOverviewDTO> examples = em.createQuery(
                        """
                        SELECT DISTINCT e
                        FROM Example e
                        LEFT JOIN FETCH e.focusList
                        LEFT JOIN FETCH e.admin
                        LEFT JOIN FETCH e.folder
                        WHERE e.collection.id = :collectionId
                        ORDER BY e.createdAt DESC
                        """,
                        Example.class
                )
                .setParameter("collectionId", collection.getId())
                .getResultList()
                .stream()
                .map(e -> new ExampleOverviewDTO(
                        e.getId(),
                        e.getType(),
                        e.getInstruction(),
                        e.getQuestion(),
                        e.getAdmin() != null ? e.getAdmin().getUsername() : null,
                        e.getAdmin() != null ? e.getAdmin().getId() : null,
                        e.getFocusList() != null
                                ? new java.util.LinkedList<>(e.getFocusList())
                                : List.of(),
                        e.getFolder() != null ? e.getFolder().getId() : null,
                        e.getCreatedAt(),
                        e.getUpdatedAt()
                ))
                .toList();

        List<TestOverviewDTO> tests = em.createQuery(
                        """
                        SELECT DISTINCT t
                        FROM Test t
                        LEFT JOIN FETCH t.admin
                        LEFT JOIN FETCH t.folder
                        WHERE t.collection.id = :collectionId
                        ORDER BY t.createdAt DESC
                        """,
                        Test.class
                )
                .setParameter("collectionId", collection.getId())
                .getResultList()
                .stream()
                .map(t -> new TestOverviewDTO(
                        t.getId(),
                        t.getName(),
                        t.getExampleList() != null ? t.getExampleList().size() : 0,
                        t.getDuration(),
                        t.getAdmin() != null ? t.getAdmin().getUsername() : null,
                        t.getAdmin() != null ? t.getAdmin().getId() : null,
                        t.getCreatedAt(),
                        t.getUpdatedAt(),
                        t.getFolder() != null ? t.getFolder().getId() : null
                ))
                .toList();

        return new CollectionDTO(
                collection.getId(),
                collection.getName(),
                collection.getLogoUrl(),
                collection.getAdminDTO(),
                examples,
                tests,
                collection.getUsers() != null
                        ? collection.getUsers().stream().map(User::toUserDTO).toList()
                        : List.of()
        );
    }

    public Response findById(UUID collectionId, UUID userId) {
        Collection collection = em.find(Collection.class, collectionId);
        if (collection == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        if ((!collection.getAdmin().getId().equals(userId)
                && collection.getUsers().stream().noneMatch(u -> u.getId().equals(userId)))) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }

        return Response.ok(collection.toDTO()).build();
    }

    public Response addCollection(String collectionName, UUID userId) {
        try {
            User user = em.find(User.class, userId);

            if (user == null) {
                return Response.status(Response.Status.BAD_REQUEST).entity("User not found").build();
            }

            Collection collection = new Collection(collectionName, user);
            em.persist(collection);

            return Response.ok(collection.toDTO()).build();
        } catch (Exception e) {
            return Response.status(Response.Status.BAD_REQUEST).entity("User not found or error occurred").build();
        }
    }

    public Response deleteCollection(UUID collectionId, UUID userId) {
        Collection collection = em.find(Collection.class, collectionId);

        if (collection == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Collection not found").build();
        }

        if (!collection.getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("Only the collection admin can delete the collection").build();
        }

        String logoUrl = collection.getLogoUrl();

        List<UUID> testIds = em.createQuery("""
            SELECT t.id
            FROM Test t
            WHERE t.collection.id = :collectionId
            """, UUID.class)
                .setParameter("collectionId", collectionId)
                .getResultList();

        List<UUID> exampleIds = em.createQuery("""
            SELECT e.id
            FROM Example e
            WHERE e.collection.id = :collectionId
            """, UUID.class)
                .setParameter("collectionId", collectionId)
                .getResultList();

        List<UUID> folderIds = collectFolderIds(collectionId);
        List<UUID> focusIds = em.createQuery("""
            SELECT f.id
            FROM Collection c JOIN c.focusList f
            WHERE c.id = :collectionId
            """, UUID.class)
                .setParameter("collectionId", collectionId)
                .getResultList();

        List<UUID> testExampleIds = collectTestExampleIds(testIds, exampleIds);
        deleteTestExamples(testExampleIds);
        deleteTestElementCollections(testIds);

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

        deleteFolders(folderIds);

        // clear invites of collection
        em.createQuery("DELETE FROM CollectionInvite i WHERE i.collection.id = :collectionId")
                .setParameter("collectionId", collectionId)
                .executeUpdate();

        // clear members and focus list join tables before deleting the collection itself
        collection.getUsers().clear();
        collection.getFocusList().clear();
        em.merge(collection);
        em.flush();

        if (!focusIds.isEmpty()) {
            em.createQuery("""
                DELETE FROM Focus f
                WHERE f.id IN :focusIds
                """)
                    .setParameter("focusIds", focusIds)
                    .executeUpdate();
        }

        if (logoUrl != null && !logoUrl.isBlank()) {
            mediaStorageService.delete(logoUrl);
        }

        em.remove(em.contains(collection) ? collection : em.merge(collection));
        em.flush();
        em.clear();

        CollectionSocket.broadcast(collectionId);
        return Response.ok().build();
    }

    private List<UUID> collectFolderIds(UUID collectionId) {
        List<UUID> rootFolderIds = em.createQuery("""
            SELECT f.id
            FROM Folder f
            WHERE f.collection.id = :collectionId
              AND f.parent IS NULL
            """, UUID.class)
                .setParameter("collectionId", collectionId)
                .getResultList();

        Set<UUID> folderIds = new LinkedHashSet<>();
        for (UUID rootFolderId : rootFolderIds) {
            collectFolderIdsRecursive(rootFolderId, folderIds);
        }

        // Safety net for inconsistent data where a folder has a parent outside the current tree.
        folderIds.addAll(em.createQuery("""
            SELECT f.id
            FROM Folder f
            WHERE f.collection.id = :collectionId
            """, UUID.class)
                .setParameter("collectionId", collectionId)
                .getResultList());

        return new ArrayList<>(folderIds);
    }

    private void collectFolderIdsRecursive(UUID folderId, Set<UUID> folderIds) {
        if (!folderIds.add(folderId)) {
            return;
        }

        List<UUID> childFolderIds = em.createQuery("""
            SELECT f.id
            FROM Folder f
            WHERE f.parent.id = :folderId
            """, UUID.class)
                .setParameter("folderId", folderId)
                .getResultList();

        for (UUID childId : childFolderIds) {
            collectFolderIdsRecursive(childId, folderIds);
        }
    }

    private List<UUID> collectTestExampleIds(List<UUID> testIds, List<UUID> exampleIds) {
        Set<UUID> ids = new LinkedHashSet<>();

        if (testIds != null && !testIds.isEmpty()) {
            ids.addAll(em.createQuery("""
                SELECT te.id
                FROM TestExample te
                WHERE te.test.id IN :testIds
                """, UUID.class)
                    .setParameter("testIds", testIds)
                    .getResultList());
        }

        if (exampleIds != null && !exampleIds.isEmpty()) {
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

    private void deleteTestExamples(List<UUID> testExampleIds) {
        if (testExampleIds == null || testExampleIds.isEmpty()) {
            return;
        }

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

    private void deleteTestElementCollections(List<UUID> testIds) {
        if (testIds == null || testIds.isEmpty()) {
            return;
        }

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

    private void deleteFolders(List<UUID> folderIds) {
        if (folderIds == null || folderIds.isEmpty()) {
            return;
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
    }

    public Response updateCollectionLogo(UUID collectionId, UUID userId, String logoUrl) {
        Collection collection = em.find(Collection.class, collectionId);

        if (collection == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Collection not found").build();
        }

        if (!collection.getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("Only the collection admin can update the logo").build();
        }

        collection.setLogoUrl(logoUrl);
        em.merge(collection);

        CollectionSocket.broadcast(collectionId);

        return Response.ok(collection.toDTO()).build();
    }

    public Response deleteCollectionLogo(UUID collectionId, UUID userId) {
        Collection collection = em.find(Collection.class, collectionId);

        if (collection == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Collection not found").build();
        }

        if (!collection.getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("Only the collection admin can delete the logo").build();
        }

        if (collection.getLogoUrl() == null || collection.getLogoUrl().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Collection has no logo").build();
        }

        if(collection.getLogoUrl() != null && !collection.getLogoUrl().isBlank()) {
            mediaStorageService.delete(collection.getLogoUrl());
        }

        collection.setLogoUrl(null);
        em.merge(collection);

        CollectionSocket.broadcast(collectionId);

        return Response.ok(collection.toDTO()).build();
    }

    public Response leaveCollection(UUID collectionId, UUID userId) {
        Collection collection = em.find(Collection.class, collectionId);
        User user = em.find(User.class, userId);

        if (collection == null || user == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Collection or User not found").build();
        }

        if (collection.getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.BAD_REQUEST).entity("The admin cannot leave the collection").build();
        }

        if (!collection.getUsers().removeIf(u -> u.getId().equals(userId))) {
            return Response.status(Response.Status.BAD_REQUEST).entity("You are not a member of this collection").build();
        }

        em.merge(collection);

        CollectionSocket.broadcast(collectionId);

        return Response.ok().build();
    }

    public Response removeTeacher(UUID collectionId, UUID userId, UUID teacherId) {
        Collection collection = em.find(Collection.class, collectionId);
        User user = em.find(User.class, userId);
        User teacher = em.find(User.class, teacherId);

        if (collection == null || user == null || teacher == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Collection, User or Teacher not found").build();
        }

        if (!collection.getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("Only the collection admin can remove teachers").build();
        }

        if(!collection.getUsers().contains(teacher)){
            return Response.status(Response.Status.BAD_REQUEST).entity("This teacher is not a member of the collection").build();
        }

        collection.getUsers().remove(teacher);

        em.merge(collection);

        CollectionSocket.broadcast(collectionId);

        return Response.ok().build();
    }

    public Response inviteTeacher(UUID collectionId, UUID userId, String username) {
        Collection collection = em.find(Collection.class, collectionId);
        User sender = em.find(User.class, userId);
        User teacher = em.createQuery("SELECT t FROM User t WHERE t.username = :username", User.class)
                .setParameter("username", username)
                .getResultStream()
                .findFirst()
                .orElse(null);

        if (collection == null || sender == null || teacher == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Collection, sender or teacher not found").build();
        }

        if (!collection.getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("Only the collection admin can invite teachers").build();
        }

        if (teacher.getId().equals(collection.getAdmin().getId())
                || collection.getUsers().stream().anyMatch(u -> u.getId().equals(teacher.getId()))) {
            return Response.status(Response.Status.BAD_REQUEST).entity("This user is already part of the collection").build();
        }

        Long openInviteCount = em.createQuery("""
                SELECT COUNT(i)
                FROM CollectionInvite i
                WHERE i.collection.id = :collectionId
                  AND i.recipient.id = :recipientId
                  AND i.type = :type
                  AND i.status = :status
                """, Long.class)
                .setParameter("collectionId", collectionId)
                .setParameter("recipientId", teacher.getId())
                .setParameter("type", InviteType.TEACHER_INVITATION)
                .setParameter("status", InviteStatus.PENDING)
                .getSingleResult();

        if (openInviteCount > 0) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("There is already an open invitation for this teacher")
                    .build();
        }

        CollectionInvite invite = new CollectionInvite(
                collection,
                sender,
                teacher,
                InviteType.TEACHER_INVITATION,
                ""
        );
        em.persist(invite);
        em.flush();

        notificationRepository.createNotification(
                teacher,
                sender,
                collection,
                NotificationType.COLLECTION_INVITATION,
                "Einladung zu " + collection.getName(),
                appendOptionalMessage(
                        sender.getUsername() + " hat dich eingeladen, der Schule " + collection.getName() + " beizutreten.",
                        ""
                ),
                null,
                invite.getId(),
                NotificationActionType.ACCEPT_INVITATION,
                NotificationActionType.DECLINE_INVITATION
        );

        return Response.ok(toCollectionInviteDTO(invite)).build();
    }

    public Response respondToInvite(UUID inviteId, UUID userId, boolean accept) {
        CollectionInvite invite = em.find(CollectionInvite.class, inviteId);

        if (invite == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Invite not found").build();
        }

        if (!invite.getRecipient().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("You are not allowed to respond to this invite").build();
        }

        if (invite.getStatus() != InviteStatus.PENDING) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Invite was already processed").build();
        }

        Collection collection = invite.getCollection();
        User recipient = invite.getRecipient();
        User sender = invite.getSender();

        notificationRepository.markRelatedNotificationsAsHandled(invite.getId());

        if (accept) {
            boolean alreadyMember = collection.getAdmin().getId().equals(recipient.getId())
                    || collection.getUsers().stream().anyMatch(u -> u.getId().equals(recipient.getId()));

            if (!alreadyMember) {
                collection.getUsers().add(recipient);
                em.merge(collection);
            }

            invite.setStatus(InviteStatus.ACCEPTED);
            invite.setDecidedAt(LocalDateTime.now());
            em.merge(invite);

            notificationRepository.createNotification(
                    sender, recipient, collection,
                    NotificationType.INVITATION_ACCEPTED,
                    null, null,
                    "/collection/" + collection.getId(),
                    invite.getId(),
                    null, null
            );
        } else {
            invite.setStatus(InviteStatus.DECLINED);
            invite.setDecidedAt(LocalDateTime.now());
            em.merge(invite);

            notificationRepository.createNotification(
                    sender, recipient, collection,
                    NotificationType.INVITATION_DECLINED,
                    null, null,
                    "/collection/" + collection.getId(),
                    invite.getId(),
                    null, null
            );
        }

        return Response.ok(toCollectionInviteDTO(invite)).build();
    }

    public Response updateCollectionSettings(UUID collectionId, UUID userId, String newName) {
        Collection collection = em.find(Collection.class, collectionId);

        if (collection == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Collection not found").build();
        }

        if (!collection.getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("Only the collection admin can update the collection").build();
        }

        if (newName == null || newName.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Collection name must not be empty").build();
        }

        String cleanedName = newName.trim();

        Long existing = em.createQuery("""
                SELECT COUNT(s)
                FROM Collection s
                WHERE LOWER(s.name) = LOWER(:name)
                  AND s.id <> :collectionId
                """, Long.class)
                .setParameter("name", cleanedName)
                .setParameter("collectionId", collectionId)
                .getSingleResult();

        if (existing > 0) {
            return Response.status(Response.Status.BAD_REQUEST).entity("A collection with this name already exists").build();
        }

        collection.setName(cleanedName);
        em.merge(collection);

        CollectionSocket.broadcast(collectionId);

        return Response.ok(collection.toDTO()).build();
    }

    public Response getFocusList(UUID collectionId, UUID userId) {
        Collection collection = em.find(Collection.class, collectionId);

        if(!collection.getAdmin().getId().equals(userId) &&
                collection.getUsers().stream().noneMatch(u -> u.getId().equals(userId))) {
            return Response.status(Response.Status.FORBIDDEN).entity("Only members of the collection can access the focus list").build();
        }

        List<Focus> focusList = em.createQuery("SELECT s.focusList FROM Collection s WHERE s.id = :id order by s.id", Focus.class)
                .setParameter("id", collectionId)
                .getResultList();

        return Response.ok(focusList).build();
    }

    public Response addFocus(UUID collectionId, Focus f, UUID userId) {
        Collection collection = em.find(Collection.class, collectionId);

        if(!collection.getAdmin().getId().equals(userId) &&
                collection.getUsers().stream().noneMatch(u -> u.getId().equals(userId))) {
            return Response.status(Response.Status.FORBIDDEN).entity("Only members of the collection can access the focus list").build();
        }

        Focus focus = new Focus(f.getLabel());
        em.persist(focus);

        collection.getFocusList().add(focus);
        em.merge(collection);

        CollectionSocket.broadcast(collectionId);

        return Response.ok(focus).build();
    }

    public Response deleteFocus(UUID collectionId, UUID focusId, UUID userId) {
        Collection collection = em.find(Collection.class, collectionId);

        if(!collection.getAdmin().getId().equals(userId) &&
                collection.getUsers().stream().noneMatch(u -> u.getId().equals(userId))) {
            return Response.status(Response.Status.FORBIDDEN).entity("Only members of the collection can access the focus list").build();
        }

        Focus focus = em.find(Focus.class, focusId);

        collection.getFocusList().remove(focus);

        List<Example> exampleList = em.createQuery(
                        "select e from Example e where :f MEMBER OF e.focusList", Example.class)
                .setParameter("f", focus)
                .getResultList();

        for (Example e : exampleList) {
            e.getFocusList().remove(focus);
        }

        em.remove(focus);

        CollectionSocket.broadcast(collectionId);

        return Response.ok().build();
    }

    public Response getCollectionLogo(UUID collectionId, UUID userId) {
        String objectName = getCollectionUrl(collectionId);
        if (objectName == null || objectName.isBlank()) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        MediaStorageService.StoredImage image = mediaStorageService.loadImage(objectName);
        if (image == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        return Response.ok(image.data()).type(image.contentType()).build();
    }

    public Response uploadCollectionLogo(UUID collectionId, UUID userId, FileUpload file) {
        if (file == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity("No file uploaded").build();
        }


        String contentType = file.contentType() == null ? "" : file.contentType().toLowerCase();
        if (!ALLOWED_IMAGE_TYPES.contains(contentType)) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Use JPG, PNG or WEBP.").build();
        }
        if (contentType == null || !contentType.startsWith("image/")) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Uploaded file must be an image").build();
        }

        try {
            if (Files.size(file.uploadedFile()) > MAX_PROFILE_IMAGE_SIZE) {
                return Response.status(Response.Status.BAD_REQUEST).entity("File is too big. Max. 2 MB.").build();
            }

            String objectName = mediaStorageService.uploadCollectionLogo(collectionId, file.uploadedFile());
            return updateCollectionLogo(collectionId, userId, objectName);
        } catch (IOException e) {
            return Response.serverError().entity("Logo upload failed").build();
        }
    }



    private String appendOptionalMessage(String baseMessage, String customMessage) {
        if (customMessage == null || customMessage.isBlank()) {
            return baseMessage;
        }

        return baseMessage + "\n\nMessage: " + customMessage.trim();
    }

    public String getCollectionUrl(UUID id) {
        Collection collection = em.find(Collection.class, id);
        if (collection == null) {
            return null;
        }

        return collection.getLogoUrl();
    }

    private CollectionInviteDTO toCollectionInviteDTO(CollectionInvite invite) {
        return new CollectionInviteDTO(
                invite.getId(),
                invite.getCollection().toDTO(),
                invite.getSender().toUserDTO(),
                invite.getRecipient().toUserDTO(),
                invite.getType(),
                invite.getStatus(),
                invite.getMessage(),
                invite.getCreatedAt(),
                invite.getDecidedAt()
        );
    }

    public boolean isUserPartOfCollection(UUID collectionId, UUID userId) {
        Collection collection = em.find(Collection.class, collectionId);
        if (collection == null) {
            return false;
        }

        return collection.getAdmin().getId().equals(userId) ||
                collection.getUsers().stream().anyMatch(u -> u.getId().equals(userId));
    }
}