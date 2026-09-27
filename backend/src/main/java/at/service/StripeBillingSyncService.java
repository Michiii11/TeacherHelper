package at.service;

import at.enums.PaymentStatus;
import at.enums.SubscriptionModel;
import at.enums.SubscriptionSource;
import at.enums.SubscriptionStatus;
import at.model.User;
import at.model.helper.AppTime;
import at.repository.PaymentRecordRepository;
import at.repository.UserRepository;
import com.stripe.exception.StripeException;
import com.stripe.model.Charge;
import com.stripe.model.Invoice;
import com.stripe.model.InvoicePayment;
import com.stripe.model.PaymentIntent;
import com.stripe.model.Subscription;
import com.stripe.model.SubscriptionItem;
import com.stripe.net.RequestOptions;
import com.stripe.param.InvoiceListParams;
import com.stripe.param.InvoicePaymentListParams;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;

@ApplicationScoped
public class StripeBillingSyncService {

    private static final Logger LOG = Logger.getLogger(StripeBillingSyncService.class);
    private static final int SCHOOL_MIN_SEATS = 20;

    @Inject
    UserRepository userRepository;

    @Inject
    PaymentRecordRepository paymentRecordRepository;

    @ConfigProperty(name = "stripe.secret-key")
    String stripeSecretKey;

    @ConfigProperty(name = "stripe.price.pro")
    String stripePricePro;

    @ConfigProperty(name = "stripe.price.school")
    String stripePriceSchool;

    /**
     * Synchronizes the current Stripe subscription and already-paid invoices
     * into TeacherHelper. Intended for admin detail views/backfilling old data.
     *
     * Stripe failures are logged but do not make the admin page unusable.
     */
    @Transactional
    public void syncUser(UUID userId) {
        User user = userRepository.findById(userId);

        if (user == null || user.getSubscriptionSource() != SubscriptionSource.STRIPE) {
            return;
        }

        if (stripeSecretKey == null || stripeSecretKey.isBlank()) {
            LOG.warnf("event=stripe.billing-sync.skipped userId=%s reason=missing-secret-key", userId);
            return;
        }

        RequestOptions options = RequestOptions.builder()
                .setApiKey(stripeSecretKey)
                .build();

        syncSubscription(user, options);
        syncInvoiceHistory(user, options);
    }

    private void syncSubscription(User user, RequestOptions options) {
        String subscriptionId = user.getStripeSubscriptionId();

        if (subscriptionId == null || subscriptionId.isBlank()) {
            return;
        }

        try {
            Subscription subscription = Subscription.retrieve(subscriptionId, options);

            if (isTerminalSubscription(subscription)) {
                clearStripeSubscription(user);

                LOG.infof(
                        "event=stripe.billing-sync.subscription-terminal userId=%s subscriptionId=%s status=%s",
                        user.getId(),
                        subscriptionId,
                        subscription.getStatus()
                );
                return;
            }

            SubscriptionItem item = getSingleSubscriptionItem(subscription);

            if (item.getPrice() == null || item.getPrice().getId() == null) {
                LOG.warnf(
                        "event=stripe.billing-sync.subscription-no-price userId=%s subscriptionId=%s",
                        user.getId(),
                        subscriptionId
                );
                return;
            }

            String priceId = item.getPrice().getId();

            if (priceId.equals(stripePricePro)) {
                user.setSubscriptionModel(SubscriptionModel.PRO);
                user.setSubscriptionSeats(null);
            } else if (priceId.equals(stripePriceSchool)) {
                long quantity = item.getQuantity() == null
                        ? SCHOOL_MIN_SEATS
                        : item.getQuantity();

                user.setSubscriptionModel(SubscriptionModel.SCHOOL);
                user.setSubscriptionSeats(
                        Math.max(SCHOOL_MIN_SEATS, Math.toIntExact(quantity))
                );
            } else {
                LOG.errorf(
                        "event=stripe.billing-sync.subscription-unknown-price userId=%s subscriptionId=%s priceId=%s",
                        user.getId(),
                        subscriptionId,
                        priceId
                );
                return;
            }

            user.setStripeCustomerId(subscription.getCustomer());
            user.setStripeSubscriptionId(subscription.getId());
            user.setSubscriptionSource(SubscriptionSource.STRIPE);
            user.setSubscriptionStatus(mapStatus(subscription.getStatus()));
            user.setCancelAtPeriodEnd(Boolean.TRUE.equals(subscription.getCancelAtPeriodEnd()));
            user.setSubscriptionPeriodStart(fromStripeTimestamp(item.getCurrentPeriodStart()));
            user.setSubscriptionPeriodEnd(fromStripeTimestamp(item.getCurrentPeriodEnd()));

            LOG.infof(
                    "event=stripe.billing-sync.subscription userId=%s status=%s periodStart=%s periodEnd=%s cancelAtPeriodEnd=%s",
                    user.getId(),
                    user.getSubscriptionStatus(),
                    user.getSubscriptionPeriodStart(),
                    user.getSubscriptionPeriodEnd(),
                    user.getCancelAtPeriodEnd()
            );

        } catch (StripeException e) {
            if (Integer.valueOf(404).equals(e.getStatusCode())) {
                clearStripeSubscription(user);

                LOG.warnf(
                        "event=stripe.billing-sync.subscription-missing userId=%s subscriptionId=%s action=reset-free",
                        user.getId(),
                        subscriptionId
                );
                return;
            }

            LOG.warnf(
                    e,
                    "event=stripe.billing-sync.subscription-failed userId=%s subscriptionId=%s",
                    user.getId(),
                    subscriptionId
            );
        }
    }

