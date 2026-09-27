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
import com.stripe.model.Event;
import com.stripe.model.InvoicePayment;
import com.stripe.model.Invoice;
import com.stripe.model.StripeObject;
import com.stripe.model.Subscription;
import com.stripe.model.SubscriptionItem;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.param.InvoicePaymentListParams;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@ApplicationScoped
public class StripeWebhookService {

    private static final Logger LOG = Logger.getLogger(StripeWebhookService.class);
    private static final int SCHOOL_MIN_SEATS = 20;

    @Inject
    UserRepository userRepository;

    @Inject
    PaymentRecordRepository paymentRecordRepository;

    @Inject
    StripeBillingSyncService stripeBillingSyncService;

    @ConfigProperty(name = "stripe.secret-key")
    String stripeSecretKey;

    @ConfigProperty(name = "stripe.price.pro")
    String stripePricePro;

    @ConfigProperty(name = "stripe.price.school")
    String stripePriceSchool;

    @Transactional
    public void handle(Event event) {
        if (event == null || event.getType() == null) {
            return;
        }

        switch (event.getType()) {
            case "checkout.session.completed" -> handleCheckoutCompleted(event);
            case "customer.subscription.created" -> handleSubscriptionChanged(event);
            case "customer.subscription.updated" -> handleSubscriptionChanged(event);
            case "customer.subscription.paused" -> handleSubscriptionChanged(event);
            case "customer.subscription.resumed" -> handleSubscriptionChanged(event);
            case "customer.subscription.deleted" -> handleSubscriptionDeleted(event);
            case "invoice.paid" -> handleInvoicePaid(event);
            case "invoice.payment_failed" -> handleInvoicePaymentFailed(event);
            case "charge.refunded" -> handleChargeRefunded(event);
            default -> LOG.debugf(
                    "event=stripe.webhook.ignored stripeEventId=%s stripeEventType=%s",
                    event.getId(),
                    event.getType()
            );
        }
    }

    private void handleCheckoutCompleted(Event event) {
        StripeObject stripeObject = deserialize(event);

        if (!(stripeObject instanceof Session session)) {
            throw new IllegalStateException(
                    "Stripe checkout.session.completed did not contain a Checkout Session."
            );
        }

        UUID userId = resolveUserId(session);
        User user = userRepository.findById(userId);

        if (user == null) {
            throw new IllegalStateException(
                    "TeacherHelper user not found for Stripe Checkout Session."
            );
        }

        String subscriptionId = session.getSubscription();

        if (subscriptionId == null || subscriptionId.isBlank()) {
            throw new IllegalStateException(
                    "Stripe Checkout Session has no subscription ID."
            );
        }

        if (hasDifferentCurrentSubscription(user, subscriptionId)) {
            LOG.warnf(
                    "event=stripe.checkout.completed.ignored-superseded userId=%s incomingSubscriptionId=%s currentSubscriptionId=%s",
                    user.getId(),
                    subscriptionId,
                    user.getStripeSubscriptionId()
            );
            return;
        }

        try {
            Subscription subscription = Subscription.retrieve(
                    subscriptionId,
                    stripeRequestOptions()
            );

            /*
             * Never infer ACTIVE/PRO/SCHOOL from Checkout metadata here.
             * The Stripe Subscription itself is the authoritative object for
             * plan, status, seats, period dates and cancellation state.
             */
            syncSubscription(user, subscription);

            /*
             * invoice.paid can arrive before checkout.session.completed.
             * At that point the local user may not yet have stripeCustomerId,
             * so the invoice webhook cannot be linked. Once Checkout has
             * linked the subscription/customer, backfill Stripe billing data
             * immediately so the first payment is never lost locally.
             */
            stripeBillingSyncService.syncUser(user.getId());

            LOG.infof(
                    "event=stripe.checkout.completed.synced userId=%s plan=%s status=%s stripeSubscriptionId=%s",
                    user.getId(),
                    user.getSubscriptionModel(),
                    user.getSubscriptionStatus(),
                    subscriptionId
            );

        } catch (StripeException e) {
            throw new IllegalStateException(
                    "Stripe subscription could not be retrieved after Checkout completion.",
                    e
            );
        }
    }

