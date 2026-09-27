package at.repository;

import at.dtos.Collection.CollectionDTO;
import at.dtos.Example.ExampleOverviewDTO;
import at.dtos.Folder.FolderDTO;
import at.dtos.Test.TestOverviewDTO;
import at.dtos.User.*;
import at.enums.PaymentStatus;
import at.enums.SubscriptionModel;
import at.enums.SubscriptionSource;
import at.enums.SubscriptionStatus;
import at.model.*;
import at.model.helper.AppTime;
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
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.security.SecureRandom;
import org.jboss.logging.Logger;

@ApplicationScoped
@Transactional
public class UserRepository {
    private static final Logger LOG = Logger.getLogger(UserRepository.class);
    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    private static final long MAX_PROFILE_IMAGE_SIZE = 2L * 1024L * 1024L;
    private static final Set<String> SUPPORTED_LANGUAGES = Set.of("de", "en");
    private static final SecureRandom CODE_RANDOM = new SecureRandom();
    private static final Duration ACTIVITY_WRITE_INTERVAL = Duration.ofMinutes(5);

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
        LOG.infof("event=user.delete.started userId=%s", userId);

        /*
         * Delete collections owned by the user first. CollectionRepository
         * already removes the collection's tests, examples, folders, invites
         * and related data.
         */
        List<Collection> ownedCollections = em.createQuery(
                "SELECT c FROM Collection c WHERE c.admin.id = :userId",
                Collection.class
        ).setParameter("userId", userId).getResultList();

        for (Collection collection : ownedCollections) {
            collectionRepository.deleteCollection(collection.getId(), userId);
        }

        /*
         * Keep a managed User instance for the remaining cleanup. Collection
         * deletion used to clear the persistence context and could leave this
         * entity detached, which later caused em.remove(user) to fail.
         */
        user = em.find(User.class, userId);
        if (user == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity("User not found after collection cleanup.")
                    .build();
        }

        /*
         * Content created by this user inside somebody else's collection stays
         * with the collection and is reassigned to that collection's admin.
         */
        List<Example> examples = em.createQuery(
                "SELECT e FROM Example e WHERE e.admin.id = :userId",
                Example.class
        ).setParameter("userId", userId).getResultList();

        for (Example example : examples) {
            if (example.getCollection() != null && example.getCollection().getAdmin() != null) {
                example.setAdmin(example.getCollection().getAdmin());
            }
        }

        List<Test> tests = em.createQuery(
                "SELECT t FROM Test t WHERE t.admin.id = :userId",
                Test.class
        ).setParameter("userId", userId).getResultList();

        for (Test test : tests) {
            if (test.getCollection() != null && test.getCollection().getAdmin() != null) {
                test.setAdmin(test.getCollection().getAdmin());
            }
        }

        /*
         * Remove the user from collections owned by other users. This clears
         * rows in the collection_members join table before deleting User.
         */
        List<Collection> memberCollections = em.createQuery(
                "SELECT DISTINCT c FROM Collection c JOIN c.users u WHERE u.id = :userId",
                Collection.class
        ).setParameter("userId", userId).getResultList();

        for (Collection collection : memberCollections) {
            collection.removeUser(user);
        }

        em.flush();

        /*
         * Explicitly clear all remaining foreign-key references to User.
         * Payment records are removed locally with the account; Stripe remains
         * the authoritative billing/invoice record.
         */
        int deletedNotifications = em.createQuery(
                "DELETE FROM Notification n WHERE n.recipient.id = :userId OR n.actor.id = :userId"
        ).setParameter("userId", userId).executeUpdate();

        int deletedInvites = em.createQuery(
                "DELETE FROM CollectionInvite i WHERE i.sender.id = :userId OR i.recipient.id = :userId"
        ).setParameter("userId", userId).executeUpdate();

        int deletedPayments = em.createQuery(
                "DELETE FROM PaymentRecord p WHERE p.user.id = :userId"
        ).setParameter("userId", userId).executeUpdate();