    private void syncInvoiceHistory(User user, RequestOptions options) {
        String customerId = user.getStripeCustomerId();

        if (customerId == null || customerId.isBlank()) {
            return;
        }

        try {
            InvoiceListParams params = InvoiceListParams.builder()
                    .setCustomer(customerId)
                    .setLimit(100L)
                    .build();

            var invoices = Invoice.list(params, options);

            if (invoices == null) {
                return;
            }

            int paidCount = 0;
            int failedCount = 0;
            int refundedCount = 0;

            /*
             * autoPagingIterable() walks the complete Stripe invoice history
             * instead of silently stopping after the first 100 invoices.
             */
            for (Invoice invoice : invoices.autoPagingIterable()) {
                if ("paid".equals(invoice.getStatus())) {
                    LocalDateTime paidAt = null;

                    if (invoice.getStatusTransitions() != null
                            && invoice.getStatusTransitions().getPaidAt() != null) {
                        paidAt = fromStripeTimestamp(
                                invoice.getStatusTransitions().getPaidAt()
                        );
                    } else if (invoice.getCreated() != null) {
                        paidAt = fromStripeTimestamp(invoice.getCreated());
                    }

                    PaymentStatus paymentStatus = isInvoiceFullyRefunded(invoice, options)
                            ? PaymentStatus.REFUNDED
                            : PaymentStatus.PAID;

                    paymentRecordRepository.upsertInvoice(
                            user,
                            invoice.getId(),
                            invoice.getAmountPaid(),
                            invoice.getCurrency(),
                            paymentStatus,
                            invoice.getHostedInvoiceUrl(),
                            invoice.getInvoicePdf(),
                            paidAt
                    );

                    if (paymentStatus == PaymentStatus.REFUNDED) {
                        refundedCount++;
                    } else {
                        paidCount++;
                    }
                    continue;
                }

                /*
                 * An automatically collected invoice that has already been
                 * attempted and still has money outstanding represents a
                 * failed/unpaid billing attempt. This also backfills failures
                 * when the original webhook was missed.
                 */
                boolean failedAutomaticPayment =
                        "charge_automatically".equals(invoice.getCollectionMethod())
                                && Boolean.TRUE.equals(invoice.getAttempted())
                                && invoice.getAmountRemaining() != null
                                && invoice.getAmountRemaining() > 0
                                && ("open".equals(invoice.getStatus())
                                || "uncollectible".equals(invoice.getStatus()));

                if (failedAutomaticPayment) {
                    paymentRecordRepository.upsertInvoice(
                            user,
                            invoice.getId(),
                            invoice.getAmountDue(),
                            invoice.getCurrency(),
                            PaymentStatus.FAILED,
                            invoice.getHostedInvoiceUrl(),
                            invoice.getInvoicePdf(),
                            null
                    );
                    failedCount++;
                }
            }

            LOG.infof(
                    "event=stripe.billing-sync.invoices userId=%s paid=%s failed=%s refunded=%s",
                    user.getId(),
                    paidCount,
                    failedCount,
                    refundedCount
            );

        } catch (StripeException e) {
            LOG.warnf(
                    e,
                    "event=stripe.billing-sync.invoices-failed userId=%s customerId=%s",
                    user.getId(),
                    customerId
            );
        }
    }

