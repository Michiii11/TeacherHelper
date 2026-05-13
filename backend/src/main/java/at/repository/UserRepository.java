package at.repository;

import at.dtos.Collection.CollectionDTO;
import at.dtos.Example.ExampleOverviewDTO;
import at.dtos.Test.TestOverviewDTO;
import at.dtos.User.*;
import at.enums.SubscriptionModel;
import at.model.Collection;
import at.model.Example;
import at.model.Test;
import at.model.User;
import at.service.Auth0ManagementService;
import at.service.MediaStorageService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import org.jboss.resteasy.reactive.multipart.FileUpload;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.io.IOException;
import java.nio.file.Files;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.security.SecureRandom;

@ApplicationScoped
@Transactional
public class UserRepository {
    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    private static final long MAX_PROFILE_IMAGE_SIZE = 2L * 1024L * 1024L;
    private static final Set<String> SUPPORTED_LANGUAGES = Set.of("de", "en");
    private static final SecureRandom CODE_RANDOM = new SecureRandom();
    private static final ZoneId APP_ZONE = ZoneId.of("Europe/Vienna");

    @Inject
    EntityManager em;

    @Inject
    CollectionRepository collectionRepository;

    @Inject
    MediaStorageService mediaStorageService;

    @Inject
    Auth0ManagementService auth0ManagementService;

    public Response getUsernames() {
        List<String> usernames = em.createQuery("SELECT u.username FROM User u", String.class)
                .getResultList();
        return Response.ok(usernames).build();
    }

    public Response deleteAccount(UUID userId) {
        User user = em.find(User.class, userId);
        if (user == null) {
            return Response.status(Response.Status.NOT_FOUND).entity("User not found.").build();
        }

        String auth0Id = user.getAuth0Id();

        List<Collection> collections = em.createQuery(
                "SELECT s FROM Collection s WHERE s.admin.id = :userId",
                Collection.class
        ).setParameter("userId", userId).getResultList();

        for (Collection collection : collections) {
            collectionRepository.deleteCollection(collection.getId(), userId);
        }

        List<Example> examples = em.createQuery(
                "SELECT e FROM Example e WHERE e.admin.id = :userId",
                Example.class
        ).setParameter("userId", userId).getResultList();

        for (Example example : examples) {
            example.setAdmin(example.getCollection().getAdmin());
        }

        List<Test> tests = em.createQuery(
                "SELECT t FROM Test t WHERE t.admin.id = :userId",
                Test.class
        ).setParameter("userId", userId).getResultList();

        for (Test test : tests) {
            test.setAdmin(test.getCollection().getAdmin());
        }

        if (user.getProfileImageUrl() != null) {
            mediaStorageService.delete(user.getProfileImageUrl());
        }

        em.remove(user);
        em.flush();

        auth0ManagementService.deleteUser(auth0Id);

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
        LocalDateTime now = now();

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
                        u.getProfileImageUrl(),
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

    public Response getUserAdminDashboard(UUID id) {
        User user = em.find(User.class, id);
        if (user == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("User not found.")
                    .build();
        }

        List<Collection> collections = em.createQuery(
                """
                SELECT DISTINCT c
                FROM Collection c
                LEFT JOIN FETCH c.users
                WHERE c.admin.id = :userId
                ORDER BY c.name
                """,
                Collection.class
        ).setParameter("userId", id).getResultList();

        List<CollectionDTO> collectionDTOs = collections.stream()
                .map(collection -> {
                    List<ExampleOverviewDTO> examples = em.createQuery(
                                    """
                                    SELECT DISTINCT e
                                    FROM Example e
                                    LEFT JOIN FETCH e.focusList
                                    LEFT JOIN FETCH e.admin
                                    LEFT JOIN FETCH e.folder
                                    WHERE e.collection.id = :collectionId
                                    ORDER BY e.createdAt DESC
                                    """,
                                    Example.class
                            )
                            .setParameter("collectionId", collection.getId())
                            .getResultList()
                            .stream()
                            .map(e -> new ExampleOverviewDTO(
                                    e.getId(),
                                    e.getType(),
                                    e.getInstruction(),
                                    e.getQuestion(),
                                    e.getAdmin() != null ? e.getAdmin().getUsername() : null,
                                    e.getAdmin() != null ? e.getAdmin().getId() : null,
                                    e.getFocusList() != null
                                            ? new java.util.LinkedList<>(e.getFocusList())
                                            : List.of(),
                                    e.getFolder() != null ? e.getFolder().getId() : null,
                                    e.getCreatedAt(),
                                    e.getUpdatedAt()
                            ))
                            .toList();

                    List<TestOverviewDTO> tests = em.createQuery(
                                    """
                                    SELECT DISTINCT t
                                    FROM Test t
                                    LEFT JOIN FETCH t.admin
                                    LEFT JOIN FETCH t.folder
                                    WHERE t.collection.id = :collectionId
                                    ORDER BY t.createdAt DESC
                                    """,
                                    Test.class
                            )
                            .setParameter("collectionId", collection.getId())
                            .getResultList()
                            .stream()
                            .map(t -> new TestOverviewDTO(
                                    t.getId(),
                                    t.getName(),
                                    t.getExampleList() != null ? t.getExampleList().size() : 0,
                                    t.getDuration(),
                                    t.getAdmin() != null ? t.getAdmin().getUsername() : null,
                                    t.getAdmin() != null ? t.getAdmin().getId() : null,
                                    t.getCreatedAt(),
                                    t.getUpdatedAt(),
                                    t.getFolder() != null ? t.getFolder().getId() : null
                            ))
                            .toList();

                    return collection.toDTOFull(examples, tests);
                })
                .toList();

        AdminUserDetailDTO dto = new AdminUserDetailDTO(
                user.getId(),
                collectionDTOs
        );

        return Response.ok(dto).build();
    }




    public User getOrCreateAuth0User(JsonWebToken jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            throw new WebApplicationException("Missing Auth0 subject", Response.Status.UNAUTHORIZED);
        }

        String auth0Id = jwt.getSubject();

        lockAuth0UserCreation(auth0Id);

        User existingByAuth0Id = findByAuth0Id(auth0Id);
        if (existingByAuth0Id != null) {
            existingByAuth0Id.newActivity();
            return em.merge(existingByAuth0Id);
        }

        String email = normalizeEmail(readStringClaim(
                jwt,
                "https://teacher-helper.at/email",
                "email"
        ));

        if (email == null || email.isBlank()) {
            throw new WebApplicationException(
                    "Auth0 token does not contain email.",
                    Response.Status.BAD_REQUEST
            );
        }

        User existingByEmail = findByEmail(email);
        if (existingByEmail != null) {
            existingByEmail.setAuth0Id(auth0Id);
            existingByEmail.newActivity();
            return em.merge(existingByEmail);
        }

        String emailPrefix = email.contains("@")
                ? email.substring(0, email.indexOf("@"))
                : email;

        User user = new User();
        user.setAuth0Id(auth0Id);
        user.setEmail(email);
        user.setUsername(resolveUniqueUsername(emailPrefix));
        user.setSubscriptionModel(SubscriptionModel.FREE);
        user.setAllowInvitations(true);
        user.setLocked(false);

        em.persist(user);
        em.flush();

        return user;
    }

