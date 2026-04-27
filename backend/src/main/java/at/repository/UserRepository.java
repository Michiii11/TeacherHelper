package at.repository;

import at.dtos.User.*;
import at.enums.SubscriptionModel;
import at.model.School;
import at.model.Example;
import at.model.Test;
import at.model.User;
import at.security.TokenService;
import at.service.MailService;
import at.service.MediaStorageService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;
import org.jboss.resteasy.reactive.multipart.FileUpload;
import org.mindrot.jbcrypt.BCrypt;

import java.io.IOException;
import java.nio.file.Files;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@ApplicationScoped
@Transactional
public class UserRepository {
    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    private static final long MAX_PROFILE_IMAGE_SIZE = 2L * 1024L * 1024L;
    private static final Set<String> SUPPORTED_LANGUAGES = Set.of("de", "en");

    @Inject
    EntityManager em;

    @Inject
    TokenService tokenService;

    @Inject
    MailService mailService;

    @Inject
    SchoolRepository schoolRepository;

    @Inject
    MediaStorageService mediaStorageService;

    public Response generateResponseOfAuth(String auth) {
        if (auth == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Missing token").build();
        }
        UUID userId = tokenService.validateTokenAndGetUserId(auth);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED).entity("Invalid token").build();
        }

        if (findById(userId) != null) {
            findById(userId).newActivity();
        }
        return null;
    }

    public AuthResult register(FullUserDTO dto) {
        if (dto == null || dto.username() == null || dto.username().isBlank()
                || dto.email() == null || dto.email().isBlank()
                || dto.password() == null || dto.password().isBlank()) {
            return AuthResult.failure("INVALID_DATA", "Username, mail and password are required.");
        }

        String username = dto.username().trim();
        String email = dto.email().trim().toLowerCase();

        if (username.length() < 3 || username.length() > 40) {
            return AuthResult.failure("INVALID_USERNAME", "Username must be between 3 and 40 characters.");
        }

        if (!isValidEmail(email)) {
            return AuthResult.failure("INVALID_EMAIL", "Please enter a valid email address.");
        }

        if (email.length() > 120) {
            return AuthResult.failure("INVALID_EMAIL", "Email is too long.");
        }

        if (dto.password().length() < 8) {
            return AuthResult.failure("INVALID_PASSWORD", "Password must be at least 8 characters long.");
        }

        if (findByUsername(username) != null) {
            return AuthResult.failure("USERNAME_TAKEN", "Username already exists.");
        }

        if (findByEmail(email) != null) {
            return AuthResult.failure("EMAIL_TAKEN", "Email already exists.");
        }

        String hashed = BCrypt.hashpw(dto.password(), BCrypt.gensalt());

        User user = new User(username, email, hashed);
        user.setSubscriptionModel(SubscriptionModel.FREE);
        user.setEmailVerified(false);
        user.setEmailVerificationToken(UUID.randomUUID().toString());
        user.setEmailVerificationExpiresAt(LocalDateTime.now().plusHours(24));
        user.setAllowInvitations(true);
        user.setDarkMode(dto.darkMode());
        user.setLanguage(dto.language());

        em.persist(user);
        mailService.sendRegistrationVerification(user.getEmail(), user.getEmailVerificationToken(), dto.language());

        return new AuthResult(
                true,
                "EMAIL_CONFIRMATION_REQUIRED",
                "Please confirm your email address to complete registration.",
                null,
                null
        );
    }

    public AuthResult login(LoginDTO dto) {
        if (dto == null || dto.email() == null || dto.email().isBlank()
                || dto.password() == null || dto.password().isBlank()) {
            return AuthResult.failure("INVALID_DATA", "Email and password are required.");
        }

        User user = findByEmail(dto.email());
        if (user == null) {
            return AuthResult.failure("INVALID_CREDENTIALS", "Invalid credentials.");
        }

        boolean ok = BCrypt.checkpw(dto.password(), user.getPassword());
        if (!ok) {
            return AuthResult.failure("INVALID_CREDENTIALS", "Invalid credentials.");
        }

        if (!user.isEmailVerified()) {
            return AuthResult.failure("EMAIL_NOT_VERIFIED", "Email is not verified.");
        }

        String token = tokenService.createToken(user.getId());
        return AuthResult.success(user.getId(), token);
    }

    public boolean validateToken(String token) {
        if (token == null || token.isBlank()) return false;

        UUID userId = tokenService.validateTokenAndGetUserId(token);
        if (userId == null) return false;

        try {
            User user = em.find(User.class, userId);
            return user != null;
        } catch (Exception e) {
            return false;
        }
    }

    public Response verifyEmail(String token) {
        if (token == null || token.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Token is required.").build();
        }

        User user = findByVerificationToken(token);
        if (user == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Verification token is invalid.").build();
        }

        if (user.getEmailVerificationExpiresAt() == null
                || user.getEmailVerificationExpiresAt().isBefore(LocalDateTime.now())) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Verification token expired.").build();
        }

        if (user.getPendingEmail() != null && !user.getPendingEmail().isBlank()) {
            user.setEmail(user.getPendingEmail().trim().toLowerCase());
            user.setPendingEmail(null);
        }

        user.setEmailVerified(true);
        user.setEmailVerificationToken(null);
        user.setEmailVerificationExpiresAt(null);
        em.merge(user);

        return Response.ok().build();
    }

    public Response resendVerification(String email, String language) {
        if (email == null || email.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Email is required.").build();
        }

        User user = findByEmail(email);
        if (user == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Email not found.").build();
        }

        if (user.isEmailVerified()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Email is already verified.").build();
        }

        user.setEmailVerificationToken(UUID.randomUUID().toString());
        user.setEmailVerificationExpiresAt(LocalDateTime.now().plusHours(24));
        em.merge(user);

        mailService.sendRegistrationVerification(user.getEmail(), user.getEmailVerificationToken(), language);
        return Response.ok().build();
    }

    public Response deleteAccount(UUID userId, String currentPassword) {
        User user = em.find(User.class, userId);
        if (user == null) return Response.status(Response.Status.NOT_FOUND).entity("User not found.").build();
        if (currentPassword == null || currentPassword.isBlank()) return Response.status(Response.Status.BAD_REQUEST).entity("Current password is required.").build();

        if (!BCrypt.checkpw(currentPassword, user.getPassword())) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Current password is incorrect.").build();
        }

        List<School> schools = em.createQuery(
                "SELECT s FROM School s WHERE s.admin.id = :userId",
                School.class).setParameter("userId", userId).getResultList();

        for (School school : schools) {
            schoolRepository.deleteCollection(school.getId(), userId);
        }

        List<Example> examples = em.createQuery(
                "SELECT e FROM Example e WHERE e.admin.id = :userId",
                Example.class).setParameter("userId", userId).getResultList();

        for(Example example : examples) {
            example.setAdmin(example.getSchool().getAdmin());
        }

        List<Test> tests = em.createQuery(
                "SELECT t FROM Test t WHERE t.admin.id = :userId",
                Test.class).setParameter("userId", userId).getResultList();

        for (Test test : tests) {
            test.setAdmin(test.getSchool().getAdmin());
        }

        if(user.getProfileImageUrl() != null) {
            mediaStorageService.delete(user.getProfileImageUrl());
        }

        em.merge(user);
        em.remove(user);
        return Response.ok().build();
    }

    public Response changePassword(UUID userId, String currentPassword, String newPassword) {
        User user = em.find(User.class, userId);
        if (user == null) return Response.status(Response.Status.NOT_FOUND).entity("User not found.").build();

        if (currentPassword == null || currentPassword.isBlank()
                || newPassword == null || newPassword.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Current and new password are required.").build();
        }

        if (!BCrypt.checkpw(currentPassword, user.getPassword())) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Current password is incorrect.").build();
        }

        if (newPassword.length() < 8) {
            return Response.status(Response.Status.BAD_REQUEST).entity("New password must be at least 8 characters long.").build();
        }

        if (BCrypt.checkpw(newPassword, user.getPassword())) {
            return Response.status(Response.Status.BAD_REQUEST).entity("New password must be different from the current password.").build();
        }

        user.setPassword(BCrypt.hashpw(newPassword, BCrypt.gensalt()));
        em.merge(user);
        return Response.ok().build();
    }

    public Response requestPasswordReset(String email) {
        if (email == null || email.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Email is required.").build();
        }

        User user = findByEmail(email);
        if (user == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("User not found.").build();
        }

        user.setPasswordResetToken(UUID.randomUUID().toString());
        user.setPasswordResetExpiresAt(LocalDateTime.now().plusHours(2));
        em.merge(user);

        mailService.sendPasswordReset(user.getEmail(), user.getPasswordResetToken(), user.getLanguage());
        return Response.ok().build();
    }

    public Response resetPassword(String token, String newPassword) {
        if (token == null || token.isBlank()) return Response.status(Response.Status.BAD_REQUEST).entity("Token is required.").build();
        if (newPassword == null || newPassword.isBlank()) return  Response.status(Response.Status.BAD_REQUEST).entity("New password is required.").build();
        if (newPassword.length() < 8) return Response.status(Response.Status.BAD_REQUEST).entity("New password must be at least 8 characters long.").build();

        User user = findByPasswordResetToken(token);
        if (user == null) return Response.status(Response.Status.BAD_REQUEST).entity("Invalid password reset token.").build();

        if (user.getPasswordResetExpiresAt() == null
                || user.getPasswordResetExpiresAt().isBefore(LocalDateTime.now())) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Password reset token expired.").build();
        }

        user.setPassword(BCrypt.hashpw(newPassword, BCrypt.gensalt()));
        user.setPasswordResetToken(null);
        user.setPasswordResetExpiresAt(null);
        em.merge(user);

        return Response.ok().build();
    }

    public Response updateUsername(UUID userId, String username) {
        User user = em.find(User.class, userId);
        if (user == null) return Response.status(Response.Status.NOT_FOUND).entity("User not found.").build();
        if (username == null || username.isBlank()) return Response.status(Response.Status.BAD_REQUEST).entity("Username is required.").build();

        String normalized = username.trim();
        if (normalized.length() < 3 || normalized.length() > 40) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Username must be between 3 and 40 characters.").build();
        }

        User existing = findByUsername(normalized);
        if (existing != null && !existing.getId().equals(userId)) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Username is already taken.").build();
        }

        user.setUsername(normalized);
        em.merge(user);
        return Response.ok().build();
    }

    public Response requestEmailChange(UUID userId, String email) {
        User user = em.find(User.class, userId);
        if (user == null) return Response.status(Response.Status.NOT_FOUND).entity("User not found.").build();
        if (email == null || email.isBlank()) return Response.status(Response.Status.BAD_REQUEST).entity("Email is required.").build();

        String normalized = email.trim().toLowerCase();

        if (!isValidEmail(normalized)) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Please enter a valid email address.").build();
        }

        if (normalized.length() > 120) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Email is too long.").build();
        }

        User existing = findByEmail(normalized);
        if (existing != null && !existing.getId().equals(userId)) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Email is already taken.").build();
        }

        if (normalized.equals(user.getEmail())) {
            return Response.status(Response.Status.BAD_REQUEST).entity("New email must be different from the current email.").build();
        }

        user.setPendingEmail(normalized);
        user.setEmailVerificationToken(UUID.randomUUID().toString());
        user.setEmailVerificationExpiresAt(LocalDateTime.now().plusHours(24));
        em.merge(user);

        mailService.sendEmailChangeVerification(normalized, user.getEmailVerificationToken(), user.getLanguage());
        return Response.ok().build();
    }

    public Response cancelPendingEmailChange(UUID userId) {
        User user = em.find(User.class, userId);
        if (user == null) return Response.status(Response.Status.NOT_FOUND).entity("User not found.").build();
        if (user.getPendingEmail() == null || user.getPendingEmail().isBlank()) return Response.status(Response.Status.BAD_REQUEST).entity("No pending email change to cancel.").build();

        user.setPendingEmail(null);
        user.setEmailVerificationToken(null);
        user.setEmailVerificationExpiresAt(null);
        em.merge(user);

        return Response.ok().build();
    }

    public Response updateUserSettings(UUID userId, UserSettingsDTO settings) {
        User user = em.find(User.class, userId);
        if (user == null) return Response.status(Response.Status.NOT_FOUND).entity("User not found.").build();
        if (settings == null) return Response.status(Response.Status.BAD_REQUEST).entity("Settings are required.").build();
        if (settings.allowInvitations() == null) return Response.status(Response.Status.BAD_REQUEST).entity("AllowInvitations setting is required.").build();

        String normalizedLanguage = null;
        if (settings.language() != null && !settings.language().isBlank()) {
            normalizedLanguage = settings.language().trim().toLowerCase();
            if (!SUPPORTED_LANGUAGES.contains(normalizedLanguage)) {
                return Response.status(Response.Status.BAD_REQUEST).entity("Unsupported language. Supported languages are: " + String.join(", ", SUPPORTED_LANGUAGES)).build();
            }
        }

        if (settings.darkMode() != null) {
            user.setDarkMode(settings.darkMode());
        }

        if (settings.language() != null) {
            user.setLanguage(normalizedLanguage);
        }

        user.setAllowInvitations(settings.allowInvitations());

        em.merge(user);
        return Response.ok().build();
    }

    public Response uploadProfileImage(UUID userId, FileUpload file) {
        if (file == null || file.fileName() == null || file.fileName().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST).entity("No file uploaded.").build();
        }

        String contentType = file.contentType() == null ? "" : file.contentType().toLowerCase();
        if (!ALLOWED_IMAGE_TYPES.contains(contentType)) {
            return Response.status(Response.Status.BAD_REQUEST).entity("Unsupported file type. Allowed types are: JPEG, PNG, WEBP.").build();
        }

        try {
            if (Files.size(file.uploadedFile()) > MAX_PROFILE_IMAGE_SIZE) {
                return Response.status(Response.Status.BAD_REQUEST).entity("File size exceeds the maximum allowed size of 2MB.").build();
            }

            String objectKey = mediaStorageService.uploadProfileImage(userId, file.uploadedFile(), contentType);
            String result = updateProfileImageUrl(userId, objectKey);

            if (result != null) {
                return Response.status(Response.Status.BAD_REQUEST).entity("Failed to update user profile with the new image.").build();
            }

            return Response.ok(objectKey).build();
        } catch (IOException e) {
            return Response.serverError().entity(e.getMessage()).build();
        }
    }

    public Response getProfileImage(UUID userId) {
        if (userId == null) {
            return Response.status(Response.Status.BAD_REQUEST).build();
        }

        User user = findById(userId);
        if (user == null || user.getProfileImageUrl() == null || user.getProfileImageUrl().isBlank()) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        MediaStorageService.StoredImage image = mediaStorageService.loadImage(user.getProfileImageUrl());
        if (image == null) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }

        return Response.ok(image.data(), image.contentType()).build();
    }

    public Response deleteProfileImage(UUID userId) {
        User user = findById(userId);
        if (user == null || user.getProfileImageUrl() == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("User or profile image not found.").build();
        }

        mediaStorageService.delete(user.getProfileImageUrl());
        updateProfileImageUrl(userId, null);

        return Response.ok().build();
    }

    public String updateProfileImageUrl(UUID userId, String profileImageUrl) {
        User user = em.find(User.class, userId);
        if (user == null) return "USER_NOT_FOUND";

        user.setProfileImageUrl(profileImageUrl);
        em.merge(user);
        return null;
    }

    public Response getAdminDashboard() {
        LocalDateTime now = LocalDateTime.now();

        LocalDateTime oneHourAgo = now.minusHours(1);
        LocalDateTime oneDayAgo = now.minusDays(1);
        LocalDateTime oneWeekAgo = now.minusWeeks(1);
        LocalDateTime oneMonthAgo = now.minusMonths(1);
        LocalDateTime oneYearAgo = now.minusYears(1);

        long amountUsers = countUsers();
        long activeUsersMonth = countUsersLastActiveSince(oneMonthAgo);
        long activeUsersWeek = countUsersLastActiveSince(oneWeekAgo);
        long newUsersMonth = countUsersCreatedSince(oneMonthAgo);

        long freeAbos = countUsersBySubscription("FREE");
        long proAbos = countUsersBySubscription("PRO");
        long schoolAbos = countUsersBySubscription("SCHOOL");

        long cashflow = 0;

        AdminCountPeriodDTO collections = new AdminCountPeriodDTO(
                countCollectionsCreatedSince(oneHourAgo),
                countCollectionsCreatedSince(oneDayAgo),
                countCollectionsCreatedSince(oneWeekAgo),
                countCollectionsCreatedSince(oneMonthAgo),
                countCollectionsCreatedSince(oneYearAgo)
        );

        AdminCountPeriodDTO examples = new AdminCountPeriodDTO(
                countExamplesCreatedSince(oneHourAgo),
                countExamplesCreatedSince(oneDayAgo),
                countExamplesCreatedSince(oneWeekAgo),
                countExamplesCreatedSince(oneMonthAgo),
                countExamplesCreatedSince(oneYearAgo)
        );

        AdminCountPeriodDTO tests = new AdminCountPeriodDTO(
                countTestsCreatedSince(oneHourAgo),
                countTestsCreatedSince(oneDayAgo),
                countTestsCreatedSince(oneWeekAgo),
                countTestsCreatedSince(oneMonthAgo),
                countTestsCreatedSince(oneYearAgo)
        );

        List<User> allUsers = em.createQuery("""
            SELECT u
            FROM User u
            ORDER BY u.createdAt DESC
            """, User.class)
                .getResultList();

        List<AdminUserDashboardDTO> users = allUsers.stream()
                .map(u -> new AdminUserDashboardDTO(
                        u.getId(),
                        u.getUsername(),
                        u.getCreatedAt(),
                        u.getLastActivityAt(),
                        countCollectionsByUser(u),
                        countExamplesByUser(u),
                        countTestsByUser(u)
                ))
                .toList();

        AdminDashboardDTO dashboardData = new AdminDashboardDTO(
                amountUsers,
                activeUsersMonth,
                activeUsersWeek,
                newUsersMonth,
                freeAbos,
                proAbos,
                schoolAbos,
                cashflow,
                collections,
                examples,
                tests,
                users
        );

        return Response.ok(dashboardData).build();
    }




    public User findByEmail(String email) {
        try {
            return em.createQuery(
                            "SELECT u FROM User u WHERE lower(u.email) = :email",
                            User.class
                    )
                    .setParameter("email", email.toLowerCase().trim())
                    .getSingleResult();
        } catch (NoResultException e) {
            return null;
        }
    }

    public User findByUsername(String username) {
        try {
            return em.createQuery(
                            "SELECT u FROM User u WHERE lower(u.username) = :username",
                            User.class
                    )
                    .setParameter("username", username.toLowerCase().trim())
                    .getSingleResult();
        } catch (NoResultException e) {
            return null;
        }
    }

    public User findByVerificationToken(String token) {
        try {
            return em.createQuery(
                            "SELECT u FROM User u WHERE u.emailVerificationToken = :token",
                            User.class
                    )
                    .setParameter("token", token)
                    .getSingleResult();
        } catch (NoResultException e) {
            return null;
        }
    }

    public User findByPasswordResetToken(String token) {
        try {
            return em.createQuery(
                            "SELECT u FROM User u WHERE u.passwordResetToken = :token",
                            User.class
                    )
                    .setParameter("token", token)
                    .getSingleResult();
        } catch (NoResultException e) {
            return null;
        }
    }

    public User findById(UUID userId) {
        if (userId == null) return null;
        User user = em.find(User.class, userId);
        return user == null ? null : user;
    }

    public UserProfileDTO toProfileDTO(User user) {
        if (user == null) return null;

        return new UserProfileDTO(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.isEmailVerified(),
                user.getPendingEmail(),
                user.getSubscriptionModel(),
                user.getProfileImageUrl(),
                new UserSettingsDTO(
                        user.getDarkMode(),
                        user.getLanguage(),
                        user.isAllowInvitations()
                )
        );
    }

    private boolean isValidEmail(String email) {
        return email != null && email.matches("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$");
    }

    private long countUsers() {
        return em.createQuery("SELECT COUNT(u) FROM User u", Long.class)
                .getSingleResult();
    }

    private long countUsersLastActiveSince(LocalDateTime since) {
        return em.createQuery("""
            SELECT COUNT(u)
            FROM User u
            WHERE u.lastActivityAt >= :since
            """, Long.class)
                .setParameter("since", since)
                .getSingleResult();
    }

    private long countUsersCreatedSince(LocalDateTime since) {
        return em.createQuery("""
            SELECT COUNT(u)
            FROM User u
            WHERE u.createdAt >= :since
            """, Long.class)
                .setParameter("since", since)
                .getSingleResult();
    }

    private long countUsersBySubscription(String subscriptionModel) {
        return em.createQuery("""
            SELECT COUNT(u)
            FROM User u
            WHERE u.subscriptionModel = :subscriptionModel
            """, Long.class)
                .setParameter("subscriptionModel", at.enums.SubscriptionModel.valueOf(subscriptionModel))
                .getSingleResult();
    }

    private long countCollectionsCreatedSince(LocalDateTime since) {
        return em.createQuery("""
            SELECT COUNT(f)
            FROM School f
            WHERE f.createdAt >= :since
            """, Long.class)
                .setParameter("since", since)
                .getSingleResult();
    }

    private long countExamplesCreatedSince(LocalDateTime since) {
        return em.createQuery("""
            SELECT COUNT(e)
            FROM Example e
            WHERE e.createdAt >= :since
            """, Long.class)
                .setParameter("since", since)
                .getSingleResult();
    }

    private long countTestsCreatedSince(LocalDateTime since) {
        return em.createQuery("""
            SELECT COUNT(t)
            FROM Test t
            WHERE t.createdAt >= :since
            """, Long.class)
                .setParameter("since", since)
                .getSingleResult();
    }

    private long countCollectionsByUser(User user) {
        return em.createQuery("""
            SELECT COUNT(f)
            FROM School f
            WHERE f.admin = :user
            """, Long.class)
                .setParameter("user", user)
                .getSingleResult();
    }

    private long countExamplesByUser(User user) {
        return em.createQuery("""
            SELECT COUNT(e)
            FROM Example e
            WHERE e.admin = :user
            """, Long.class)
                .setParameter("user", user)
                .getSingleResult();
    }

    private long countTestsByUser(User user) {
        return em.createQuery("""
            SELECT COUNT(t)
            FROM Test t
            WHERE t.admin = :user
            """, Long.class)
                .setParameter("user", user)
                .getSingleResult();
    }
}