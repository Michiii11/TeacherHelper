package at.service;

import at.enums.SubscriptionModel;
import at.enums.SubscriptionSource;
import at.enums.SubscriptionStatus;
import at.model.Collection;
import at.model.User;
import at.model.helper.AppTime;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;

import java.time.LocalDateTime;
import java.util.UUID;

@ApplicationScoped
public class SubscriptionLimitService {

    public static final int UNLIMITED = -1;
    public static final int SCHOOL_MIN_SEATS = 20;

    @Inject
    EntityManager em;

    public record Limits(
            int maxCollections,
            int maxMembersPerCollection,
            int maxExamples,
            int maxTests,
            int maxSchoolUsers
    ) {
        public boolean collectionsUnlimited() {
            return maxCollections == UNLIMITED;
        }

        public boolean membersPerCollectionUnlimited() {
            return maxMembersPerCollection == UNLIMITED;
        }

        public boolean examplesUnlimited() {
            return maxExamples == UNLIMITED;
        }

        public boolean testsUnlimited() {
            return maxTests == UNLIMITED;
        }

        public boolean schoolUsersUnlimited() {
            return maxSchoolUsers == UNLIMITED;
        }
    }

    public record LimitCheck(boolean allowed, String code) {
        public static LimitCheck allow() {
            return new LimitCheck(true, null);
        }

        public static LimitCheck deny(String code) {
            return new LimitCheck(false, code);
        }
    }

    public SubscriptionModel effectivePlan(User user) {
        if (user == null || user.getSubscriptionModel() == null) {
            return SubscriptionModel.FREE;
        }

        SubscriptionModel plan = user.getSubscriptionModel();

        if (plan == SubscriptionModel.ADMIN) {
            return SubscriptionModel.ADMIN;
        }

        /*
         * A Stripe subscription that never became active, expired while
         * incomplete, or was canceled must never unlock paid limits.
         *
         * PAST_DUE intentionally keeps the paid plan for now as a grace
         * period. That policy can be tightened separately.
         */
        if (user.getSubscriptionSource() == SubscriptionSource.STRIPE
                && (user.getSubscriptionStatus() == SubscriptionStatus.INCOMPLETE
                || user.getSubscriptionStatus() == SubscriptionStatus.CANCELED)) {
            return SubscriptionModel.FREE;
        }

        LocalDateTime validUntil = user.getSubscriptionValidUntil();
        if ((plan == SubscriptionModel.PRO || plan == SubscriptionModel.SCHOOL)
                && validUntil != null
                && validUntil.isBefore(AppTime.now())) {
            return SubscriptionModel.FREE;
        }

        return plan;
    }

    /**
     * Paid School capacity.
     *
     * Examples:
     * 20 seats => max 20 total School users + max 20 owned collections
     * 50 seats => max 50 total School users + max 50 owned collections
     *
     * Existing SCHOOL accounts without a stored seat count fall back to 20.
     */
    public int schoolCapacity(User user) {
        if (user == null) {
            return SCHOOL_MIN_SEATS;
        }

        Integer configuredSeats = user.getSubscriptionSeats();
        if (configuredSeats == null) {
            return SCHOOL_MIN_SEATS;
        }

        return Math.max(SCHOOL_MIN_SEATS, configuredSeats);
    }

    public Limits limitsFor(User user) {
        SubscriptionModel plan = effectivePlan(user);

        return switch (plan) {
            case FREE -> new Limits(
                    1,
                    0,
                    50,
                    5,
                    0
            );

            case PRO -> new Limits(
                    5,
                    5,
                    500,
                    50,
                    0
            );

            case SCHOOL -> {
                int capacity = schoolCapacity(user);
                yield new Limits(
                        capacity,      // scalable: 30 seats -> 30 collections, 50 -> 50, ...
                        UNLIMITED,     // no per-collection member limit
                        UNLIMITED,
                        UNLIMITED,
                        capacity       // total School users, owner included
                );
            }

            case ADMIN -> new Limits(
                    UNLIMITED,
                    UNLIMITED,
                    UNLIMITED,
                    UNLIMITED,
                    UNLIMITED
            );
        };
    }

    public LimitCheck canCreateCollection(User owner) {
        Limits limits = limitsFor(owner);

        if (limits.collectionsUnlimited()) {
            return LimitCheck.allow();
        }

        long current = countOwnedCollections(owner.getId());
        return current >= limits.maxCollections()
                ? LimitCheck.deny("COLLECTION_LIMIT_REACHED")
                : LimitCheck.allow();
    }

