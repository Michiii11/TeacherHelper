package at.repository;

import at.dtos.Notification.SchoolInviteDTO;
import at.dtos.School.SchoolDTO;
import at.dtos.User.UserDTO;
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

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
@Transactional
public class SchoolRepository {
    @Inject
    EntityManager em;

    @Inject
    TokenService tokenService;

    @Inject
    NotificationRepository notificationRepository;

    @Inject
    MediaStorageService mediaStorageService;

    public Response addSchool(String schoolName, UUID userId) {
        try {
            User user = em.find(User.class, userId);
            if (user == null) {
                return Response.status(Response.Status.BAD_REQUEST).entity("User not found").build();
            }

            School school = new School(schoolName, user);
            em.persist(school);

            return Response.ok(toSchoolDTO(school)).build();
        } catch (Exception e) {
            return Response.status(Response.Status.BAD_REQUEST).entity("User not found or error occurred").build();
        }
    }

    public List<SchoolDTO> getAllSchools() {
        List<School> schools = em.createQuery("SELECT s FROM School s", School.class).getResultList();
        return schools.stream()
                .map(this::toSchoolDTO)
                .toList();
    }

    public SchoolDTO findById(UUID id, UUID userId) {
        School school = em.find(School.class, id);
        if (school == null) {
            return null;
        }

        if (userId == null || (!school.getAdmin().getId().equals(userId)
                && school.getUsers().stream().noneMatch(u -> u.getId().equals(userId)))) {
            return null;
        }

        return toSchoolDTO(school);
    }

    public List<SchoolDTO> getYourSchools(String auth) {
        UUID userId = tokenService.validateTokenAndGetUserId(auth);

        if (userId == null) {
            return List.of();
        }

        User user = em.find(User.class, userId);

        List<School> schools = em.createQuery(
                        "SELECT s FROM School s WHERE s.admin.id = :userId OR :user MEMBER OF s.users", School.class)
                .setParameter("userId", userId)
                .setParameter("user", user)
                .getResultList();

        return schools.stream()
                .map(this::toSchoolDTO)
                .toList();
    }

    public List<Focus> getFocusList(UUID id) {
        return em.createQuery("SELECT s.focusList FROM School s WHERE s.id = :id", Focus.class)
                .setParameter("id", id)
                .getResultList();
    }

    public Focus addFocus(UUID id, Focus focus) {
        School s = em.find(School.class, id);

        Focus f = new Focus(focus.getLabel());
        em.persist(f);

        s.getFocusList().add(f);
        em.merge(s);

        return f;
    }

    public Response deleteFocus(UUID id, Long focusId) {
        School s = em.find(School.class, id);
        Focus f = em.find(Focus.class, focusId);

        s.getFocusList().remove(f);

        List<Example> exampleList = em.createQuery(
                        "select e from Example e where :f MEMBER OF e.focusList", Example.class)
                .setParameter("f", f)
                .getResultList();

        for (Example e : exampleList) {
            e.getFocusList().remove(f);
        }

        em.remove(f);

        return Response.ok().build();
    }

    public SchoolDTO toSchoolDTO(School school) {
        return new SchoolDTO(
                school.getId(),
                school.getName(),
                school.getLogoUrl(),
                school.getAdminDTO(),
                school.getUsers().size(),
                school.getUsers().stream().map(User::toUserDTO).toList()
        );
    }

    public List<UserDTO> getAllTeachers(UUID id) {
        School school = em.find(School.class, id);

        if (school == null) {
            return List.of();
        }

        List<UUID> memberIds = school.getUsers()
                .stream()
                .map(User::getId)
                .toList();

        UUID adminId = school.getAdmin().getId();

        List<UUID> invitedUserIds = em.createQuery("""
            SELECT i.recipient.id
            FROM SchoolInvite i
            WHERE i.school.id = :schoolId
              AND i.type = :type
              AND i.status = :status
            """, UUID.class)
                .setParameter("schoolId", id)
                .setParameter("type", SchoolInviteType.TEACHER_INVITATION)
                .setParameter("status", SchoolInviteStatus.PENDING)
                .getResultList();

        List<UUID> excludedIds = new java.util.ArrayList<>();
        excludedIds.add(adminId);
        excludedIds.addAll(memberIds);
        excludedIds.addAll(invitedUserIds);

        String jpql = excludedIds.isEmpty()
                ? "SELECT u FROM User u"
                : "SELECT u FROM User u WHERE u.id NOT IN :excluded and u.allowInvitations != false";

        var query = em.createQuery(jpql, User.class);

        if (!excludedIds.isEmpty()) {
            query.setParameter("excluded", excludedIds);
        }

        return query.getResultList()
                .stream()
                .map(User::toUserDTO)
                .toList();
    }

    public Response leaveSchool(UUID id, UUID userId) {
        School school = em.find(School.class, id);
        User user = em.find(User.class, userId);

        if (school == null || user == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity("School or User not found").build();
        }

        if (school.getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.BAD_REQUEST).entity("The admin cannot leave the school").build();
        }

        if (!school.getUsers().removeIf(u -> u.getId().equals(userId))) {
            return Response.status(Response.Status.BAD_REQUEST).entity("You are not a member of this school").build();
        }

        em.merge(school);

