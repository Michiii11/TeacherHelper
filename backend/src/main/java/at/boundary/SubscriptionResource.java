package at.boundary;

import at.dtos.User.SubscriptionDTO;
import at.model.User;
import at.repository.UserRepository;
import at.service.SubscriptionLimitService;
import at.service.StripeWebhookService;
import com.stripe.StripeClient;
import com.stripe.exception.StripeException;
import com.stripe.model.Subscription;
import com.stripe.model.SubscriptionItem;
import com.stripe.model.Invoice;
import com.stripe.model.InvoiceLineItem;
import com.stripe.model.Price;
import com.stripe.param.SubscriptionUpdateParams;
import com.stripe.param.InvoiceCreatePreviewParams;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.param.checkout.SessionCreateParams;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.time.Instant;
import java.util.Locale;
import java.util.Map;

@Path("/subscription")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class SubscriptionResource {

    private static final int SCHOOL_MIN_SEATS = 20;
    private static final int PRO_MAX_COLLECTIONS = 5;
    private static final int PRO_MAX_MEMBERS_PER_COLLECTION = 5;
    private static final int PRO_MAX_EXAMPLES = 500;
    private static final int PRO_MAX_TESTS = 50;
    private static final long PRORATION_DATE_MAX_AGE_SECONDS = 10 * 60;
    private static final long PRORATION_DATE_MAX_FUTURE_SECONDS = 60;

    @Inject
    JsonWebToken jwt;

    @Inject
    UserRepository userRepository;

    @Inject
    SubscriptionLimitService subscriptionLimitService;

    @Inject
    StripeWebhookService stripeWebhookService;

    @Inject
    EntityManager em;

    @ConfigProperty(name = "stripe.secret-key")
    String stripeSecretKey;

    @ConfigProperty(name = "stripe.price.pro")
    String stripePricePro;

    @ConfigProperty(name = "stripe.price.school")
    String stripePriceSchool;

    @ConfigProperty(name = "stripe.portal-configuration-id")
    String stripePortalConfigurationId;

    @ConfigProperty(name = "frontend.url")
    String frontendUrl;

    @GET
    @Path("/me")
    public Response getMySubscription() {
        User user = userRepository.getOrCreateAuth0User(jwt);

        var plan = subscriptionLimitService.effectivePlan(user);
        var limits = subscriptionLimitService.limitsFor(user);

        long collections = subscriptionLimitService.countOwnedCollections(user.getId());
        long examples = subscriptionLimitService.countExamplesInOwnedCollections(user.getId());
        long tests = subscriptionLimitService.countTestsInOwnedCollections(user.getId());

        long schoolUsers = plan == at.enums.SubscriptionModel.SCHOOL
                ? subscriptionLimitService.countTotalSchoolUsers(user.getId())
                : 0;

        int maxCollectionMembers = countMaxMembersInOwnedCollection(user);

        Integer seats = plan == at.enums.SubscriptionModel.SCHOOL
                ? subscriptionLimitService.schoolCapacity(user)
                : null;

        SubscriptionDTO dto = new SubscriptionDTO(
                plan,
                user.getSubscriptionStatus(),
                user.getSubscriptionSource(),
                seats,
                user.getCancelAtPeriodEnd(),
                user.getSubscriptionPeriodStart(),
                user.getSubscriptionPeriodEnd(),
                new SubscriptionDTO.UsageDTO(
                        collections,
                        examples,
                        tests,
                        schoolUsers,
                        maxCollectionMembers
                ),
                new SubscriptionDTO.LimitsDTO(
                        nullableLimit(limits.maxCollections()),
                        nullableLimit(limits.maxMembersPerCollection()),
                        nullableLimit(limits.maxExamples()),
                        nullableLimit(limits.maxTests()),
                        nullableLimit(limits.maxSchoolUsers())
                )
        );

        return Response.ok(dto).build();
    }

    @POST
    @Path("/checkout")
    public Response createCheckoutSession(CheckoutRequest request) {
        User user = userRepository.getOrCreateAuth0User(jwt);

        if (user.getStripeSubscriptionId() != null && !user.getStripeSubscriptionId().isBlank()) {
            return Response.status(Response.Status.CONFLICT)
                    .entity(Map.of("code", "SUBSCRIPTION_ALREADY_EXISTS"))
                    .build();
        }

        if (request == null || request.plan() == null || request.plan().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("code", "PLAN_REQUIRED"))
                    .build();
        }

        String plan = request.plan().trim().toUpperCase(Locale.ROOT);
        String priceId;
        long quantity;

        switch (plan) {
            case "PRO" -> {
                Response capacityError = validateProCapacity(user);
                if (capacityError != null) {
                    return capacityError;
                }

                priceId = stripePricePro;
                quantity = 1L;
            }
            case "SCHOOL" -> {
                int seats = request.seats() == null ? SCHOOL_MIN_SEATS : request.seats();

                if (seats < SCHOOL_MIN_SEATS) {
                    return Response.status(Response.Status.BAD_REQUEST)
                            .entity(Map.of("code", "SCHOOL_MIN_SEATS", "minimumSeats", SCHOOL_MIN_SEATS))
                            .build();
                }

                Response capacityError = validateSchoolCapacity(user, seats);
                if (capacityError != null) {
                    return capacityError;
                }

                priceId = stripePriceSchool;
                quantity = seats;
            }
            default -> {
                return Response.status(Response.Status.BAD_REQUEST)
                        .entity(Map.of("code", "INVALID_PLAN"))
                        .build();
            }
        }

        if (priceId == null || priceId.isBlank() || !priceId.startsWith("price_")) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(Map.of("code", "STRIPE_PRICE_NOT_CONFIGURED"))
                    .build();
        }

        if (stripeSecretKey == null || stripeSecretKey.isBlank()) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(Map.of("code", "STRIPE_SECRET_NOT_CONFIGURED"))
                    .build();
        }

        String baseUrl = frontendUrl.endsWith("/")
                ? frontendUrl.substring(0, frontendUrl.length() - 1)
                : frontendUrl;

        SessionCreateParams.SubscriptionData.Builder subscriptionDataBuilder =
                SessionCreateParams.SubscriptionData.builder()
                        .putMetadata("userId", user.getId().toString())
                        .putMetadata("plan", plan);

        if ("SCHOOL".equals(plan)) {
            subscriptionDataBuilder.putMetadata("seats", String.valueOf(quantity));
        }

        SessionCreateParams.Builder paramsBuilder = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
                .setSuccessUrl(baseUrl + "/profile?checkout=success&session_id={CHECKOUT_SESSION_ID}")
                .setCancelUrl(baseUrl + "/profile?checkout=cancelled")
                .setClientReferenceId(user.getId().toString())
                .putMetadata("userId", user.getId().toString())
                .putMetadata("plan", plan)
                .setSubscriptionData(subscriptionDataBuilder.build())
                .addLineItem(
                        SessionCreateParams.LineItem.builder()
                                .setPrice(priceId)
                                .setQuantity(quantity)
                                .build()
                );

        if (user.getStripeCustomerId() != null && !user.getStripeCustomerId().isBlank()) {
            paramsBuilder.setCustomer(user.getStripeCustomerId());
        } else if (user.getEmail() != null && !user.getEmail().isBlank()) {
            paramsBuilder.setCustomerEmail(user.getEmail());
        }

        if ("SCHOOL".equals(plan)) {
            paramsBuilder.putMetadata("seats", String.valueOf(quantity));
        }

        RequestOptions requestOptions = RequestOptions.builder()
                .setApiKey(stripeSecretKey)
                .build();

        try {
            Session session = Session.create(paramsBuilder.build(), requestOptions);

            return Response.ok(Map.of(
                    "sessionId", session.getId(),
                    "url", session.getUrl()
            )).build();

        } catch (StripeException e) {
            return Response.status(Response.Status.BAD_GATEWAY)
                    .entity(Map.of(
                            "code", "STRIPE_CHECKOUT_FAILED",
                            "message", e.getMessage() == null ? "Stripe checkout failed" : e.getMessage()
                    ))
                    .build();
        }
    }

    @POST
    @Path("/confirm-checkout")
    public Response confirmCheckout(CheckoutConfirmationRequest request) {
        User user = userRepository.getOrCreateAuth0User(jwt);

        if (request == null || request.sessionId() == null || request.sessionId().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("code", "CHECKOUT_SESSION_REQUIRED"))
                    .build();
        }

        String sessionId = request.sessionId().trim();

        if (!sessionId.startsWith("cs_")) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("code", "INVALID_CHECKOUT_SESSION"))
                    .build();
        }

        if (stripeSecretKey == null || stripeSecretKey.isBlank()) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(Map.of("code", "STRIPE_SECRET_NOT_CONFIGURED"))
                    .build();
        }

        RequestOptions requestOptions = RequestOptions.builder()
                .setApiKey(stripeSecretKey)
                .build();

        try {
            Session session = Session.retrieve(sessionId, requestOptions);

            if (!checkoutSessionBelongsToUser(session, user)) {
                return Response.status(Response.Status.FORBIDDEN)
                        .entity(Map.of("code", "CHECKOUT_SESSION_NOT_OWNED"))
                        .build();
            }

            if (!"complete".equalsIgnoreCase(session.getStatus())) {
                return Response.status(Response.Status.CONFLICT)
                        .entity(Map.of("code", "CHECKOUT_NOT_COMPLETE"))
                        .build();
            }

            String subscriptionId = session.getSubscription();

            if (subscriptionId == null || subscriptionId.isBlank()) {
                return Response.status(Response.Status.CONFLICT)
                        .entity(Map.of("code", "CHECKOUT_SUBSCRIPTION_NOT_READY"))
                        .build();
            }

            if (user.getStripeSubscriptionId() != null
                    && !user.getStripeSubscriptionId().isBlank()
                    && !user.getStripeSubscriptionId().equals(subscriptionId)) {
                return Response.status(Response.Status.CONFLICT)
                        .entity(Map.of("code", "CHECKOUT_SESSION_SUPERSEDED"))
                        .build();
            }

            Subscription subscription = Subscription.retrieve(subscriptionId, requestOptions);
            stripeWebhookService.syncSubscriptionForUser(user.getId(), subscription);

            return Response.ok(Map.of(
                    "confirmed", true,
                    "subscriptionId", subscription.getId()
            )).build();

        } catch (StripeException e) {
            return Response.status(Response.Status.BAD_GATEWAY)
                    .entity(Map.of(
                            "code", "STRIPE_CHECKOUT_CONFIRMATION_FAILED",
                            "message", e.getMessage() == null
                                    ? "Stripe checkout confirmation failed"
                                    : e.getMessage()
                    ))
                    .build();
        }
    }

    @POST
    @Path("/preview-change")
    public Response previewPlanChange(ChangePlanRequest request) {
        User user = userRepository.getOrCreateAuth0User(jwt);

        if (user.getStripeSubscriptionId() == null || user.getStripeSubscriptionId().isBlank()) {
            return Response.status(Response.Status.CONFLICT)
                    .entity(Map.of("code", "NO_STRIPE_SUBSCRIPTION"))
                    .build();
        }

        if (request == null || request.plan() == null || request.plan().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("code", "PLAN_REQUIRED"))
                    .build();
        }

        String plan = request.plan().trim().toUpperCase(Locale.ROOT);

        if (!"PRO".equals(plan) && !"SCHOOL".equals(plan)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("code", "INVALID_PLAN"))
                    .build();
        }

        String priceId;
        long quantity;

        if ("PRO".equals(plan)) {
            Response capacityError = validateProCapacity(user);
            if (capacityError != null) {
                return capacityError;
            }

            priceId = stripePricePro;
            quantity = 1L;
        } else {
            int seats = request.seats() == null ? SCHOOL_MIN_SEATS : request.seats();

            if (seats < SCHOOL_MIN_SEATS) {
                return Response.status(Response.Status.BAD_REQUEST)
                        .entity(Map.of(
                                "code", "SCHOOL_MIN_SEATS",
                                "minimumSeats", SCHOOL_MIN_SEATS
                        ))
                        .build();
            }

            Response capacityError = validateSchoolCapacity(user, seats);
            if (capacityError != null) {
                return capacityError;
            }

            priceId = stripePriceSchool;
            quantity = seats;
        }

        if (priceId == null || priceId.isBlank() || !priceId.startsWith("price_")) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(Map.of("code", "STRIPE_PRICE_NOT_CONFIGURED"))
                    .build();
        }

        if (stripeSecretKey == null || stripeSecretKey.isBlank()) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(Map.of("code", "STRIPE_SECRET_NOT_CONFIGURED"))
                    .build();
        }

        RequestOptions requestOptions = RequestOptions.builder()
                .setApiKey(stripeSecretKey)
                .build();

        try {
            Subscription subscription = Subscription.retrieve(
                    user.getStripeSubscriptionId(),
                    requestOptions
            );

            if (subscription.getItems() == null
                    || subscription.getItems().getData() == null
                    || subscription.getItems().getData().isEmpty()) {
                return Response.status(Response.Status.CONFLICT)
                        .entity(Map.of("code", "STRIPE_SUBSCRIPTION_ITEM_NOT_FOUND"))
                        .build();
            }

            if (subscription.getItems().getData().size() != 1) {
                return Response.status(Response.Status.CONFLICT)
                        .entity(Map.of("code", "MULTIPLE_SUBSCRIPTION_ITEMS_NOT_SUPPORTED"))
                        .build();
            }

            SubscriptionItem item = subscription.getItems().getData().getFirst();
            long prorationDate = Instant.now().getEpochSecond();

            InvoiceCreatePreviewParams.SubscriptionDetails.Item previewItem =
                    InvoiceCreatePreviewParams.SubscriptionDetails.Item.builder()
                            .setId(item.getId())
                            .setPrice(priceId)
                            .setQuantity(quantity)
                            .build();

            InvoiceCreatePreviewParams.SubscriptionDetails subscriptionDetails =
                    InvoiceCreatePreviewParams.SubscriptionDetails.builder()
                            .setProrationBehavior(
                                    InvoiceCreatePreviewParams.SubscriptionDetails.ProrationBehavior.CREATE_PRORATIONS
                            )
                            .setProrationDate(prorationDate)
                            .addItem(previewItem)
                            .build();

            InvoiceCreatePreviewParams params = InvoiceCreatePreviewParams.builder()
                    .setSubscription(user.getStripeSubscriptionId())
                    .setSubscriptionDetails(subscriptionDetails)
                    .build();

            Invoice preview = Invoice.createPreview(params, requestOptions);

            long amountDueCents = preview.getAmountDue() == null ? 0L : preview.getAmountDue();
            String currency = preview.getCurrency() == null ? "eur" : preview.getCurrency();

            long currentQuantity = item.getQuantity() == null ? 1L : item.getQuantity();
            long currentUnitAmountCents = item.getPrice() != null && item.getPrice().getUnitAmount() != null
                    ? item.getPrice().getUnitAmount()
                    : 0L;
            long currentMonthlyAmountCents = currentUnitAmountCents * currentQuantity;

            Price targetPrice = Price.retrieve(priceId, requestOptions);
            long newUnitAmountCents = targetPrice.getUnitAmount() == null
                    ? 0L
                    : targetPrice.getUnitAmount();
            long newMonthlyAmountCents = newUnitAmountCents * quantity;

            // Stripe explicitly recommends identifying preview prorations by the
            // line item's parent.*.proration flag. This avoids treating discounts,
            // taxes or unrelated invoice items as the current-period adjustment.
            long currentPeriodAdjustmentCents = preview.getLines() == null
                    || preview.getLines().getData() == null
                    ? 0L
                    : preview.getLines().getData().stream()
                    .filter(this::isProrationLine)
                    .map(InvoiceLineItem::getAmount)
                    .filter(amount -> amount != null)
                    .mapToLong(Long::longValue)
                    .sum();

            long nextBillingAt = item.getCurrentPeriodEnd() == null
                    ? 0L
                    : item.getCurrentPeriodEnd();

            return Response.ok(Map.of(
                    "plan", plan,
                    "seats", "SCHOOL".equals(plan) ? quantity : 1L,
                    "currentMonthlyAmountCents", currentMonthlyAmountCents,
                    "newMonthlyAmountCents", newMonthlyAmountCents,
                    "monthlyDifferenceCents", newMonthlyAmountCents - currentMonthlyAmountCents,
                    "currentPeriodAdjustmentCents", currentPeriodAdjustmentCents,
                    "nextInvoiceAmountCents", amountDueCents,
                    "nextBillingAt", nextBillingAt,
                    "currency", currency,
                    "prorationDate", prorationDate
            )).build();

        } catch (StripeException e) {
            return Response.status(Response.Status.BAD_GATEWAY)
                    .entity(Map.of(
                            "code", "STRIPE_PREVIEW_FAILED",
                            "message", e.getMessage() == null
                                    ? "Stripe plan change preview failed"
                                    : e.getMessage()
                    ))
                    .build();
        }
    }

    @POST
    @Path("/change-plan")
    public Response changePlan(ChangePlanRequest request) {
        User user = userRepository.getOrCreateAuth0User(jwt);

        if (user.getStripeSubscriptionId() == null || user.getStripeSubscriptionId().isBlank()) {
            return Response.status(Response.Status.CONFLICT)
                    .entity(Map.of("code", "NO_STRIPE_SUBSCRIPTION"))
                    .build();
        }

        if (request == null || request.plan() == null || request.plan().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("code", "PLAN_REQUIRED"))
                    .build();
        }

        String plan = request.plan().trim().toUpperCase(Locale.ROOT);

        if (!"PRO".equals(plan) && !"SCHOOL".equals(plan)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("code", "INVALID_PLAN"))
                    .build();
        }

        String priceId;
        long quantity;

        if ("PRO".equals(plan)) {
            Response capacityError = validateProCapacity(user);
            if (capacityError != null) {
                return capacityError;
            }

            priceId = stripePricePro;
            quantity = 1L;
        } else {
            int seats = request.seats() == null ? SCHOOL_MIN_SEATS : request.seats();

            if (seats < SCHOOL_MIN_SEATS) {
                return Response.status(Response.Status.BAD_REQUEST)
                        .entity(Map.of(
                                "code", "SCHOOL_MIN_SEATS",
                                "minimumSeats", SCHOOL_MIN_SEATS
                        ))
                        .build();
            }

            Response capacityError = validateSchoolCapacity(user, seats);
            if (capacityError != null) {
                return capacityError;
            }

            priceId = stripePriceSchool;
            quantity = seats;
        }

        if (priceId == null || priceId.isBlank() || !priceId.startsWith("price_")) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(Map.of("code", "STRIPE_PRICE_NOT_CONFIGURED"))
                    .build();
        }

        if (stripeSecretKey == null || stripeSecretKey.isBlank()) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(Map.of("code", "STRIPE_SECRET_NOT_CONFIGURED"))
                    .build();
        }

        RequestOptions requestOptions = RequestOptions.builder()
                .setApiKey(stripeSecretKey)
                .build();

        try {
            Subscription subscription = Subscription.retrieve(
                    user.getStripeSubscriptionId(),
                    requestOptions
            );

            if (subscription.getItems() == null
                    || subscription.getItems().getData() == null
                    || subscription.getItems().getData().isEmpty()) {
                return Response.status(Response.Status.CONFLICT)
                        .entity(Map.of("code", "STRIPE_SUBSCRIPTION_ITEM_NOT_FOUND"))
                        .build();
            }

            if (subscription.getItems().getData().size() != 1) {
                return Response.status(Response.Status.CONFLICT)
                        .entity(Map.of("code", "MULTIPLE_SUBSCRIPTION_ITEMS_NOT_SUPPORTED"))
                        .build();
            }

            SubscriptionItem item = subscription.getItems().getData().getFirst();

            long prorationDate = resolveProrationDate(request.prorationDate());
            if (prorationDate < 0L) {
                return Response.status(Response.Status.BAD_REQUEST)
                        .entity(Map.of(
                                "code", "INVALID_PRORATION_DATE",
                                "message", "The price preview expired. Please request a new preview."
                        ))
                        .build();
            }

            SubscriptionUpdateParams.Item updatedItem =
                    SubscriptionUpdateParams.Item.builder()
                            .setId(item.getId())
                            .setPrice(priceId)
                            .setQuantity(quantity)
                            .build();

            // Change the price/quantity and remove a previously scheduled cancellation
            // in one Stripe subscription update. This keeps the operation consistent:
            // there is no state where the new plan is active but cancel_at_period_end
            // is still true because a second Stripe request failed.
            SubscriptionUpdateParams params = SubscriptionUpdateParams.builder()
                    .addItem(updatedItem)
                    .setCancelAtPeriodEnd(false)
                    .setProrationBehavior(SubscriptionUpdateParams.ProrationBehavior.CREATE_PRORATIONS)
                    .setProrationDate(prorationDate)
                    .build();

            Subscription updatedSubscription = subscription.update(params, requestOptions);

            return Response.ok(Map.of(
                    "plan", plan,
                    "seats", "SCHOOL".equals(plan) ? quantity : 1L,
                    "subscriptionId", updatedSubscription.getId(),
                    "subscriptionItemId", item.getId()
            )).build();

        } catch (StripeException e) {
            return Response.status(Response.Status.BAD_GATEWAY)
                    .entity(Map.of(
                            "code", "STRIPE_PLAN_CHANGE_FAILED",
                            "message", e.getMessage() == null
                                    ? "Stripe plan change failed"
                                    : e.getMessage()
                    ))
                    .build();
        }
    }

    @POST
    @Path("/cancel")
    public Response cancelSubscriptionAtPeriodEnd() {
        User user = userRepository.getOrCreateAuth0User(jwt);

        if (user.getStripeSubscriptionId() == null || user.getStripeSubscriptionId().isBlank()) {
            return Response.status(Response.Status.CONFLICT)
                    .entity(Map.of("code", "NO_STRIPE_SUBSCRIPTION"))
                    .build();
        }

        if (stripeSecretKey == null || stripeSecretKey.isBlank()) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(Map.of("code", "STRIPE_SECRET_NOT_CONFIGURED"))
                    .build();
        }

        RequestOptions requestOptions = RequestOptions.builder()
                .setApiKey(stripeSecretKey)
                .build();

        try {
            Subscription subscription = Subscription.retrieve(
                    user.getStripeSubscriptionId(),
                    requestOptions
            );

            SubscriptionUpdateParams params = SubscriptionUpdateParams.builder()
                    .setCancelAtPeriodEnd(true)
                    .build();

            Subscription updated = subscription.update(params, requestOptions);

            return Response.ok(Map.of(
                    "subscriptionId", updated.getId(),
                    "cancelAtPeriodEnd", Boolean.TRUE.equals(updated.getCancelAtPeriodEnd())
            )).build();

        } catch (StripeException e) {
            return Response.status(Response.Status.BAD_GATEWAY)
                    .entity(Map.of(
                            "code", "STRIPE_CANCEL_FAILED",
                            "message", e.getMessage() == null
                                    ? "Stripe subscription cancellation failed"
                                    : e.getMessage()
                    ))
                    .build();
        }
    }


    @POST
    @Path("/resume")
    public Response resumeSubscription() {
        User user = userRepository.getOrCreateAuth0User(jwt);

        if (user.getStripeSubscriptionId() == null || user.getStripeSubscriptionId().isBlank()) {
            return Response.status(Response.Status.CONFLICT)
                    .entity(Map.of("code", "NO_STRIPE_SUBSCRIPTION"))
                    .build();
        }

        if (stripeSecretKey == null || stripeSecretKey.isBlank()) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(Map.of("code", "STRIPE_SECRET_NOT_CONFIGURED"))
                    .build();
        }

        RequestOptions requestOptions = RequestOptions.builder()
                .setApiKey(stripeSecretKey)
                .build();

        try {
            Subscription subscription = Subscription.retrieve(
                    user.getStripeSubscriptionId(),
                    requestOptions
            );

            SubscriptionUpdateParams params = SubscriptionUpdateParams.builder()
                    .setCancelAtPeriodEnd(false)
                    .build();

            Subscription updated = subscription.update(params, requestOptions);

            return Response.ok(Map.of(
                    "subscriptionId", updated.getId(),
                    "cancelAtPeriodEnd", Boolean.TRUE.equals(updated.getCancelAtPeriodEnd())
            )).build();

        } catch (StripeException e) {
            return Response.status(Response.Status.BAD_GATEWAY)
                    .entity(Map.of(
                            "code", "STRIPE_RESUME_FAILED",
                            "message", e.getMessage() == null
                                    ? "Stripe subscription could not be resumed"
                                    : e.getMessage()
                    ))
                    .build();
        }
    }

    @POST
    @Path("/portal")
    public Response createBillingPortalSession() {
        User user = userRepository.getOrCreateAuth0User(jwt);

        if (user.getStripeCustomerId() == null || user.getStripeCustomerId().isBlank()) {
            return Response.status(Response.Status.CONFLICT)
                    .entity(Map.of("code", "NO_STRIPE_CUSTOMER"))
                    .build();
        }

        if (stripeSecretKey == null || stripeSecretKey.isBlank()) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(Map.of("code", "STRIPE_SECRET_NOT_CONFIGURED"))
                    .build();
        }

        if (stripePortalConfigurationId == null
                || stripePortalConfigurationId.isBlank()
                || !stripePortalConfigurationId.startsWith("bpc_")) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(Map.of("code", "STRIPE_PORTAL_CONFIGURATION_NOT_CONFIGURED"))
                    .build();
        }

        String baseUrl = frontendUrl.endsWith("/")
                ? frontendUrl.substring(0, frontendUrl.length() - 1)
                : frontendUrl;

        com.stripe.param.billingportal.SessionCreateParams params =
                com.stripe.param.billingportal.SessionCreateParams.builder()
                        .setCustomer(user.getStripeCustomerId())
                        .setConfiguration(stripePortalConfigurationId)
                        .setReturnUrl(baseUrl + "/profile")
                        .build();

        try {
            StripeClient client = new StripeClient(stripeSecretKey);

            com.stripe.model.billingportal.Session session =
                    client.v1().billingPortal().sessions().create(params);

            return Response.ok(Map.of(
                    "url", session.getUrl()
            )).build();

        } catch (StripeException e) {
            return Response.status(Response.Status.BAD_GATEWAY)
                    .entity(Map.of(
                            "code", "STRIPE_PORTAL_FAILED",
                            "message", e.getMessage() == null
                                    ? "Stripe billing portal could not be opened"
                                    : e.getMessage()
                    ))
                    .build();
        }
    }

    private Response validateProCapacity(User user) {
        long collections = subscriptionLimitService.countOwnedCollections(user.getId());
        long examples = subscriptionLimitService.countExamplesInOwnedCollections(user.getId());
        long tests = subscriptionLimitService.countTestsInOwnedCollections(user.getId());
        int maxCollectionMembers = countMaxMembersInOwnedCollection(user);

        boolean fitsPro = collections <= PRO_MAX_COLLECTIONS
                && examples <= PRO_MAX_EXAMPLES
                && tests <= PRO_MAX_TESTS
                && maxCollectionMembers <= PRO_MAX_MEMBERS_PER_COLLECTION;

        if (fitsPro) {
            return null;
        }

        return Response.status(Response.Status.CONFLICT)
                .entity(Map.of(
                        "code", "PRO_CAPACITY_BELOW_USAGE",
                        "collections", collections,
                        "maxCollections", PRO_MAX_COLLECTIONS,
                        "examples", examples,
                        "maxExamples", PRO_MAX_EXAMPLES,
                        "tests", tests,
                        "maxTests", PRO_MAX_TESTS,
                        "maxCollectionMembers", maxCollectionMembers,
                        "maxMembersPerCollection", PRO_MAX_MEMBERS_PER_COLLECTION
                ))
                .build();
    }

    private int countMaxMembersInOwnedCollection(User user) {
        if (user == null || user.getId() == null) {
            return 0;
        }

        return em.createQuery(
                        """
                        SELECT SIZE(c.users)
                        FROM Collection c
                        WHERE c.admin.id = :userId
                        """,
                        Integer.class
                )
                .setParameter("userId", user.getId())
                .getResultList()
                .stream()
                .mapToInt(Integer::intValue)
                .max()
                .orElse(0);
    }

    private Response validateSchoolCapacity(User user, long requestedSeats) {
        long collections = subscriptionLimitService.countOwnedCollections(user.getId());
        long schoolUsers = subscriptionLimitService.countTotalSchoolUsers(user.getId());

        long minimumRequiredSeats = Math.max(
                SCHOOL_MIN_SEATS,
                Math.max(collections, schoolUsers)
        );

        if (requestedSeats >= minimumRequiredSeats) {
            return null;
        }

        return Response.status(Response.Status.CONFLICT)
                .entity(Map.of(
                        "code", "SCHOOL_CAPACITY_BELOW_USAGE",
                        "minimumSeats", minimumRequiredSeats,
                        "collections", collections,
                        "schoolUsers", schoolUsers
                ))
                .build();
    }

    private boolean checkoutSessionBelongsToUser(Session session, User user) {
        if (session == null || user == null || user.getId() == null) {
            return false;
        }

        String expectedUserId = user.getId().toString();

        if (expectedUserId.equals(session.getClientReferenceId())) {
            return true;
        }

        Map<String, String> metadata = session.getMetadata();

        return metadata != null && expectedUserId.equals(metadata.get("userId"));
    }

    private boolean isProrationLine(InvoiceLineItem line) {
        if (line == null || line.getParent() == null) {
            return false;
        }

        InvoiceLineItem.Parent parent = line.getParent();

        if (parent.getSubscriptionItemDetails() != null
                && Boolean.TRUE.equals(parent.getSubscriptionItemDetails().getProration())) {
            return true;
        }

        return parent.getInvoiceItemDetails() != null
                && Boolean.TRUE.equals(parent.getInvoiceItemDetails().getProration());
    }

    private long resolveProrationDate(Long requestedProrationDate) {
        long now = Instant.now().getEpochSecond();

        if (requestedProrationDate == null) {
            return now;
        }

        long oldestAllowed = now - PRORATION_DATE_MAX_AGE_SECONDS;
        long newestAllowed = now + PRORATION_DATE_MAX_FUTURE_SECONDS;

        if (requestedProrationDate < oldestAllowed || requestedProrationDate > newestAllowed) {
            return -1L;
        }

        return requestedProrationDate;
    }

    private Integer nullableLimit(int value) {
        return value == SubscriptionLimitService.UNLIMITED ? null : value;
    }

    public record ChangePlanRequest(String plan, Integer seats, Long prorationDate) {
    }

    public record CheckoutRequest(String plan, Integer seats) {
    }

    public record CheckoutConfirmationRequest(String sessionId) {
    }
}