    private void handleChargeRefunded(Event event) {
        StripeObject stripeObject = deserialize(event);

        if (!(stripeObject instanceof Charge charge)) {
            throw new IllegalStateException(
                    "Stripe charge.refunded did not contain a Charge."
            );
        }

        /*
         * Stripe emits charge.refunded for partial refunds too. Our current
         * PaymentStatus model only has REFUNDED, so only mark the invoice as
         * refunded once the charge is fully refunded.
         */
        if (!Boolean.TRUE.equals(charge.getRefunded())) {
            LOG.infof(
                    "event=stripe.charge.refund.partial stripeChargeId=%s amountRefunded=%s amount=%s",
                    charge.getId(),
                    charge.getAmountRefunded(),
                    charge.getAmount()
            );
            return;
        }

        String paymentIntentId = charge.getPaymentIntent();
        if (paymentIntentId == null || paymentIntentId.isBlank()) {
            LOG.warnf(
                    "event=stripe.charge.refund.no-payment-intent stripeChargeId=%s",
                    charge.getId()
            );
            return;
        }

        try {
            InvoicePaymentListParams.Payment paymentFilter =
                    InvoicePaymentListParams.Payment.builder()
                            .setType(InvoicePaymentListParams.Payment.Type.PAYMENT_INTENT)
                            .setPaymentIntent(paymentIntentId)
                            .build();

            InvoicePaymentListParams params = InvoicePaymentListParams.builder()
                    .setPayment(paymentFilter)
                    .setLimit(100L)
                    .build();

            var invoicePayments = InvoicePayment.list(params, stripeRequestOptions());

            int updated = 0;
            for (InvoicePayment invoicePayment : invoicePayments.autoPagingIterable()) {
                String invoiceId = invoicePayment.getInvoice();
                if (invoiceId == null || invoiceId.isBlank()) {
                    continue;
                }

                if (markInvoiceRefunded(invoiceId)) {
                    updated++;
                }
            }

            LOG.infof(
                    "event=stripe.charge.refund.synced stripeChargeId=%s paymentIntentId=%s invoicesUpdated=%s",
                    charge.getId(),
                    paymentIntentId,
                    updated
            );

        } catch (StripeException e) {
            throw new IllegalStateException(
                    "Stripe invoice payment mapping could not be retrieved for refunded charge.",
                    e
            );
        }
    }

    private boolean markInvoiceRefunded(String invoiceId) throws StripeException {
        if (paymentRecordRepository.markRefunded(invoiceId)) {
            return true;
        }

        /*
         * Backfill the local payment row if the refund webhook arrives before
         * invoice.paid was stored locally or the original paid webhook was missed.
         */
        Invoice invoice = Invoice.retrieve(invoiceId, stripeRequestOptions());
        User user = findUserForInvoice(invoice);

        if (user == null) {
            LOG.warnf(
                    "event=stripe.invoice.refund.user-not-found stripeInvoiceId=%s stripeCustomerId=%s",
                    invoiceId,
                    invoice.getCustomer()
            );
            return false;
        }

        LocalDateTime paidAt = null;
        if (invoice.getStatusTransitions() != null
                && invoice.getStatusTransitions().getPaidAt() != null) {
            paidAt = fromStripeTimestamp(invoice.getStatusTransitions().getPaidAt());
        }

        paymentRecordRepository.upsertInvoice(
                user,
                invoice.getId(),
                invoice.getAmountPaid(),
                invoice.getCurrency(),
                PaymentStatus.REFUNDED,
                invoice.getHostedInvoiceUrl(),
                invoice.getInvoicePdf(),
                paidAt
        );

        return true;
    }

    private void handleInvoicePaid(Event event) {
        StripeObject stripeObject = deserialize(event);

        if (!(stripeObject instanceof Invoice invoice)) {
            throw new IllegalStateException(
                    "Stripe invoice.paid did not contain an Invoice."
            );
        }

        User user = findUserForInvoice(invoice);
        if (user == null) {
            LOG.warnf(
                    "event=stripe.invoice.paid.user-not-found stripeInvoiceId=%s stripeCustomerId=%s",
                    invoice.getId(),
                    invoice.getCustomer()
            );
            return;
        }

        LocalDateTime paidAt = null;
        if (invoice.getStatusTransitions() != null
                && invoice.getStatusTransitions().getPaidAt() != null) {
            paidAt = fromStripeTimestamp(invoice.getStatusTransitions().getPaidAt());
        }

        paymentRecordRepository.upsertInvoice(
                user,
                invoice.getId(),
                invoice.getAmountPaid(),
                invoice.getCurrency(),
                PaymentStatus.PAID,
                invoice.getHostedInvoiceUrl(),
                invoice.getInvoicePdf(),
                paidAt
        );

        LOG.infof(
                "event=stripe.invoice.paid.saved userId=%s stripeInvoiceId=%s amount=%s currency=%s",
                user.getId(),
                invoice.getId(),
                invoice.getAmountPaid(),
                invoice.getCurrency()
        );
    }