    public LimitCheck canCreateExample(Collection collection) {
        if (collection == null || collection.getAdmin() == null) {
            return LimitCheck.deny("COLLECTION_OWNER_NOT_FOUND");
        }

        User owner = collection.getAdmin();
        Limits limits = limitsFor(owner);

        if (limits.examplesUnlimited()) {
            return LimitCheck.allow();
        }

        long current = countExamplesInOwnedCollections(owner.getId());
        return current >= limits.maxExamples()
                ? LimitCheck.deny("EXAMPLE_LIMIT_REACHED")
                : LimitCheck.allow();
    }

    public LimitCheck canCreateTest(Collection collection) {
        if (collection == null || collection.getAdmin() == null) {
            return LimitCheck.deny("COLLECTION_OWNER_NOT_FOUND");
        }

        User owner = collection.getAdmin();
        Limits limits = limitsFor(owner);

        if (limits.testsUnlimited()) {
            return LimitCheck.allow();
        }

        long current = countTestsInOwnedCollections(owner.getId());
        return current >= limits.maxTests()
                ? LimitCheck.deny("TEST_LIMIT_REACHED")
                : LimitCheck.allow();
    }

    public LimitCheck canAddMember(Collection collection, User candidate) {
        if (collection == null || collection.getAdmin() == null || candidate == null) {
            return LimitCheck.deny("COLLECTION_MEMBER_DATA_INVALID");
        }

        User owner = collection.getAdmin();
        Limits limits = limitsFor(owner);

        if (!limits.membersPerCollectionUnlimited()) {
            long membersInCollection = countCollectionMembers(collection.getId());
            if (membersInCollection >= limits.maxMembersPerCollection()) {
                return LimitCheck.deny("COLLECTION_MEMBER_LIMIT_REACHED");
            }
        }

        if (!limits.schoolUsersUnlimited() && limits.maxSchoolUsers() > 0) {
            boolean alreadyUsesSchoolSeat =
                    candidate.getId().equals(owner.getId())
                            || isMemberInAnyOwnedCollection(owner.getId(), candidate.getId());

            if (!alreadyUsesSchoolSeat) {
                // Owner counts as one School user.
                long currentTotalSchoolUsers =
                        1L + countUniqueMembersInOwnedCollections(owner.getId());

                if (currentTotalSchoolUsers >= limits.maxSchoolUsers()) {
                    return LimitCheck.deny("SCHOOL_USER_LIMIT_REACHED");
                }
            }
        }

        return LimitCheck.allow();
    }

    public long countOwnedCollections(UUID ownerId) {
        return em.createQuery("""
                SELECT COUNT(c)
                FROM Collection c
                WHERE c.admin.id = :ownerId
                """, Long.class)
                .setParameter("ownerId", ownerId)
                .getSingleResult();
    }

    public long countExamplesInOwnedCollections(UUID ownerId) {
        return em.createQuery("""
                SELECT COUNT(e)
                FROM Example e
                WHERE e.collection.admin.id = :ownerId
                """, Long.class)
                .setParameter("ownerId", ownerId)
                .getSingleResult();
    }

    public long countTestsInOwnedCollections(UUID ownerId) {
        return em.createQuery("""
                SELECT COUNT(t)
                FROM Test t
                WHERE t.collection.admin.id = :ownerId
                """, Long.class)
                .setParameter("ownerId", ownerId)
                .getSingleResult();
    }

    public long countCollectionMembers(UUID collectionId) {
        return em.createQuery("""
                SELECT COUNT(member)
                FROM Collection c
                JOIN c.users member
                WHERE c.id = :collectionId
                """, Long.class)
                .setParameter("collectionId", collectionId)
                .getSingleResult();
    }

    /**
     * Additional unique members across all collections owned by the School account.
     * The owner is intentionally not included here and is added separately when
     * checking the total School-user capacity.
     */
    public long countUniqueMembersInOwnedCollections(UUID ownerId) {
        return em.createQuery("""
                SELECT COUNT(DISTINCT member.id)
                FROM Collection c
                JOIN c.users member
                WHERE c.admin.id = :ownerId
                """, Long.class)
                .setParameter("ownerId", ownerId)
                .getSingleResult();
    }

    public long countTotalSchoolUsers(UUID ownerId) {
        return 1L + countUniqueMembersInOwnedCollections(ownerId);
    }

    private boolean isMemberInAnyOwnedCollection(UUID ownerId, UUID memberId) {
        long count = em.createQuery("""
                SELECT COUNT(c)
                FROM Collection c
                JOIN c.users member
                WHERE c.admin.id = :ownerId
                  AND member.id = :memberId
                """, Long.class)
                .setParameter("ownerId", ownerId)
                .setParameter("memberId", memberId)
                .getSingleResult();

        return count > 0;
    }
}
