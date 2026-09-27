package at.boundary;

import at.dtos.User.PaymentRecordDTO;
import at.enums.PaymentStatus;
import at.enums.SubscriptionSource;
import at.model.PaymentRecord;
import at.model.User;
import at.repository.PaymentRecordRepository;
import at.repository.UserRepository;
import at.service.StripeBillingSyncService;
import at.service.StripeRefundService;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.jwt.JsonWebToken;

import java.util.List;
import java.util.Map;

@Path("/payments")
@Produces(MediaType.APPLICATION_JSON)
public class PaymentResource {

    private static final int DEFAULT_LIMIT = 12;
    private static final int MAX_LIMIT = 100;

    @Inject
    JsonWebToken jwt;

    @Inject
    UserRepository userRepository;

    @Inject
    PaymentRecordRepository paymentRecordRepository;

    @Inject
    StripeBillingSyncService stripeBillingSyncService;

    @Inject
    StripeRefundService stripeRefundService;

    @GET
    @Path("/me")
    public Response getMyPayments(@QueryParam("limit") Integer limit) {
        User user = userRepository.getOrCreateAuth0User(jwt);

        int safeLimit = limit == null
                ? DEFAULT_LIMIT
                : Math.max(1, Math.min(limit, MAX_LIMIT));

        List<PaymentRecord> records = paymentRecordRepository
                .findRecentByUserId(user.getId(), safeLimit);

        /*
         * Self-heal the first-payment race:
         * invoice.paid may have arrived before Checkout linked the Stripe
         * customer to this user. Only when local history is empty do one
         * Stripe backfill, then read the local records again.
         */
        if (records.isEmpty()
                && user.getSubscriptionSource() == SubscriptionSource.STRIPE) {
            stripeBillingSyncService.syncUser(user.getId());
            records = paymentRecordRepository.findRecentByUserId(
                    user.getId(),
                    safeLimit
            );
        }

        List<PaymentRecordDTO> payments = records.stream()
                .map(this::toDto)
                .toList();

        return Response.ok(payments).build();
    }

    @POST
    @Path("/admin/invoice/{invoiceId}/refund")
    public Response refundPayment(
            @PathParam("invoiceId") String invoiceId
    ) {
        User admin = userRepository.getOrCreateAuth0User(jwt);
        if (!Boolean.TRUE.equals(admin.isAdmin())) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity(Map.of(
                            "code", "ADMIN_REQUIRED",
                            "message", "Access denied: Admins only."
                    ))
                    .build();
        }

        if (invoiceId == null || invoiceId.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of(
                            "code", "STRIPE_INVOICE_ID_REQUIRED",
                            "message", "Stripe invoice ID is required."
                    ))
                    .build();
        }

        PaymentRecord payment = paymentRecordRepository
                .findByStripeInvoiceId(invoiceId);

        if (payment == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(Map.of(
                            "code", "PAYMENT_NOT_FOUND",
                            "message", "Payment was not found."
                    ))
                    .build();
        }

        if (payment.getStatus() == PaymentStatus.REFUNDED) {
            return Response.status(Response.Status.CONFLICT)
                    .entity(Map.of(
                            "code", "PAYMENT_ALREADY_REFUNDED",
                            "message", "This payment has already been refunded."
                    ))
                    .build();
        }

        if (payment.getStatus() != PaymentStatus.PAID) {
            return Response.status(Response.Status.CONFLICT)
                    .entity(Map.of(
                            "code", "PAYMENT_NOT_REFUNDABLE",
                            "message", "Only paid payments can be refunded."
                    ))
                    .build();
        }

        try {
            StripeRefundService.RefundResult result =
                    stripeRefundService.refundFully(payment);

            return Response.ok(Map.of(
                    "code", result.fullyRefunded()
                            ? "PAYMENT_REFUNDED"
                            : "PAYMENT_REFUND_REQUESTED",
                    "fullyRefunded", result.fullyRefunded(),
                    "refundsCreated", result.refundsCreated()
            )).build();

        } catch (com.stripe.exception.StripeException e) {
            return Response.status(502)
                    .entity(Map.of(
                            "code", "STRIPE_REFUND_FAILED",
                            "message", e.getMessage() == null
                                    ? "Stripe refund failed."
                                    : e.getMessage()
                    ))
                    .build();

        } catch (IllegalStateException | IllegalArgumentException e) {
            return Response.status(Response.Status.CONFLICT)
                    .entity(Map.of(
                            "code", "PAYMENT_REFUND_NOT_AVAILABLE",
                            "message", e.getMessage() == null
                                    ? "Payment cannot be refunded."
                                    : e.getMessage()
                    ))
                    .build();
        }
    }

    private PaymentRecordDTO toDto(PaymentRecord record) {
        return new PaymentRecordDTO(
                record.getId(),
                record.getAmountCents(),
                record.getCurrency(),
                record.getStatus(),
                record.getInvoiceUrl(),
                record.getInvoicePdfUrl(),
                record.getPaidAt(),
                record.getCreatedAt()
        );
    }
}
