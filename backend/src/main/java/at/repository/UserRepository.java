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
import org.mindrot.jbcrypt.BCrypt;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@ApplicationScoped
public class UserRepository {

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

    @Transactional
    public User save(User user) {
        em.persist(user);
        return user;
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

    @Transactional
    public AuthResult register(FullUserDTO dto, String language) {
        if (dto == null || dto.username() == null || dto.username().isBlank()
                || dto.email() == null || dto.email().isBlank()
                || dto.password() == null || dto.password().isBlank()) {
            return AuthResult.failure("INVALID_DATA", "Username, E-Mail und Passwort sind erforderlich.");
        }

        String username = dto.username().trim();
        String email = dto.email().trim().toLowerCase();

        if (username.length() < 3 || username.length() > 40) {
            return AuthResult.failure("INVALID_USERNAME", "Der Benutzername muss zwischen 3 und 40 Zeichen lang sein.");
        }

        if (!isValidEmail(email)) {
            return AuthResult.failure("INVALID_EMAIL", "Bitte eine gültige E-Mail eingeben.");
        }

        if (email.length() > 120) {
            return AuthResult.failure("INVALID_EMAIL", "Die E-Mail ist zu lang.");
        }

        if (dto.password().length() < 8) {
            return AuthResult.failure("INVALID_PASSWORD", "Das Passwort muss mindestens 8 Zeichen lang sein.");
        }

        if (findByUsername(username) != null) {
            return AuthResult.failure("USERNAME_TAKEN", "Der Benutzername ist bereits vergeben.");
        }

        if (findByEmail(email) != null) {
            return AuthResult.failure("EMAIL_TAKEN", "Die E-Mail ist bereits registriert.");
        }

        String hashed = BCrypt.hashpw(dto.password(), BCrypt.gensalt());

        User user = new User(username, email, hashed);
        user.setSubscriptionModel(SubscriptionModel.FREE);
        user.setEmailVerified(false);
        user.setEmailVerificationToken(UUID.randomUUID().toString());
        user.setEmailVerificationExpiresAt(LocalDateTime.now().plusHours(24));
        user.setAllowInvitations(true);
        user.setDarkMode(null);
        user.setLanguage(null);

        save(user);
        mailService.sendRegistrationVerification(user.getEmail(), user.getEmailVerificationToken(), language);

        return new AuthResult(
                true,
                "EMAIL_CONFIRMATION_REQUIRED",
                "Registrierung erfolgreich. Bitte bestätige jetzt deine E-Mail.",
                null,
                null
        );
    }

    public AuthResult login(LoginDTO dto) {
        if (dto == null || dto.email() == null || dto.email().isBlank()
                || dto.password() == null || dto.password().isBlank()) {
            return AuthResult.failure("INVALID_DATA", "E-Mail und Passwort sind erforderlich.");
        }

        User user = findByEmail(dto.email());
        if (user == null) {
            return AuthResult.failure("INVALID_CREDENTIALS", "Ungültige Zugangsdaten.");
        }

        boolean ok = BCrypt.checkpw(dto.password(), user.getPassword());
        if (!ok) {
            return AuthResult.failure("INVALID_CREDENTIALS", "Ungültige Zugangsdaten.");
        }

        if (!user.isEmailVerified()) {
            return AuthResult.failure("EMAIL_NOT_VERIFIED", "Bitte bestätige zuerst deine E-Mail-Adresse.");
        }

        String token = tokenService.createToken(user.getId());
        return AuthResult.success(user.getId(), token);
    }

    @Transactional
    public String verifyEmail(String token) {
        if (token == null || token.isBlank()) {
            return "TOKEN_REQUIRED";
        }

        User user = findByVerificationToken(token);
        if (user == null) {
            return "TOKEN_INVALID";
        }

        if (user.getEmailVerificationExpiresAt() == null
                || user.getEmailVerificationExpiresAt().isBefore(LocalDateTime.now())) {
            return "TOKEN_EXPIRED";
        }

        if (user.getPendingEmail() != null && !user.getPendingEmail().isBlank()) {
            user.setEmail(user.getPendingEmail().trim().toLowerCase());
            user.setPendingEmail(null);
        }

        user.setEmailVerified(true);
        user.setEmailVerificationToken(null);
        user.setEmailVerificationExpiresAt(null);
        em.merge(user);

        return null;
    }

    @Transactional
    public String resendVerification(String email, String language) {
        if (email == null || email.isBlank()) {
            return "EMAIL_REQUIRED";
        }

        User user = findByEmail(email);
        if (user == null) {
            return "USER_NOT_FOUND";
        }

        if (user.isEmailVerified()) {
            return "ALREADY_VERIFIED";
        }

        user.setEmailVerificationToken(UUID.randomUUID().toString());
        user.setEmailVerificationExpiresAt(LocalDateTime.now().plusHours(24));
        em.merge(user);

        mailService.sendRegistrationVerification(user.getEmail(), user.getEmailVerificationToken(), language);
        return null;
    }

    @Transactional
    public String updateUsername(UUID userId, String username) {
        User user = em.find(User.class, userId);
        if (user == null) return "USER_NOT_FOUND";
        if (username == null || username.isBlank()) return "USERNAME_REQUIRED";

        String normalized = username.trim();
        if (normalized.length() < 3 || normalized.length() > 40) {
            return "USERNAME_INVALID_LENGTH";
        }

        User existing = findByUsername(normalized);
        if (existing != null && !existing.getId().equals(userId)) {
            return "USERNAME_TAKEN";
        }

        user.setUsername(normalized);
        em.merge(user);
        return null;
    }

    @Transactional
    public String requestEmailChange(UUID userId, String email) {
        User user = em.find(User.class, userId);
        if (user == null) return "USER_NOT_FOUND";
        if (email == null || email.isBlank()) return "EMAIL_REQUIRED";

        String normalized = email.trim().toLowerCase();

        if (!isValidEmail(normalized)) {
            return "EMAIL_INVALID";
        }

        if (normalized.length() > 120) {
            return "EMAIL_TOO_LONG";
        }

        User existing = findByEmail(normalized);
        if (existing != null && !existing.getId().equals(userId)) {
            return "EMAIL_TAKEN";
        }

        if (normalized.equals(user.getEmail())) {
            return "EMAIL_SAME";
        }

        user.setPendingEmail(normalized);
        user.setEmailVerificationToken(UUID.randomUUID().toString());
        user.setEmailVerificationExpiresAt(LocalDateTime.now().plusHours(24));
        em.merge(user);

        mailService.sendEmailChangeVerification(normalized, user.getEmailVerificationToken(), user.getLanguage());
        return null;
    }

    @Transactional
    public String cancelPendingEmailChange(UUID userId) {
        User user = em.find(User.class, userId);
        if (user == null) return "USER_NOT_FOUND";
        if (user.getPendingEmail() == null || user.getPendingEmail().isBlank()) return "NO_PENDING_EMAIL";

        user.setPendingEmail(null);
        user.setEmailVerificationToken(null);
        user.setEmailVerificationExpiresAt(null);
        em.merge(user);

        return null;
    }

    @Transactional
    public String changePassword(UUID userId, String currentPassword, String newPassword) {
        User user = em.find(User.class, userId);
        if (user == null) return "USER_NOT_FOUND";

        if (currentPassword == null || currentPassword.isBlank()
                || newPassword == null || newPassword.isBlank()) {
            return "PASSWORD_REQUIRED";
        }

        if (!BCrypt.checkpw(currentPassword, user.getPassword())) {
            return "CURRENT_PASSWORD_INVALID";
        }

        if (newPassword.length() < 8) {
            return "NEW_PASSWORD_TOO_SHORT";
        }

        if (BCrypt.checkpw(newPassword, user.getPassword())) {
            return "PASSWORD_EQUAL";
        }

        user.setPassword(BCrypt.hashpw(newPassword, BCrypt.gensalt()));
        em.merge(user);
        return null;
    }

    @Transactional
    public String requestPasswordReset(String email) {
        if (email == null || email.isBlank()) {
            return "EMAIL_REQUIRED";
        }

        User user = findByEmail(email);
        if (user == null) {
            return null;
        }

        user.setPasswordResetToken(UUID.randomUUID().toString());
        user.setPasswordResetExpiresAt(LocalDateTime.now().plusHours(2));
        em.merge(user);

        mailService.sendPasswordReset(user.getEmail(), user.getPasswordResetToken(), user.getLanguage());
        return null;
    }

    @Transactional
    public String resetPassword(String token, String newPassword) {
        if (token == null || token.isBlank()) return "TOKEN_REQUIRED";
        if (newPassword == null || newPassword.isBlank()) return "PASSWORD_REQUIRED";
        if (newPassword.length() < 8) return "NEW_PASSWORD_TOO_SHORT";

        User user = findByPasswordResetToken(token);
        if (user == null) return "TOKEN_INVALID";

        if (user.getPasswordResetExpiresAt() == null
                || user.getPasswordResetExpiresAt().isBefore(LocalDateTime.now())) {
            return "TOKEN_EXPIRED";
        }

        user.setPassword(BCrypt.hashpw(newPassword, BCrypt.gensalt()));
        user.setPasswordResetToken(null);
        user.setPasswordResetExpiresAt(null);
        em.merge(user);

        return null;
    }

    @Transactional
    public String updateProfileImageUrl(UUID userId, String profileImageUrl) {
        User user = em.find(User.class, userId);
        if (user == null) return "USER_NOT_FOUND";

        user.setProfileImageUrl(profileImageUrl);
        em.merge(user);
        return null;
    }

    @Transactional
    public String updateSubscription(UUID userId, SubscriptionModel subscriptionModel) {
        User user = em.find(User.class, userId);
        if (user == null) return "USER_NOT_FOUND";
        if (subscriptionModel == null) return "SUBSCRIPTION_REQUIRED";

        user.setSubscriptionModel(subscriptionModel);
        em.merge(user);
        return null;
    }

    @Transactional
    public String updateUserSettings(UUID userId, UserSettingsDTO settings) {
        User user = em.find(User.class, userId);
        if (user == null) return "USER_NOT_FOUND";
        if (settings == null) return "SETTINGS_REQUIRED";
        if (settings.allowInvitations() == null) return "ALLOW_INVITATIONS_REQUIRED";

        String normalizedLanguage = null;
        if (settings.language() != null && !settings.language().isBlank()) {
            normalizedLanguage = settings.language().trim().toLowerCase();
            if (!SUPPORTED_LANGUAGES.contains(normalizedLanguage)) {
                return "LANGUAGE_INVALID";
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
        return null;
    }

    @Transactional
    public String updateAllowInvitations(UUID userId, Boolean allowInvitations) {
        User user = em.find(User.class, userId);
        if (user == null) return "USER_NOT_FOUND";
        if (allowInvitations == null) return "ALLOW_INVITATIONS_REQUIRED";

        user.setAllowInvitations(allowInvitations);
        em.merge(user);
        return null;
    }

    @Transactional
    public String deleteAccount(UUID userId, String currentPassword) {
        User user = em.find(User.class, userId);
        if (user == null) return "USER_NOT_FOUND";
        if (currentPassword == null || currentPassword.isBlank()) return "PASSWORD_REQUIRED";

        if (!BCrypt.checkpw(currentPassword, user.getPassword())) {
            return "CURRENT_PASSWORD_INVALID";
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
        return null;
    }

    private boolean isValidEmail(String email) {
        return email != null && email.matches("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$");
    }

    @Transactional
    public String setUserLocked(UUID targetUserId, boolean locked) {
        User user = em.find(User.class, targetUserId);
        if (user == null) return "USER_NOT_FOUND";

        user.setLocked(locked);
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
                countExamplesCreatedSince(toTimestamp(oneHourAgo)),
                countExamplesCreatedSince(toTimestamp(oneDayAgo)),
                countExamplesCreatedSince(toTimestamp(oneWeekAgo)),
                countExamplesCreatedSince(toTimestamp(oneMonthAgo)),
                countExamplesCreatedSince(toTimestamp(oneYearAgo))
        );

        AdminCountPeriodDTO tests = new AdminCountPeriodDTO(
                countTestsCreatedSince(toTimestamp(oneHourAgo)),
                countTestsCreatedSince(toTimestamp(oneDayAgo)),
                countTestsCreatedSince(toTimestamp(oneWeekAgo)),
                countTestsCreatedSince(toTimestamp(oneMonthAgo)),
                countTestsCreatedSince(toTimestamp(oneYearAgo))
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

    private java.sql.Timestamp toTimestamp(LocalDateTime dateTime) {
        return java.sql.Timestamp.valueOf(dateTime);
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

    private long countExamplesCreatedSince(java.sql.Timestamp since) {
        return em.createQuery("""
            SELECT COUNT(e)
            FROM Example e
            WHERE e.createdAt >= :since
            """, Long.class)
                .setParameter("since", since)
                .getSingleResult();
    }

    private long countTestsCreatedSince(java.sql.Timestamp since) {
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