        em.flush();

        if (user.getProfileImageUrl() != null) {
            mediaStorageService.delete(user.getProfileImageUrl());
        }

        User managedUser = em.contains(user)
                ? user
                : em.find(User.class, userId);

        if (managedUser != null) {
            em.remove(managedUser);
            em.flush();
        }

        if (auth0Id != null && !auth0Id.isBlank()) {
            auth0ManagementService.deleteUser(auth0Id);
        }

        LOG.infof(
                "event=user.deleted userId=%s notifications=%s invites=%s payments=%s",
                userId,
                deletedNotifications,
                deletedInvites,
                deletedPayments
        );
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
        LOG.infof("event=user.username.updated userId=%s", userId);
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

            LOG.infof("event=user.profile-image.uploaded userId=%s", userId);
            return Response.ok(objectKey).build();
        } catch (IOException e) {
            LOG.errorf(e, "event=user.profile-image.upload.failed userId=%s", userId);
            return Response.serverError().entity("Profile image upload failed.").build();
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

        LOG.infof("event=user.profile-image.deleted userId=%s", userId);
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

        long revenueTotalCents = sumPaymentsByStatus(PaymentStatus.PAID);
        long revenueMonthCents = sumPaymentsByStatusSince(PaymentStatus.PAID, oneMonthAgo);
        long successfulPayments = countPaymentsByStatus(PaymentStatus.PAID);
        long failedPayments = countPaymentsByStatus(PaymentStatus.FAILED);
        long schoolSeatsTotal = sumSchoolSeats();

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
                        countTestsByUser(u),

                        u.getSubscriptionModel(),
                        u.getSubscriptionStatus(),
                        u.getSubscriptionSource(),

                        u.getSubscriptionSeats(),
                        u.getSubscriptionValidUntil(),
                        u.getSubscriptionPeriodStart(),
                        u.getSubscriptionPeriodEnd(),
                        u.getCancelAtPeriodEnd(),

                        u.isLocked(),

                        countSuccessfulPaymentsByUser(u),
                        sumSuccessfulPaymentsByUser(u)
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
                revenueTotalCents,
                revenueMonthCents,
                successfulPayments,
                failedPayments,
                schoolSeatsTotal,
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

                    List<FolderDTO> folders = em.createQuery(
                                    """
                                    SELECT DISTINCT f
                                    FROM Folder f
                                    LEFT JOIN FETCH f.parent
                                    WHERE f.collection.id = :collectionId
                                    ORDER BY f.createdAt DESC
                                    """,
                                    Folder.class
                            )
                            .setParameter("collectionId", collection.getId())
                            .getResultList()
                            .stream()
                            .map(f -> new FolderDTO(
                                    f.getId(),
                                    f.getName(),
                                    f.getCollection().getId(),
                                    f.getParent() != null ? f.getParent().getId() : null,
                                    f.getCreatedAt(),
                                    f.getUpdatedAt()
                            ))
                            .toList();

                    return collection.toDTOFull(examples, tests, folders);
                })
                .toList();

        List<AdminUserDetailDTO.PaymentDTO> payments = em.createQuery(
                        """
                        SELECT p
                        FROM PaymentRecord p
                        WHERE p.user = :user
                        ORDER BY p.createdAt DESC
                        """,
                        PaymentRecord.class
                )
                .setParameter("user", user)
                .getResultList()
                .stream()
                .map(p -> new AdminUserDetailDTO.PaymentDTO(
                        p.getId(),
                        p.getStripeInvoiceId(),
                        p.getAmountCents() == null ? 0L : p.getAmountCents(),
                        p.getCurrency(),
                        p.getStatus(),
                        p.getInvoiceUrl(),
                        p.getInvoicePdfUrl(),
                        p.getPaidAt(),
                        p.getCreatedAt()
                ))
                .toList();

        AdminUserDetailDTO dto = new AdminUserDetailDTO(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getCreatedAt(),
                user.getLastActivityAt(),

                user.getSubscriptionModel(),
                user.getSubscriptionStatus(),
                user.getSubscriptionSource(),
                user.getSubscriptionSeats(),
                user.getSubscriptionValidUntil(),
                user.getSubscriptionPeriodStart(),
                user.getSubscriptionPeriodEnd(),
                user.getCancelAtPeriodEnd(),

                user.isLocked(),

                countSuccessfulPaymentsByUser(user),
                sumSuccessfulPaymentsByUser(user),
                payments,

                collectionDTOs
        );

        return Response.ok(dto).build();
    }




    public Response updateAdminSubscription(UUID userId, AdminSubscriptionUpdateDTO request) {
        if (request == null || request.subscriptionModel() == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(java.util.Map.of(
                            "code", "SUBSCRIPTION_MODEL_REQUIRED",
                            "message", "Subscription model is required."
                    ))
                    .build();
        }

        User user = em.find(User.class, userId);
        if (user == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(java.util.Map.of(
                            "code", "USER_NOT_FOUND",
                            "message", "User not found."
                    ))
                    .build();
        }

        /*
         * A Stripe-managed subscription must not be silently overwritten in the DB.
         * Otherwise the Stripe webhook could overwrite the admin value again while
         * the customer continues to be charged.
         */
        if (user.getSubscriptionSource() == SubscriptionSource.STRIPE
                && user.getStripeSubscriptionId() != null
                && !user.getStripeSubscriptionId().isBlank()) {
            return Response.status(Response.Status.CONFLICT)
                    .entity(java.util.Map.of(
                            "code", "STRIPE_SUBSCRIPTION_MANAGED",
                            "message", "This subscription is managed by Stripe."
                    ))
                    .build();
        }

        SubscriptionModel model = request.subscriptionModel();
        LocalDateTime now = AppTime.now();

        if (request.validUntil() != null && !request.validUntil().isAfter(now)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(java.util.Map.of(
                            "code", "INVALID_SUBSCRIPTION_END",
                            "message", "validUntil must be in the future."
                    ))
                    .build();
        }

        if (model == SubscriptionModel.SCHOOL) {
            int seats = request.seats() == null ? 20 : request.seats();
            if (seats < 20) {
                return Response.status(Response.Status.BAD_REQUEST)
                        .entity(java.util.Map.of(
                                "code", "SCHOOL_MIN_SEATS",
                                "message", "School requires at least 20 seats."
                        ))
                        .build();
            }
            user.setSubscriptionSeats(seats);
        } else {
            user.setSubscriptionSeats(null);
        }

        user.setCancelAtPeriodEnd(false);
        user.setSubscriptionStatus(SubscriptionStatus.ACTIVE);

        if (model == SubscriptionModel.FREE) {
            user.setSubscriptionModel(SubscriptionModel.FREE);
            user.setSubscriptionSource(SubscriptionSource.FREE);
            user.setSubscriptionValidUntil(null);
            user.setSubscriptionPeriodStart(null);
            user.setSubscriptionPeriodEnd(null);
        } else {
            user.setSubscriptionModel(model);
            user.setSubscriptionSource(SubscriptionSource.ADMIN);
            user.setSubscriptionValidUntil(request.validUntil());
            user.setSubscriptionPeriodStart(now);
            user.setSubscriptionPeriodEnd(request.validUntil());
        }

        em.merge(user);

        LOG.infof(
                "event=admin.subscription-updated userId=%s model=%s validUntil=%s seats=%s",
                userId,
                user.getSubscriptionModel(),
                user.getSubscriptionValidUntil(),
                user.getSubscriptionSeats()
        );

        return Response.ok(java.util.Map.of(
                "id", user.getId().toString(),
                "subscriptionModel", user.getSubscriptionModel().name(),
                "subscriptionSource", user.getSubscriptionSource().name(),
                "subscriptionStatus", user.getSubscriptionStatus().name(),
                "subscriptionSeats", user.getSubscriptionSeats() == null ? 0 : user.getSubscriptionSeats(),
                "validUntil", user.getSubscriptionValidUntil() == null ? "" : user.getSubscriptionValidUntil().toString()
        )).build();
    }

    public Response updateAdminLock(UUID userId, boolean locked, UUID actingAdminId) {
        User user = em.find(User.class, userId);
        if (user == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(java.util.Map.of(
                            "code", "USER_NOT_FOUND",
                            "message", "User not found."
                    ))
                    .build();
        }

        if (locked && userId.equals(actingAdminId)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(java.util.Map.of(
                            "code", "CANNOT_LOCK_SELF",
                            "message", "You cannot lock your own admin account."
                    ))
                    .build();
        }

        user.setLocked(locked);
        em.merge(user);

        LOG.infof("event=admin.user-lock-updated userId=%s locked=%s", userId, locked);

        return Response.ok(java.util.Map.of(
                "id", user.getId().toString(),
                "locked", user.isLocked()
        )).build();
    }

    private void expireAdminSubscriptionIfNeeded(User user) {
        if (user == null
                || user.getSubscriptionSource() != SubscriptionSource.ADMIN
                || user.getSubscriptionValidUntil() == null
                || user.getSubscriptionValidUntil().isAfter(AppTime.now())) {
            return;
        }

        user.setSubscriptionModel(SubscriptionModel.FREE);
        user.setSubscriptionSource(SubscriptionSource.FREE);
        user.setSubscriptionStatus(SubscriptionStatus.ACTIVE);
        user.setSubscriptionSeats(null);
        user.setSubscriptionValidUntil(null);
        user.setSubscriptionPeriodStart(null);
        user.setSubscriptionPeriodEnd(null);
        user.setCancelAtPeriodEnd(false);

        LOG.infof("event=admin.subscription-expired userId=%s", user.getId());
    }

    private User prepareAuthenticatedUser(User user) {
        expireAdminSubscriptionIfNeeded(user);

        if (user.isLocked()) {
            throw new WebApplicationException(
                    Response.status(Response.Status.FORBIDDEN)
                            .type("application/json")
                            .entity(java.util.Map.of(
                                    "code", "ACCOUNT_LOCKED",
                                    "message", "Your TeacherHelper account is locked."
                            ))
                            .build()
            );
        }

        touchActivityIfNeeded(user);
        return user;
    }

    public User getOrCreateAuth0User(JsonWebToken jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            throw new WebApplicationException("Missing Auth0 subject", Response.Status.UNAUTHORIZED);
        }

        String auth0Id = jwt.getSubject();

        /*
         * Fast path for normal requests:
         * - no PostgreSQL advisory lock
         * - no UPDATE of lastActivity on every single API call
         */
        User existingByAuth0Id = findByAuth0Id(auth0Id);
        if (existingByAuth0Id != null) {
            return prepareAuthenticatedUser(existingByAuth0Id);
        }

        /*
         * The advisory lock is only needed while linking/creating a user.
         * Re-check after acquiring it because another request may have created
         * the user while this request was waiting.
         */
        lockAuth0UserCreation(auth0Id);

        existingByAuth0Id = findByAuth0Id(auth0Id);
        if (existingByAuth0Id != null) {
            return prepareAuthenticatedUser(existingByAuth0Id);
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
            User linkedUser = em.merge(existingByEmail);
            LOG.infof("event=user.auth-linked userId=%s", linkedUser.getId());
            return prepareAuthenticatedUser(linkedUser);
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

        LOG.infof("event=user.created userId=%s", user.getId());
        return user;
    }

    private void touchActivityIfNeeded(User user) {
        LocalDateTime lastActivity = user.getLastActivityAt();
        LocalDateTime updateBefore = AppTime.now().minus(ACTIVITY_WRITE_INTERVAL);

        if (lastActivity == null || lastActivity.isBefore(updateBefore)) {
            user.newActivity();
        }
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

        for (int suffixNumber = 2; suffixNumber <= 9999; suffixNumber++) {
            String suffix = "-" + suffixNumber;
            candidate = trimUsername(base, suffix.length()) + suffix;

            if (findByUsername(candidate) == null) {
                return candidate;
            }
        }

        /*
         * Extremely unlikely fallback if user, user-2 ... user-9999 are all
         * occupied. Use a random suffix instead of looping forever.
         */
        for (int attempt = 0; attempt < 100; attempt++) {
            String suffix = "-" + (10000 + CODE_RANDOM.nextInt(90000));
            candidate = trimUsername(base, suffix.length()) + suffix;

            if (findByUsername(candidate) == null) {
                return candidate;
            }
        }

        throw new IllegalStateException("Could not generate a unique username.");
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

    public User findByStripeSubscriptionId(String stripeSubscriptionId) {
        if (stripeSubscriptionId == null || stripeSubscriptionId.isBlank()) {
            return null;
        }

        try {
            return em.createQuery(
                            "SELECT u FROM User u WHERE u.stripeSubscriptionId = :stripeSubscriptionId",
                            User.class
                    )
                    .setParameter("stripeSubscriptionId", stripeSubscriptionId)
                    .getSingleResult();
        } catch (NoResultException e) {
            return null;
        }
    }

    public User findByStripeCustomerId(String stripeCustomerId) {
        if (stripeCustomerId == null || stripeCustomerId.isBlank()) {
            return null;
        }

        try {
            return em.createQuery(
                            "SELECT u FROM User u WHERE u.stripeCustomerId = :stripeCustomerId",
                            User.class
                    )
                    .setParameter("stripeCustomerId", stripeCustomerId)
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
        return AppTime.now();
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

    private long countSuccessfulPaymentsByUser(User user) {
        return em.createQuery(
                        """
                        SELECT COUNT(p)
                        FROM PaymentRecord p
                        WHERE p.user = :user
                          AND p.status = :status
                        """,
                        Long.class
                )
                .setParameter("user", user)
                .setParameter("status", PaymentStatus.PAID)
                .getSingleResult();
    }

    private long sumSuccessfulPaymentsByUser(User user) {
        Long total = em.createQuery(
                        """
                        SELECT COALESCE(SUM(p.amountCents), 0)
                        FROM PaymentRecord p
                        WHERE p.user = :user
                          AND p.status = :status
                        """,
                        Long.class
                )
                .setParameter("user", user)
                .setParameter("status", PaymentStatus.PAID)
                .getSingleResult();

        return total == null ? 0L : total;
    }

    private long countPaymentsByStatus(PaymentStatus status) {
        return em.createQuery(
                        """
                        SELECT COUNT(p)
                        FROM PaymentRecord p
                        WHERE p.status = :status
                        """,
                        Long.class
                )
                .setParameter("status", status)
                .getSingleResult();
    }

    private long sumPaymentsByStatus(PaymentStatus status) {
        Long total = em.createQuery(
                        """
                        SELECT COALESCE(SUM(p.amountCents), 0)
                        FROM PaymentRecord p
                        WHERE p.status = :status
                        """,
                        Long.class
                )
                .setParameter("status", status)
                .getSingleResult();

        return total == null ? 0L : total;
    }

    private long sumPaymentsByStatusSince(PaymentStatus status, LocalDateTime since) {
        Long total = em.createQuery(
                        """
                        SELECT COALESCE(SUM(p.amountCents), 0)
                        FROM PaymentRecord p
                        WHERE p.status = :status
                          AND p.paidAt >= :since
                        """,
                        Long.class
                )
                .setParameter("status", status)
                .setParameter("since", since)
                .getSingleResult();

        return total == null ? 0L : total;
    }

    private long sumSchoolSeats() {
        Long total = em.createQuery(
                        """
                        SELECT COALESCE(SUM(u.subscriptionSeats), 0)
                        FROM User u
                        WHERE u.subscriptionModel = :school
                        """,
                        Long.class
                )
                .setParameter("school", SubscriptionModel.SCHOOL)
                .getSingleResult();

        return total == null ? 0L : total;
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