    private void handleInvoicePaymentFailed(Event event) {
        StripeObject stripeObject = deserialize(event);

        if (!(stripeObject instanceof Invoice invoice)) {
            throw new IllegalStateException(
                    "Stripe invoice.payment_failed did not contain an Invoice."
            );
        }

        User user = findUserForInvoice(invoice);
        if (user == null) {
            LOG.warnf(
                    "event=stripe.invoice.payment-failed.user-not-found stripeInvoiceId=%s stripeCustomerId=%s",
                    invoice.getId(),
                    invoice.getCustomer()
            );
            return;
        }

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

        LOG.infof(
                "event=stripe.invoice.payment-failed.saved userId=%s stripeInvoiceId=%s amount=%s currency=%s",
                user.getId(),
                invoice.getId(),
                invoice.getAmountDue(),
                invoice.getCurrency()
        );
    }

    private User findUserForInvoice(Invoice invoice) {
        if (invoice.getCustomer() == null || invoice.getCustomer().isBlank()) {
            return null;
        }

        return userRepository.findByStripeCustomerId(invoice.getCustomer());
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

    private void handleSubscriptionChanged(Event event) {
        StripeObject stripeObject = deserialize(event);

        if (!(stripeObject instanceof Subscription eventSubscription)) {
            throw new IllegalStateException(
                    "Stripe subscription lifecycle event did not contain a Subscription."
            );
        }

        User user = findUserForSubscription(eventSubscription);

        if (user == null) {
            throw new IllegalStateException(
                    "TeacherHelper user not found for Stripe subscription " + eventSubscription.getId()
            );
        }

        if (hasDifferentCurrentSubscription(user, eventSubscription.getId())) {
            LOG.warnf(
                    "event=stripe.subscription.lifecycle.ignored-superseded stripeEventType=%s userId=%s incomingSubscriptionId=%s currentSubscriptionId=%s",
                    event.getType(),
                    user.getId(),
                    eventSubscription.getId(),
                    user.getStripeSubscriptionId()
            );
            return;
        }

        /*
         * Stripe does not guarantee webhook delivery order. Never apply the
         * snapshot carried by an update/pause/resume event directly because a
         * delayed event could overwrite newer subscription state.
         *
         * Use the event only to identify the subscription, then retrieve the
         * current authoritative object from Stripe.
         */
        try {
            Subscription currentSubscription = Subscription.retrieve(
                    eventSubscription.getId(),
                    stripeRequestOptions()
            );

            syncSubscription(user, currentSubscription);

            LOG.infof(
                    "event=stripe.subscription.synced-authoritative stripeEventType=%s stripeEventId=%s userId=%s plan=%s status=%s seats=%s cancelAtPeriodEnd=%s",
                    event.getType(),
                    event.getId(),
                    user.getId(),
                    user.getSubscriptionModel(),
                    user.getSubscriptionStatus(),
                    user.getSubscriptionSeats(),
                    user.getCancelAtPeriodEnd()
            );

        } catch (StripeException e) {
            throw new IllegalStateException(
                    "Stripe subscription could not be retrieved while processing lifecycle event "
                            + event.getType(),
                    e
            );
        }
    }

    private void handleSubscriptionDeleted(Event event) {
        StripeObject stripeObject = deserialize(event);

        if (!(stripeObject instanceof Subscription subscription)) {
            throw new IllegalStateException(
                    "Stripe customer.subscription.deleted did not contain a Subscription."
            );
        }

        /*
         * A delayed deletion event for an OLD subscription must never clear a
         * newer subscription on the same Stripe Customer. Therefore deletion
         * only acts on an exact local subscription-ID match.
         */
        User user = userRepository.findByStripeSubscriptionId(subscription.getId());

        if (user == null) {
            LOG.warnf(
                    "event=stripe.subscription.deleted.ignored-not-current stripeSubscriptionId=%s stripeCustomerId=%s",
                    subscription.getId(),
                    subscription.getCustomer()
            );
            return;
        }

        clearStripeSubscription(user);

        LOG.infof(
                "event=stripe.subscription.canceled userId=%s stripeSubscriptionId=%s",
                user.getId(),
                subscription.getId()
        );
    }

    @Transactional
    public void syncSubscriptionForUser(UUID userId, Subscription subscription) {
        if (userId == null) {
            throw new IllegalArgumentException("TeacherHelper user ID is required.");
        }

        if (subscription == null) {
            throw new IllegalArgumentException("Stripe subscription is required.");
        }

        User user = userRepository.findById(userId);

        if (user == null) {
            throw new IllegalStateException(
                    "TeacherHelper user not found while synchronizing Stripe subscription."
            );
        }

        if (hasDifferentCurrentSubscription(user, subscription.getId())) {
            throw new IllegalStateException(
                    "Stripe subscription confirmation is older than the user's current subscription."
            );
        }

        syncSubscription(user, subscription);
    }

    private void syncSubscription(User user, Subscription subscription) {
        if (isTerminalSubscription(subscription)) {
            clearStripeSubscription(user);
            return;
        }

        SubscriptionItem item = getSingleSubscriptionItem(subscription);

        if (item.getPrice() == null || item.getPrice().getId() == null) {
            throw new IllegalStateException(
                    "Stripe subscription item has no price."
            );
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
            throw new IllegalStateException(
                    "Unknown Stripe price on TeacherHelper subscription: " + priceId
            );
        }

        user.setStripeCustomerId(subscription.getCustomer());
        user.setStripeSubscriptionId(subscription.getId());
        user.setSubscriptionSource(SubscriptionSource.STRIPE);
        user.setSubscriptionStatus(mapStatus(subscription.getStatus()));
        user.setCancelAtPeriodEnd(Boolean.TRUE.equals(subscription.getCancelAtPeriodEnd()));

        user.setSubscriptionPeriodStart(
                fromStripeTimestamp(item.getCurrentPeriodStart())
        );
        user.setSubscriptionPeriodEnd(
                fromStripeTimestamp(item.getCurrentPeriodEnd())
        );
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

    private RequestOptions stripeRequestOptions() {
        if (stripeSecretKey == null || stripeSecretKey.isBlank()) {
            throw new IllegalStateException("Stripe secret key is not configured.");
        }

        return RequestOptions.builder()
                .setApiKey(stripeSecretKey)
                .build();
    }

    private boolean hasDifferentCurrentSubscription(User user, String incomingSubscriptionId) {
        if (user == null
                || incomingSubscriptionId == null
                || incomingSubscriptionId.isBlank()) {
            return false;
        }

        String currentSubscriptionId = user.getStripeSubscriptionId();

        return currentSubscriptionId != null
                && !currentSubscriptionId.isBlank()
                && !currentSubscriptionId.equals(incomingSubscriptionId);
    }

    private User findUserForSubscription(Subscription subscription) {
        User user = userRepository.findByStripeSubscriptionId(subscription.getId());

        if (user == null
                && subscription.getCustomer() != null
                && !subscription.getCustomer().isBlank()) {
            user = userRepository.findByStripeCustomerId(subscription.getCustomer());
        }

        /*
         * Stripe does not guarantee webhook delivery order. A
         * customer.subscription.created event can therefore arrive before
         * checkout.session.completed has stored the Stripe IDs locally.
         *
         * Checkout writes our userId into subscription metadata, so the
         * subscription event can still be linked deterministically.
         */
        if (user == null) {
            UUID metadataUserId = resolveUserIdFromMetadata(subscription.getMetadata());

            if (metadataUserId != null) {
                user = userRepository.findById(metadataUserId);
            }
        }

        return user;
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

    private StripeObject deserialize(Event event) {
        return event.getDataObjectDeserializer()
                .getObject()
                .orElseThrow(() -> new IllegalStateException(
                        "Stripe event could not be deserialized: " + event.getType()
                ));
    }

    private UUID resolveUserIdFromMetadata(Map<String, String> metadata) {
        if (metadata == null) {
            return null;
        }

        String userIdValue = metadata.get("userId");

        if (userIdValue == null || userIdValue.isBlank()) {
            return null;
        }

        try {
            return UUID.fromString(userIdValue);
        } catch (IllegalArgumentException e) {
            LOG.warnf(
                    "event=stripe.subscription.invalid-user-metadata userId=%s",
                    userIdValue
            );
            return null;
        }
    }

    private UUID resolveUserId(Session session) {
        String userIdValue = session.getClientReferenceId();

        if ((userIdValue == null || userIdValue.isBlank())
                && session.getMetadata() != null) {
            userIdValue = session.getMetadata().get("userId");
        }

        if (userIdValue == null || userIdValue.isBlank()) {
            throw new IllegalStateException(
                    "Stripe Checkout Session has no TeacherHelper user reference."
            );
        }

        try {
            return UUID.fromString(userIdValue);
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException(
                    "Invalid TeacherHelper user ID in Stripe Checkout Session.",
                    e
            );
        }
    }

}
