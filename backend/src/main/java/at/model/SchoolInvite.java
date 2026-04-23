package at.model;

import at.enums.SchoolInviteStatus;
import at.enums.SchoolInviteType;
import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
public class SchoolInvite {
    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(optional = false)
    private School school;

    @ManyToOne(optional = false)
    private User sender;

    @ManyToOne(optional = false)
    private User recipient;

    @Enumerated(EnumType.STRING)
    private SchoolInviteType type;

    @Enumerated(EnumType.STRING)
    private SchoolInviteStatus status = SchoolInviteStatus.PENDING;

    @Column(length = 1000)
    private String message;

    private LocalDateTime createdAt;
    private LocalDateTime decidedAt;

    public SchoolInvite() {
    }

    public SchoolInvite(School school, User sender, User recipient, SchoolInviteType type, String message) {
        this.school = school;
        this.sender = sender;
        this.recipient = recipient;
        this.type = type;
        this.message = message;
        this.createdAt = LocalDateTime.now();
    }

    @Override
    public String toString() {
        return "SchoolInvite{" +
                "id=" + id +
                ", school=" + school +
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

    public School getSchool() {
        return school;
    }

    public void setSchool(School school) {
        this.school = school;
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

    public SchoolInviteType getType() {
        return type;
    }

    public void setType(SchoolInviteType type) {
        this.type = type;
    }

    public SchoolInviteStatus getStatus() {
        return status;
    }

    public void setStatus(SchoolInviteStatus status) {
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