        return Response.ok().build();
    }

    public Response removeTeacher(UUID id, UUID userId, int teacherId) {
        School school = em.find(School.class, id);
        User user = em.find(User.class, userId);
        User teacher = em.find(User.class, (long) teacherId);

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

        return Response.ok(toSchoolDTO(school)).build();
    }

    public Response updateSchoolLogoObject(UUID schoolId, UUID userId, String logoUrl) {
        School school = em.find(School.class, schoolId);

        if (school == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("School not found").build();
        }

        if (!school.getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("Only the school admin can update the logo").build();
        }

        school.setLogoUrl(logoUrl);
        em.merge(school);

        return Response.ok(toSchoolDTO(school)).build();
    }

    public Response deleteSchoolLogo(UUID schoolId, UUID userId) {
        School school = em.find(School.class, schoolId);

        if (school == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("School not found").build();
        }

        if (!school.getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("Only the school admin can delete the logo").build();
        }

        if (school.getLogoUrl() == null || school.getLogoUrl().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("School has no logo").build();
        }

        if(school.getLogoUrl() != null && !school.getLogoUrl().isBlank()) {
            mediaStorageService.delete(school.getLogoUrl());
        }

        school.setLogoUrl(null);
        em.merge(school);

        return Response.ok(toSchoolDTO(school)).build();
    }

    public Response deleteSchool(UUID schoolId, UUID userId) {
        School school = em.find(School.class, schoolId);

        if (school == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("School not found").build();
        }

        if (!school.getAdmin().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("Only the school admin can delete the school").build();
        }

        em.createQuery("DELETE FROM SchoolInvite i WHERE i.school.id = :schoolId")
                .setParameter("schoolId", schoolId)
                .executeUpdate();

        school.getUsers().clear();

        if (school.getFocusList() != null) {
            for (Focus focus : school.getFocusList()) {
                em.remove(em.contains(focus) ? focus : em.merge(focus));
            }
            school.getFocusList().clear();
        }

        List<Example> examples = em.createQuery("SELECT e FROM Example e WHERE e.school.id = :schoolId", Example.class)
                .setParameter("schoolId", schoolId)
                .getResultList();

        for(Example example : examples) {
            em.remove(example);
        }

        List<Test> tests = em.createQuery("SELECT t FROM Test t WHERE t.school.id = :schoolId", Test.class)
                .setParameter("schoolId", schoolId)
                .getResultList();

        for(Test test : tests) {
            em.remove(test);
        }


        System.out.println(school.getLogoUrl());
        if(school.getLogoUrl() != null) {
            mediaStorageService.delete(school.getLogoUrl());
        }

        em.merge(school);
        em.remove(school);

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

    public Response respondToInvite(Long inviteId, UUID userId, boolean accept) {
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
                    sender,
                    recipient,
                    school,
                    NotificationType.INVITATION_ACCEPTED,
                    "Invitation accepted",
                    recipient.getUsername() + " accepted the invitation to " + school.getName() + ".",
                    "/school/" + school.getId(),
                    invite.getId(),
                    null,
                    null
            );
        } else {
            invite.setStatus(SchoolInviteStatus.DECLINED);
            invite.setDecidedAt(LocalDateTime.now());
            em.merge(invite);

            notificationRepository.createNotification(
                    sender,
                    recipient,
                    school,
                    NotificationType.INVITATION_DECLINED,
                    "Invitation declined",
                    recipient.getUsername() + " declined the invitation to " + school.getName() + ".",
                    "/school/" + school.getId(),
                    invite.getId(),
                    null,
                    null
            );
        }

        return Response.ok(toSchoolInviteDTO(invite)).build();
    }

    public List<SchoolInviteDTO> getMyPendingInvites(UUID userId) {
        return em.createQuery("""
                SELECT i
                FROM SchoolInvite i
                WHERE i.recipient.id = :userId
                  AND i.status = :status
                ORDER BY i.createdAt DESC
                """, SchoolInvite.class)
                .setParameter("userId", userId)
                .setParameter("status", SchoolInviteStatus.PENDING)
                .getResultList()
                .stream()
                .map(this::toSchoolInviteDTO)
                .toList();
    }

    public List<SchoolInviteDTO> getPendingRequestsForSchool(UUID schoolId, UUID userId) {
        School school = em.find(School.class, schoolId);
        if (school == null) {
            return List.of();
        }

        if (!school.getAdmin().getId().equals(userId)) {
            return List.of();
        }

        return em.createQuery("""
                SELECT i
                FROM SchoolInvite i
                WHERE i.school.id = :schoolId
                  AND i.type = :type
                  AND i.status = :status
                ORDER BY i.createdAt DESC
                """, SchoolInvite.class)
                .setParameter("schoolId", schoolId)
                .setParameter("type", SchoolInviteType.JOIN_REQUEST)
                .setParameter("status", SchoolInviteStatus.PENDING)
                .getResultList()
                .stream()
                .map(this::toSchoolInviteDTO)
                .toList();
    }

    private SchoolInviteDTO toSchoolInviteDTO(SchoolInvite invite) {
        return new SchoolInviteDTO(
                invite.getId(),
                toSchoolDTO(invite.getSchool()),
                invite.getSender().toUserDTO(),
                invite.getRecipient().toUserDTO(),
                invite.getType(),
                invite.getStatus(),
                invite.getMessage(),
                invite.getCreatedAt(),
                invite.getDecidedAt()
        );
    }

    private String appendOptionalMessage(String baseMessage, String customMessage) {
        if (customMessage == null || customMessage.isBlank()) {
            return baseMessage;
        }

        return baseMessage + "\n\nNachricht: " + customMessage.trim();
    }

    public String getSchoolUrl(UUID id) {
        School school = em.find(School.class, id);
        if (school == null) {
            return null;
        }

        return school.getLogoUrl();
    }
}