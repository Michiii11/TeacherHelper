package at.model;

import at.dtos.User.UserDTO;
import at.enums.SubscriptionModel;
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

    @Column(nullable = false, unique = true, length = 40)
    private String username;

    @Column(nullable = false, unique = true, length = 120)
    private String email;

    @Column(nullable = false, length = 255)
    private String password;

    @Enumerated(EnumType.STRING)
    @Column(name = "subscription_model", nullable = false, length = 40)
    private SubscriptionModel subscriptionModel = SubscriptionModel.FREE;

    @Column(name = "profile_image_url", length = 500)
    private String profileImageUrl;

    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified = false;

    @Column(name = "pending_email", length = 120)
    private String pendingEmail;

    @Column(name = "email_verification_token", length = 120, unique = true)
    private String emailVerificationToken;

    @Column(name = "email_verification_expires_at")
    private LocalDateTime emailVerificationExpiresAt;

    @Column(name = "password_reset_token", length = 120, unique = true)
    private String passwordResetToken;

    @Column(name = "password_reset_expires_at")
    private LocalDateTime passwordResetExpiresAt;

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

    public User(String username, String email, String password) {
        this.username = username;
        this.email = email;
        this.password = password;
        this.emailVerified = false;
        this.darkMode = null;
        this.language = null;

        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.lastActivityAt = now;
        this.locked = false;
    }

    @Override
    public String toString() {
        return "User{" +
                "id=" + id +
                ", username='" + username + '\'' +
                ", email='" + email + '\'' +
                ", password='" + password + '\'' +
                ", subscriptionModel=" + subscriptionModel +
                ", profileImageUrl='" + profileImageUrl + '\'' +
                ", emailVerified=" + emailVerified +
                ", pendingEmail='" + pendingEmail + '\'' +
                ", emailVerificationToken='" + emailVerificationToken + '\'' +
                ", emailVerificationExpiresAt=" + emailVerificationExpiresAt +
                ", passwordResetToken='" + passwordResetToken + '\'' +
                ", passwordResetExpiresAt=" + passwordResetExpiresAt +
                ", allowInvitations=" + allowInvitations +
                ", darkMode=" + darkMode +
                ", language='" + language + '\'' +
                ", createdAt=" + createdAt +
                ", lastActivityAt=" + lastActivityAt +
                ", locked=" + locked +
                '}';
    }

    public void newActivity(){
        this.setLastActivityAt(LocalDateTime.now());
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
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

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
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

    public Boolean isEmailVerified() {
        return emailVerified;
    }

    public void setEmailVerified(Boolean emailVerified) {
        this.emailVerified = emailVerified;
    }

    public String getPendingEmail() {
        return pendingEmail;
    }

    public void setPendingEmail(String pendingEmail) {
        this.pendingEmail = pendingEmail;
    }

    public String getEmailVerificationToken() {
        return emailVerificationToken;
    }

    public void setEmailVerificationToken(String emailVerificationToken) {
        this.emailVerificationToken = emailVerificationToken;
    }

    public LocalDateTime getEmailVerificationExpiresAt() {
        return emailVerificationExpiresAt;
    }

    public void setEmailVerificationExpiresAt(LocalDateTime emailVerificationExpiresAt) {
        this.emailVerificationExpiresAt = emailVerificationExpiresAt;
    }

    public String getPasswordResetToken() {
        return passwordResetToken;
    }

    public void setPasswordResetToken(String passwordResetToken) {
        this.passwordResetToken = passwordResetToken;
    }

    public LocalDateTime getPasswordResetExpiresAt() {
        return passwordResetExpiresAt;
    }

    public void setPasswordResetExpiresAt(LocalDateTime passwordResetExpiresAt) {
        this.passwordResetExpiresAt = passwordResetExpiresAt;
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

    public void setEmailVerified(boolean emailVerified) {
        this.emailVerified = emailVerified;
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