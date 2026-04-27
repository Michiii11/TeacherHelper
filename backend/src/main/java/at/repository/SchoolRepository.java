package at.repository;

import at.dtos.Notification.SchoolInviteDTO;
import at.enums.NotificationActionType;
import at.enums.NotificationType;
import at.enums.SchoolInviteStatus;
import at.enums.SchoolInviteType;
import at.model.*;
import at.model.helper.Focus;
import at.security.TokenService;
import at.service.MediaStorageService;
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
public class SchoolRepository {
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

    public Response getYourSchools(UUID userId) {
        User user = em.find(User.class, userId);

        List<School> collections = em.createQuery(
                        "SELECT s FROM School s WHERE s.admin.id = :userId OR :user MEMBER OF s.users", School.class)
                .setParameter("userId", userId)
                .setParameter("user", user)
                .getResultList();

        return Response.ok(collections.stream()
                .map(School::toSchoolDTO)
                .toList()).build();
    }

    public Response findById(UUID collectionId, UUID userId) {
        School collection = em.find(School.class, collectionId);
        if (collection == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        if ((!collection.getAdmin().getId().equals(userId)
                && collection.getUsers().stream().noneMatch(u -> u.getId().equals(userId)))) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }

        return Response.ok(collection.toSchoolDTO()).build();
    }

    public Response addCollection(String collectionName, UUID userId) {
        try {
            User user = em.find(User.class, userId);

            if (user == null) {
                return Response.status(Response.Status.BAD_REQUEST).entity("User not found").build();
            }

            School school = new School(collectionName, user);
            em.persist(school);

            return Response.ok(school.toSchoolDTO()).build();
        } catch (Exception e) {
            return Response.status(Response.Status.BAD_REQUEST).entity("User not found or error occurred").build();
        }
    }

    public Response deleteCollection(UUID collectionId, UUID userId) {
        School collection = em.find(School.class, collectionId);

        if (collection == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Collection not found").build();
        }

        if (!collection.getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("Only the collection admin can delete the collection").build();
        }

        // clear invites of collection
        em.createQuery("DELETE FROM SchoolInvite i WHERE i.school.id = :collectionId")
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
        List<Example> examples = em.createQuery("SELECT e FROM Example e WHERE e.school.id = :collectionId", Example.class)
                .setParameter("collectionId", collectionId)
                .getResultList();

        for(Example example : examples) {
            em.remove(example);
        }

        // clear tests of collection
        List<Test> tests = em.createQuery("SELECT t FROM Test t WHERE t.school.id = :collectionId", Test.class)
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
        School school = em.find(School.class, collectionId);

        if (school == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Collection not found").build();
        }

        if (!school.getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("Only the collection admin can update the logo").build();
        }

        school.setLogoUrl(logoUrl);
        em.merge(school);

        return Response.ok(school.toSchoolDTO()).build();
    }

    public Response deleteCollectionLogo(UUID collectionId, UUID userId) {
        School school = em.find(School.class, collectionId);

        if (school == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Collection not found").build();
        }

        if (!school.getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("Only the collection admin can delete the logo").build();
        }

        if (school.getLogoUrl() == null || school.getLogoUrl().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Collection has no logo").build();
        }

        if(school.getLogoUrl() != null && !school.getLogoUrl().isBlank()) {
            mediaStorageService.delete(school.getLogoUrl());
        }

        school.setLogoUrl(null);
        em.merge(school);

        return Response.ok(school.toSchoolDTO()).build();
    }

    public Response leaveCollection(UUID collectionId, UUID userId) {
        School collection = em.find(School.class, collectionId);
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

        return Response.ok().build();
    }

    public Response removeTeacher(UUID id, UUID userId, UUID teacherId) {
        School school = em.find(School.class, id);
        User user = em.find(User.class, userId);
        User teacher = em.find(User.class, teacherId);

        if (school == null || user == null || teacher == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity("School, User or Teacher not found").build();
        }

        if (!school.getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("Only the school admin can remove teachers").build();
        }

        if(!school.getUsers().contains(teacher)){
            return Response.status(Response.Status.BAD_REQUEST).entity("This teacher is not a member of the school").build();
        }

        school.getUsers().remove(teacher);

        em.merge(school);

        return Response.ok().build();
    }

    public Response inviteTeacher(UUID schoolId, UUID userId, String email) {
        School school = em.find(School.class, schoolId);
        User sender = em.find(User.class, userId);
        User teacher = em.createQuery("SELECT t FROM User t WHERE t.email = :email", User.class)
                .setParameter("email", email)
                .getResultStream()
                .findFirst()
                .orElse(null);

        if (school == null || sender == null || teacher == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity("School, sender or teacher not found").build();
        }

        if (!school.getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("Only the school admin can invite teachers").build();
        }

        if (teacher.getId().equals(school.getAdmin().getId())
                || school.getUsers().stream().anyMatch(u -> u.getId().equals(teacher.getId()))) {
            return Response.status(Response.Status.BAD_REQUEST).entity("This user is already part of the school").build();
        }

        Long openInviteCount = em.createQuery("""
                SELECT COUNT(i)
                FROM SchoolInvite i
                WHERE i.school.id = :schoolId
                  AND i.recipient.id = :recipientId
                  AND i.type = :type
                  AND i.status = :status
                """, Long.class)
                .setParameter("schoolId", schoolId)
                .setParameter("recipientId", teacher.getId())
                .setParameter("type", SchoolInviteType.TEACHER_INVITATION)
                .setParameter("status", SchoolInviteStatus.PENDING)
                .getSingleResult();

        if (openInviteCount > 0) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("There is already an open invitation for this teacher")
                    .build();
        }