    private boolean isInvoiceFullyRefunded(
            Invoice invoice,
            RequestOptions options
    ) throws StripeException {
        if (invoice == null
                || invoice.getId() == null
                || invoice.getAmountPaid() == null
                || invoice.getAmountPaid() <= 0) {
            return false;
        }

        InvoicePaymentListParams params = InvoicePaymentListParams.builder()
                .setInvoice(invoice.getId())
                .setStatus(InvoicePaymentListParams.Status.PAID)
                .setLimit(100L)
                .build();

        var invoicePayments = InvoicePayment.list(params, options);
        long refundedCents = 0L;

        for (InvoicePayment invoicePayment : invoicePayments.autoPagingIterable()) {
            if (invoicePayment.getPayment() == null) {
                continue;
            }

            String chargeId = invoicePayment.getPayment().getCharge();

            if ((chargeId == null || chargeId.isBlank())
                    && invoicePayment.getPayment().getPaymentIntent() != null) {
                PaymentIntent paymentIntent = PaymentIntent.retrieve(
                        invoicePayment.getPayment().getPaymentIntent(),
                        options
                );
                chargeId = paymentIntent.getLatestCharge();
            }

            if (chargeId == null || chargeId.isBlank()) {
                continue;
            }

            Charge charge = Charge.retrieve(chargeId, options);
            if (charge.getAmountRefunded() != null) {
                refundedCents += Math.max(0L, charge.getAmountRefunded());
            }
        }

        return refundedCents >= invoice.getAmountPaid();
    }

    private SubscriptionItem getSingleSubscriptionItem(Subscription subscription) {
        if (subscription.getItems() == null
                || subscription.getItems().getData() == null
                || subscription.getItems().getData().isEmpty()) {
            throw new IllegalStateException(
                    "Stripe subscription has no subscription item."
            );
        }

        if (subscription.getItems().getData().size() != 1) {
            throw new IllegalStateException(
                    "TeacherHelper expects exactly one Stripe subscription item."
            );
        }

        return subscription.getItems().getData().getFirst();
    }

    private boolean isTerminalSubscription(Subscription subscription) {
        if (subscription == null || subscription.getStatus() == null) {
            return false;
        }

        return "canceled".equals(subscription.getStatus())
                || "incomplete_expired".equals(subscription.getStatus());
    }

    private void clearStripeSubscription(User user) {
        if (user == null) {
            return;
        }

        user.setSubscriptionModel(SubscriptionModel.FREE);
        user.setSubscriptionSource(SubscriptionSource.FREE);
        user.setSubscriptionStatus(SubscriptionStatus.CANCELED);
        user.setSubscriptionSeats(null);
        user.setStripeSubscriptionId(null);
        user.setSubscriptionPeriodStart(null);
        user.setSubscriptionPeriodEnd(null);
        user.setCancelAtPeriodEnd(false);
    }

    private SubscriptionStatus mapStatus(String stripeStatus) {
        if (stripeStatus == null) {
            return SubscriptionStatus.INCOMPLETE;
        }

        return switch (stripeStatus) {
            case "active", "trialing" -> SubscriptionStatus.ACTIVE;
            case "past_due", "unpaid", "paused" -> SubscriptionStatus.PAST_DUE;
            case "canceled" -> SubscriptionStatus.CANCELED;
            case "incomplete", "incomplete_expired" -> SubscriptionStatus.INCOMPLETE;
            default -> SubscriptionStatus.INCOMPLETE;
        };
    }

    private LocalDateTime fromStripeTimestamp(Long epochSeconds) {
        if (epochSeconds == null) {
            return null;
        }

        return LocalDateTime.ofInstant(
                Instant.ofEpochSecond(epochSeconds),
                AppTime.APP_ZONE
        );
    }
}
