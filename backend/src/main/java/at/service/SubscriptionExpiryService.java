package at.service;

import at.enums.SubscriptionModel;
import at.enums.SubscriptionSource;
import at.enums.SubscriptionStatus;
import at.model.User;
import at.model.helper.AppTime;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import org.jboss.logging.Logger;

import java.time.LocalDateTime;
import java.util.List;

@ApplicationScoped
public class SubscriptionExpiryService {

    private static final Logger LOG = Logger.getLogger(SubscriptionExpiryService.class);

    @Inject
    EntityManager em;

    @Scheduled(every = "1h")
    @Transactional
    void expireManualSubscriptions() {
        LocalDateTime now = AppTime.now();

        List<User> expiredUsers = em.createQuery(
                        """
                        SELECT u
                        FROM User u
                        WHERE u.subscriptionSource = :source
                          AND u.subscriptionValidUntil IS NOT NULL
                          AND u.subscriptionValidUntil <= :now
                          AND u.subscriptionModel <> :free
                        """,
                        User.class
                )
                .setParameter("source", SubscriptionSource.ADMIN)
                .setParameter("now", now)
                .setParameter("free", SubscriptionModel.FREE)
                .getResultList();

        for (User user : expiredUsers) {
            user.setSubscriptionModel(SubscriptionModel.FREE);
            user.setSubscriptionSource(SubscriptionSource.FREE);
            user.setSubscriptionStatus(SubscriptionStatus.ACTIVE);
            user.setSubscriptionSeats(null);
            user.setSubscriptionValidUntil(null);
            user.setSubscriptionPeriodStart(null);
            user.setSubscriptionPeriodEnd(null);
            user.setCancelAtPeriodEnd(false);

            LOG.infof(
                    "event=subscription.admin-expired userId=%s",
                    user.getId()
            );
        }
    }
}
