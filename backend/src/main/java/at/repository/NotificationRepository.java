package at.repository;

import at.dtos.Notification.NotificationDTO;
import at.dtos.School.SchoolDTO;
import at.enums.NotificationActionType;
import at.enums.NotificationType;
import at.model.Notification;
import at.model.School;
import at.model.User;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;

import java.time.LocalDateTime;
import java.util.List;

@ApplicationScoped
@Transactional
public class NotificationRepository {

    @Inject
    EntityManager em;

    public List<NotificationDTO> getMyNotifications(Long userId) {
        return em.createQuery("""
            SELECT n
            FROM Notification n
            WHERE n.recipient.id = :userId
            ORDER BY n.createdAt DESC
            """, Notification.class)
                .setParameter("userId", userId)
                .getResultList()
                .stream()
                .map(this::toDTO)
                .toList();
    }

    public Response markAsRead(Long id, Long userId) {
        Notification notification = em.find(Notification.class, id);

        if (notification == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Notification not found").build();
        }

        if (!notification.getRecipient().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("You are not allowed to modify this notification").build();
        }

        notification.setRead(true);
        em.merge(notification);
        return Response.ok().build();
    }

    public Response archive(Long id, Long userId) {
        Notification notification = em.find(Notification.class, id);

        if (notification == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Notification not found").build();
        }

        if (!notification.getRecipient().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("You are not allowed to modify this notification").build();
        }

        notification.setRead(true);
        notification.setArchived(true);
        em.merge(notification);
        return Response.ok().build();
    }

    public Response delete(Long id, Long userId) {
        Notification notification = em.find(Notification.class, id);

        if (notification == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Notification not found").build();
        }

        if (!notification.getRecipient().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("You are not allowed to delete this notification").build();
        }

        em.remove(notification);
        return Response.ok().build();
    }

    public Response executeAction(Long notificationId, Long userId, NotificationActionType action) {
        Notification notification = em.find(Notification.class, notificationId);

        if (notification == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("Notification not found").build();
        }

        if (!notification.getRecipient().getId().equals(userId)) {
            return Response.status(Response.Status.FORBIDDEN).entity("You are not allowed to modify this notification").build();
        }

        if (action == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Action is required").build();
        }

        if (notification.getPrimaryAction() != null || notification.getSecondaryAction() != null) {
            boolean isDecisionNotification = notification.getPrimaryAction() == NotificationActionType.ACCEPT_INVITATION
                    || notification.getPrimaryAction() == NotificationActionType.DECLINE_INVITATION
                    || notification.getPrimaryAction() == NotificationActionType.ACCEPT_JOIN_REQUEST
                    || notification.getPrimaryAction() == NotificationActionType.DECLINE_JOIN_REQUEST
                    || notification.getSecondaryAction() == NotificationActionType.ACCEPT_INVITATION
                    || notification.getSecondaryAction() == NotificationActionType.DECLINE_INVITATION
                    || notification.getSecondaryAction() == NotificationActionType.ACCEPT_JOIN_REQUEST
                    || notification.getSecondaryAction() == NotificationActionType.DECLINE_JOIN_REQUEST;

            if (isDecisionNotification && action == NotificationActionType.MARK_AS_READ) {
                return Response.status(Response.Status.BAD_REQUEST)
                        .entity("Decision notifications can only be accepted or declined")
                        .build();
            }
        }

        switch (action) {
            case MARK_AS_READ -> {
                notification.setRead(true);
                em.merge(notification);
                return Response.ok().build();
            }
            case ARCHIVE -> {
                notification.setRead(true);
                notification.setArchived(true);
                em.merge(notification);
                return Response.ok().build();
            }
            case OPEN_LINK -> {
                notification.setRead(true);
                em.merge(notification);
                return Response.ok().build();
            }
            case DELETE -> {
                em.remove(notification);
                return Response.ok().build();
            }
            default -> {
                return Response.status(Response.Status.BAD_REQUEST)
                        .entity("This action must be handled by the domain endpoint and not directly by NotificationRepository")
                        .build();
            }
        }
    }

    public void markRelatedNotificationsAsHandled(Long relatedEntityId) {
        em.createQuery("""
                UPDATE Notification n
                SET n.read = true
                WHERE n.relatedEntityId = :relatedEntityId
                """)
                .setParameter("relatedEntityId", relatedEntityId)
                .executeUpdate();
    }

    public Notification createNotification(User recipient,
                                           User actor,
                                           School school,
                                           NotificationType type,
                                           String title,
                                           String message,
                                           String link,
                                           Long relatedEntityId,
                                           NotificationActionType primaryAction,
                                           NotificationActionType secondaryAction) {
        Notification notification = new Notification(
                recipient,
                actor,
                school,
                type,
                title,
                message,
                link,
                false,
                false,
                relatedEntityId,
                primaryAction,
                secondaryAction,
                LocalDateTime.now()
        );

        em.persist(notification);
        return notification;
    }

    private NotificationDTO toDTO(Notification n) {
        SchoolDTO schoolDTO = null;

        if (n.getSchool() != null) {
            schoolDTO = new SchoolDTO(
                    n.getSchool().getId(),
                    n.getSchool().getName(),
                    n.getSchool().getAdminDTO(),
                    n.getSchool().getUsers().size(),
                    n.getSchool().getUsers().stream().map(User::toUserDTO).toList()
            );
        }

        return new NotificationDTO(
                n.getId(),
                n.getActor() != null ? n.getActor().toUserDTO() : null,
                schoolDTO,
                n.getType(),
                n.getTitle(),
                n.getMessage(),
                n.getLink(),
                n.isRead(),
                n.isArchived(),
                n.getRelatedEntityId(),
                n.getPrimaryAction(),
                n.getSecondaryAction(),
                n.getCreatedAt()
        );
    }
}