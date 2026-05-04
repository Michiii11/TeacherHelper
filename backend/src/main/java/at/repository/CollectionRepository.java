package at.repository;

import at.dtos.Notification.CollectionInviteDTO;
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

        List<Collection> collections = em.createQuery(
                        "SELECT s FROM Collection s WHERE s.admin.id = :userId OR :user MEMBER OF s.users", Collection.class)
                .setParameter("userId", userId)
                .setParameter("user", user)
                .getResultList();

        return Response.ok(collections.stream()
                .map(Collection::toDTO)
                .toList()).build();
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

        // clear invites of collection
        em.createQuery("DELETE FROM CollectionInvite i WHERE i.collection.id = :collectionId")
                .setParameter("collectionId", collectionId)
                .executeUpdate();

        // clear members of collection
        collection.getUsers().clear();

        // clear focus list of collection
        if (collection.getFocusList() != null) {
            for (Focus focus : collection.getFocusList()) {
                em.remove(em.contains(focus) ? focus : em.merge(focus));
            }
            collection.getFocusList().clear();
        }

        // clear examples of collection
        List<Example> examples = em.createQuery("SELECT e FROM Example e WHERE e.collection.id = :collectionId", Example.class)
                .setParameter("collectionId", collectionId)
                .getResultList();

        for(Example example : examples) {
            em.remove(example);
        }

        // clear tests of collection
        List<Test> tests = em.createQuery("SELECT t FROM Test t WHERE t.collection.id = :collectionId", Test.class)
                .setParameter("collectionId", collectionId)
                .getResultList();

        for(Test test : tests) {
            em.remove(test);
        }

        // clear logo of collection
        if(collection.getLogoUrl() != null) {
            mediaStorageService.delete(collection.getLogoUrl());
        }

        em.merge(collection);
        em.remove(collection);

        return Response.ok().build();
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