package at.model;

import at.enums.InviteStatus;
import at.enums.InviteType;
import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
public class CollectionInvite {
    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(optional = false)
    private Collection collection;

    @ManyToOne(optional = false)
    private User sender;

    @ManyToOne(optional = false)
    private User recipient;

    @Enumerated(EnumType.STRING)
    private InviteType type;

    @Enumerated(EnumType.STRING)
    private InviteStatus status = InviteStatus.PENDING;

    @Column(length = 1000)
    private String message;

    private LocalDateTime createdAt;
    private LocalDateTime decidedAt;

    public CollectionInvite() {
    }

    public CollectionInvite(Collection collection, User sender, User recipient, InviteType type, String message) {
        this.collection = collection;
        this.sender = sender;
        this.recipient = recipient;
        this.type = type;
        this.message = message;
        this.createdAt = LocalDateTime.now();
    }

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (this.createdAt == null) {
            this.createdAt = now;
        }
    }

    @Override
    public String toString() {
        return "CollectionInvite{" +
                "id=" + id +
                ", collection=" + collection +
                ", sender=" + sender +
                ", recipient=" + recipient +
                ", type=" + type +
                ", status=" + status +
                ", message='" + message + '\'' +
                ", createdAt=" + createdAt +
                ", decidedAt=" + decidedAt +
                '}';
    }

    public UUID getId() {
        return id;
    }

    public Collection getCollection() {
        return collection;
    }

    public void setCollection(Collection collection) {
        this.collection = collection;
    }

    public User getSender() {
        return sender;
    }

    public void setSender(User sender) {
        this.sender = sender;
    }

    public User getRecipient() {
        return recipient;
    }

    public void setRecipient(User recipient) {
        this.recipient = recipient;
    }

    public InviteType getType() {
        return type;
    }

    public void setType(InviteType type) {
        this.type = type;
    }

    public InviteStatus getStatus() {
        return status;
    }

    public void setStatus(InviteStatus status) {
        this.status = status;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getDecidedAt() {
        return decidedAt;
    }

    public void setDecidedAt(LocalDateTime decidedAt) {
        this.decidedAt = decidedAt;
    }
}