package at.repository;

import at.enums.PaymentStatus;
import at.model.PaymentRecord;
import at.model.User;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.transaction.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
@Transactional
public class PaymentRecordRepository {

    @Inject
    EntityManager em;

    public PaymentRecord findByStripeInvoiceId(String stripeInvoiceId) {
        if (stripeInvoiceId == null || stripeInvoiceId.isBlank()) {
            return null;
        }

        try {
            return em.createQuery(
                            "SELECT p FROM PaymentRecord p WHERE p.stripeInvoiceId = :stripeInvoiceId",
                            PaymentRecord.class
                    )
                    .setParameter("stripeInvoiceId", stripeInvoiceId)
                    .getSingleResult();
        } catch (NoResultException e) {
            return null;
        }
    }

    public boolean markRefunded(String stripeInvoiceId) {
        PaymentRecord record = findByStripeInvoiceId(stripeInvoiceId);
        if (record == null) {
            return false;
        }

        record.setStatus(PaymentStatus.REFUNDED);
        return true;
    }

    public List<PaymentRecord> findRecentByUserId(UUID userId, int limit) {
        if (userId == null) {
            return List.of();
        }

        int safeLimit = Math.max(1, Math.min(limit, 100));

        return em.createQuery(
                        """
                        SELECT p
                        FROM PaymentRecord p
                        WHERE p.user.id = :userId
                        ORDER BY COALESCE(p.paidAt, p.createdAt) DESC, p.createdAt DESC
                        """,
                        PaymentRecord.class
                )
                .setParameter("userId", userId)
                .setMaxResults(safeLimit)
                .getResultList();
    }

    public PaymentRecord upsertInvoice(
            User user,
            String stripeInvoiceId,
            Long amountCents,
            String currency,
            PaymentStatus status,
            String invoiceUrl,
            String invoicePdfUrl,
            LocalDateTime paidAt
    ) {
        if (user == null) {
            throw new IllegalArgumentException("Payment record requires a user.");
        }

        if (stripeInvoiceId == null || stripeInvoiceId.isBlank()) {
            throw new IllegalArgumentException("Payment record requires a Stripe invoice ID.");
        }

        PaymentRecord record = findByStripeInvoiceId(stripeInvoiceId);
        boolean isNew = record == null;

        if (!isNew) {
            /*
             * Webhooks may arrive more than once or out of order.
             * Never downgrade a final state because an older failure event arrives later.
             */
            if (record.getStatus() == PaymentStatus.REFUNDED
                    && status != PaymentStatus.REFUNDED) {
                return record;
            }

            if (record.getStatus() == PaymentStatus.PAID
                    && status == PaymentStatus.FAILED) {
                return record;
            }
        }

        if (isNew) {
            record = new PaymentRecord();
            record.setUser(user);
            record.setStripeInvoiceId(stripeInvoiceId);
        }

        /*
         * Set all non-null fields BEFORE persist().
         * Hibernate may validate nullability immediately when persist() is called.
         */
        record.setAmountCents(amountCents == null ? 0L : Math.max(0L, amountCents));
        record.setCurrency(
                currency == null || currency.isBlank()
                        ? "EUR"
                        : currency.trim().toUpperCase()
        );
        record.setStatus(status == null ? PaymentStatus.FAILED : status);
        record.setInvoiceUrl(invoiceUrl);
        record.setInvoicePdfUrl(invoicePdfUrl);
        if (paidAt != null || record.getPaidAt() == null) {
            record.setPaidAt(paidAt);
        }

        if (isNew) {
            em.persist(record);
        }

        return record;
    }
}
