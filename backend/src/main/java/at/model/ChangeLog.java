package at.model;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
public class ChangeLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String entityType; // EXAMPLE, TEST, SCHOOL
    private Long entityId;
    private String action; // CREATE, UPDATE, DELETE

    @ManyToOne
    private User user;

    @ManyToOne
    private School school;

    private Instant createdAt;

    public ChangeLog() {}

    public ChangeLog(String entityType, Long entityId, String action, User user, School school) {
        this.entityType = entityType;
        this.entityId = entityId;
        this.action = action;
        this.user = user;
        this.school = school;
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getEntityType() {
        return entityType;
    }

    public void setEntityType(String entityType) {
        this.entityType = entityType;
    }

    public Long getEntityId() {
        return entityId;
    }

    public void setEntityId(Long entityId) {
        this.entityId = entityId;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public School getSchool() {
        return school;
    }

    public void setSchool(School school) {
        this.school = school;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
