package at.model;

import at.dtos.Notification.NotificationDTO;
import at.enums.NotificationActionType;
import at.enums.NotificationType;
import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
public class Notification {
    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne
    private User recipient;

    @ManyToOne
    private User actor;

    @ManyToOne
    private School school;

    @Enumerated(EnumType.STRING)
    private NotificationType type;

    private String title;

    @Column(length = 2000)
    private String message;

    private String link;

    private boolean read = false;

    private UUID relatedEntityId;

    @Enumerated(EnumType.STRING)
    private NotificationActionType primaryAction;

    @Enumerated(EnumType.STRING)
    private NotificationActionType secondaryAction;

    private LocalDateTime createdAt = LocalDateTime.now();

    public Notification() {
    }

    public Notification(User recipient,
                        User actor,
                        School school,
                        NotificationType type,
                        String title,
                        String message,
                        String link,
                        boolean read,
                        UUID relatedEntityId,
                        NotificationActionType primaryAction,
                        NotificationActionType secondaryAction,
                        LocalDateTime createdAt) {
        this.recipient = recipient;
        this.actor = actor;
        this.school = school;
        this.type = type;
        this.title = title;
        this.message = message;
        this.link = link;
        this.read = read;
        this.relatedEntityId = relatedEntityId;
        this.primaryAction = primaryAction;
        this.secondaryAction = secondaryAction;
        this.createdAt = createdAt;
    }

    @Override
    public String toString() {
        return "Notification{" +
                "id=" + id +
                ", recipient=" + recipient +
                ", actor=" + actor +
                ", school=" + school +
                ", type=" + type +
                ", title='" + title + '\'' +
                ", message='" + message + '\'' +
                ", link='" + link + '\'' +
                ", read=" + read +
                ", relatedEntityId=" + relatedEntityId +
                ", primaryAction=" + primaryAction +
                ", secondaryAction=" + secondaryAction +
                ", createdAt=" + createdAt +
                '}';
    }

    public NotificationDTO toDTO (){
        return new NotificationDTO(
                this.getId(),
                this.getActor() != null ? this.getActor().toUserDTO() : null,
                this.school.toSchoolDTO(),
                this.getType(),
                this.getTitle(),
                this.getMessage(),
                this.getLink(),
                this.isRead(),
                this.getRelatedEntityId(),
                this.getPrimaryAction(),
                this.getSecondaryAction(),
                this.getCreatedAt()
        );
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public User getRecipient() {
        return recipient;
    }

    public void setRecipient(User recipient) {
        this.recipient = recipient;
    }

    public User getActor() {
        return actor;
    }

    public void setActor(User actor) {
        this.actor = actor;
    }

    public School getSchool() {
        return school;
    }

    public void setSchool(School school) {
        this.school = school;
    }

    public NotificationType getType() {
        return type;
    }

    public void setType(NotificationType type) {
        this.type = type;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getLink() {
        return link;
    }

    public void setLink(String link) {
        this.link = link;
    }

    public boolean isRead() {
        return read;
    }

    public void setRead(boolean read) {
        this.read = read;
    }

    public UUID getRelatedEntityId() {
        return relatedEntityId;
    }

    public void setRelatedEntityId(UUID relatedEntityId) {
        this.relatedEntityId = relatedEntityId;
    }

    public NotificationActionType getPrimaryAction() {
        return primaryAction;
    }

    public void setPrimaryAction(NotificationActionType primaryAction) {
        this.primaryAction = primaryAction;
    }

    public NotificationActionType getSecondaryAction() {
        return secondaryAction;
    }

    public void setSecondaryAction(NotificationActionType secondaryAction) {
        this.secondaryAction = secondaryAction;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}