        SchoolInvite invite = new SchoolInvite(
                school,
                sender,
                teacher,
                SchoolInviteType.TEACHER_INVITATION,
                ""
        );
        em.persist(invite);
        em.flush();

        notificationRepository.createNotification(
                teacher,
                sender,
                school,
                NotificationType.SCHOOL_INVITATION,
                "Einladung zu " + school.getName(),
                appendOptionalMessage(
                        sender.getUsername() + " hat dich eingeladen, der Schule " + school.getName() + " beizutreten.",
                        ""
                ),
                null,
                invite.getId(),
                NotificationActionType.ACCEPT_INVITATION,
                NotificationActionType.DECLINE_INVITATION
        );

        return Response.ok(toSchoolInviteDTO(invite)).build();
    }

    public Response respondToInvite(UUID inviteId, UUID userId, boolean accept) {
        SchoolInvite invite = em.find(SchoolInvite.class, inviteId);

        if (invite == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Invite not found").build();
        }

        if (!invite.getRecipient().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("You are not allowed to respond to this invite").build();
        }

        if (invite.getStatus() != SchoolInviteStatus.PENDING) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Invite was already processed").build();
        }

        School school = invite.getSchool();
        User recipient = invite.getRecipient();
        User sender = invite.getSender();

        notificationRepository.markRelatedNotificationsAsHandled(invite.getId());

        if (accept) {
            boolean alreadyMember = school.getAdmin().getId().equals(recipient.getId())
                    || school.getUsers().stream().anyMatch(u -> u.getId().equals(recipient.getId()));

            if (!alreadyMember) {
                school.getUsers().add(recipient);
                em.merge(school);
            }

            invite.setStatus(SchoolInviteStatus.ACCEPTED);
            invite.setDecidedAt(LocalDateTime.now());
            em.merge(invite);

            notificationRepository.createNotification(
                    sender, recipient, school,
                    NotificationType.INVITATION_ACCEPTED,
                    null, null,
                    "/collection/" + school.getId(),
                    invite.getId(),
                    null, null
            );
        } else {
            invite.setStatus(SchoolInviteStatus.DECLINED);
            invite.setDecidedAt(LocalDateTime.now());
            em.merge(invite);

            notificationRepository.createNotification(
                    sender, recipient, school,
                    NotificationType.INVITATION_DECLINED,
                    null, null,
                    "/collection/" + school.getId(),
                    invite.getId(),
                    null, null
            );
        }

        return Response.ok(toSchoolInviteDTO(invite)).build();
    }

    public Response updateSchoolSettings(UUID schoolId, UUID userId, String newName) {
        School school = em.find(School.class, schoolId);

        if (school == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("School not found").build();
        }

        if (!school.getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("Only the school admin can update the school").build();
        }

        if (newName == null || newName.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("School name must not be empty").build();
        }

        String cleanedName = newName.trim();

        Long existing = em.createQuery("""
                SELECT COUNT(s)
                FROM School s
                WHERE LOWER(s.name) = LOWER(:name)
                  AND s.id <> :schoolId
                """, Long.class)
                .setParameter("name", cleanedName)
                .setParameter("schoolId", schoolId)
                .getSingleResult();

        if (existing > 0) {
            return Response.status(Response.Status.BAD_REQUEST).entity("A school with this name already exists").build();
        }

        school.setName(cleanedName);
        em.merge(school);

        return Response.ok(school.toSchoolDTO()).build();
    }

    public Response getFocusList(UUID collectionId, UUID userId) {
        School collection = em.find(School.class, collectionId);

        if(!collection.getAdmin().getId().equals(userId) &&
        collection.getUsers().stream().noneMatch(u -> u.getId().equals(userId))) {
            return Response.status(Response.Status.FORBIDDEN).entity("Only members of the collection can access the focus list").build();
        }

        List<Focus> focusList = em.createQuery("SELECT s.focusList FROM School s WHERE s.id = :id order by s.id", Focus.class)
                .setParameter("id", collectionId)
                .getResultList();

        return Response.ok(focusList).build();
    }

    public Response addFocus(UUID collectionId, Focus f, UUID userId) {
        School collection = em.find(School.class, collectionId);

        if(!collection.getAdmin().getId().equals(userId) &&
                collection.getUsers().stream().noneMatch(u -> u.getId().equals(userId))) {
            return Response.status(Response.Status.FORBIDDEN).entity("Only members of the collection can access the focus list").build();
        }

        Focus focus = new Focus(f.getLabel());
        em.persist(focus);

        collection.getFocusList().add(focus);
        em.merge(collection);

        return Response.ok(focus).build();
    }

    public Response deleteFocus(UUID id, UUID focusId, UUID userId) {
        School collection = em.find(School.class, id);

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

        return Response.ok().build();
    }

    public Response getCollectionLogo(UUID collectionId, UUID userId) {
        String objectName = getSchoolUrl(collectionId);
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

            String objectName = mediaStorageService.uploadSchoolLogo(collectionId, file.uploadedFile());
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

    public String getSchoolUrl(UUID id) {
        School school = em.find(School.class, id);
        if (school == null) {
            return null;
        }

        return school.getLogoUrl();
    }

    private SchoolInviteDTO toSchoolInviteDTO(SchoolInvite invite) {
        return new SchoolInviteDTO(
                invite.getId(),
                invite.getSchool().toSchoolDTO(),
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
        School collection = em.find(School.class, collectionId);
        if (collection == null) {
            return false;
        }

        return collection.getAdmin().getId().equals(userId) ||
                collection.getUsers().stream().anyMatch(u -> u.getId().equals(userId));
    }
}