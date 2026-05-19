package at.model;

import at.dtos.User.UserDTO;
import at.enums.SubscriptionModel;
import at.model.helper.AppTime;
import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "app_user")
public class User {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "auth0_id", unique = true, length = 255)
    private String auth0Id;

    @Column(nullable = false, unique = true, length = 40)
    private String username;

    @Column(nullable = false, unique = true, length = 120)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(name = "subscription_model", nullable = false, length = 40)
    private SubscriptionModel subscriptionModel = SubscriptionModel.FREE;

    @Column(name = "profile_image_url", length = 500)
    private String profileImageUrl;

    @Column(name = "allow_invitations", nullable = false)
    private Boolean allowInvitations = true;

    @Column(name = "preferred_dark_mode")
    private Boolean darkMode;

    @Column(name = "preferred_language", length = 10)
    private String language;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "last_activity_at", nullable = false)
    private LocalDateTime lastActivityAt;

    @Column(name = "locked", nullable = false)
    private Boolean locked = false;


    public User() {
    }

    public User(String username, String email) {
        this.username = username;
        this.email = email;
        this.darkMode = null;
        this.language = null;
        this.locked = false;
    }

    @PrePersist
    public void prePersist() {
        LocalDateTime now = now();
        if (this.createdAt == null) {
            this.createdAt = now;
        }
        this.lastActivityAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        this.lastActivityAt = now();
    }

    @Override
    public String toString() {
        return "User{" +
                "id=" + id +
                ", auth0Id='" + auth0Id + '\'' +
                ", username='" + username + '\'' +
                ", email='" + email + '\'' +
                ", subscriptionModel=" + subscriptionModel +
                ", profileImageUrl='" + profileImageUrl + '\'' +
                ", allowInvitations=" + allowInvitations +
                ", darkMode=" + darkMode +
                ", language='" + language + '\'' +
                ", createdAt=" + createdAt +
                ", lastActivityAt=" + lastActivityAt +
                ", locked=" + locked +
                '}';
    }

    public void newActivity(){
        this.setLastActivityAt(now());
    }

    private static LocalDateTime now() {
        return AppTime.now();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getAuth0Id() {
        return auth0Id;
    }

    public void setAuth0Id(String auth0Id) {
        this.auth0Id = auth0Id;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getLastActivityAt() {
        return lastActivityAt;
    }

    public void setLastActivityAt(LocalDateTime lastActivityAt) {
        this.lastActivityAt = lastActivityAt;
    }

    public boolean isLocked() {
        return locked;
    }

    public void setLocked(boolean locked) {
        this.locked = locked;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public SubscriptionModel getSubscriptionModel() {
        return subscriptionModel;
    }

    public void setSubscriptionModel(SubscriptionModel subscriptionModel) {
        this.subscriptionModel = subscriptionModel;
    }

    public String getProfileImageUrl() {
        return profileImageUrl;
    }

    public void setProfileImageUrl(String profileImageUrl) {
        this.profileImageUrl = profileImageUrl;
    }

    public Boolean isAllowInvitations() {
        return allowInvitations;
    }

    public void setAllowInvitations(Boolean allowInvitations) {
        this.allowInvitations = allowInvitations;
    }

    public Boolean getDarkMode() {
        return darkMode;
    }

    public void setDarkMode(Boolean darkMode) {
        this.darkMode = darkMode;
    }

    public String getLanguage() {
        return language;
    }

    public void setLanguage(String language) {
        this.language = language;
    }

    public UserDTO toUserDTO() {
        return new UserDTO(id, username, getProfileImageUrl());
    }

    public Boolean isAdmin() {
        return subscriptionModel == SubscriptionModel.ADMIN;
    }

    public Boolean getAllowInvitations() {
        return allowInvitations;
    }

    public Boolean getLocked() {
        return locked;
    }

    public void setLocked(Boolean locked) {
        this.locked = locked;
    }
}