    private void lockAuth0UserCreation(String auth0Id) {
        em.createNativeQuery("SELECT pg_advisory_xact_lock(hashtext(:lockKey))")
                .setParameter("lockKey", "auth0-user:" + auth0Id)
                .getSingleResult();
    }

    private String readStringClaim(JsonWebToken jwt, String... claimNames) {
        for (String claimName : claimNames) {
            Object value = jwt.getClaim(claimName);
            if (value instanceof String text && !text.isBlank()) {
                return text;
            }
        }
        return null;
    }

    public User findByAuth0Id(String auth0Id) {
        if (auth0Id == null || auth0Id.isBlank()) {
            return null;
        }

        try {
            return em.createQuery(
                            "SELECT u FROM User u WHERE u.auth0Id = :auth0Id",
                            User.class
                    )
                    .setParameter("auth0Id", auth0Id)
                    .getSingleResult();
        } catch (NoResultException e) {
            return null;
        }
    }

    private String normalizeEmail(String email) {
        if (email == null || email.isBlank()) {
            return null;
        }
        return email.trim().toLowerCase();
    }

    private String resolveUniqueUsername(String preferredName) {
        String base = sanitizeUsername(preferredName);
        if (base.isBlank()) {
            base = "user";
        }

        String candidate = trimUsername(base);
        if (findByUsername(candidate) == null) {
            return candidate;
        }

        if (findByUsername(candidate) == null) {
            return candidate;
        }

        while (true) {
            candidate = trimUsername(base);
            if (findByUsername(candidate) == null) {
                return candidate;
            }
        }
    }

    private String sanitizeUsername(String value) {
        if (value == null) {
            return "user";
        }

        String normalized = value
                .trim()
                .toLowerCase()
                .replaceAll("[^a-z0-9._-]", "-")
                .replaceAll("-+", "-")
                .replaceAll("^-|-$", "");

        if (normalized.length() < 3) {
            normalized = (normalized + "-user").replaceAll("^-|-$", "");
        }

        return normalized;
    }

    private String trimUsername(String value) {
        return trimUsername(value, 0);
    }

    private String trimUsername(String value, int reservedLength) {
        int maxLength = Math.max(3, 40 - reservedLength);
        String trimmed = value.length() <= maxLength ? value : value.substring(0, maxLength);
        return trimmed.replaceAll("^-|-$", "");
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
                user.getSubscriptionModel(),
                user.getProfileImageUrl(),
                new UserSettingsDTO(
                        user.getDarkMode(),
                        user.getLanguage(),
                        user.isAllowInvitations()
                )
        );
    }

    private LocalDateTime now() {
        return LocalDateTime.now(APP_ZONE);
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
            FROM Collection f
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
            FROM Collection f
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