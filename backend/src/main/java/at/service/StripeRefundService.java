package at.service;

import at.model.PaymentRecord;
import at.repository.PaymentRecordRepository;
import com.stripe.exception.StripeException;
import com.stripe.model.Charge;
import com.stripe.model.InvoicePayment;
import com.stripe.model.PaymentIntent;
import com.stripe.model.Refund;
import com.stripe.net.RequestOptions;
import com.stripe.param.InvoicePaymentListParams;
import com.stripe.param.RefundCreateParams;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@ApplicationScoped
public class StripeRefundService {

    @Inject
    PaymentRecordRepository paymentRecordRepository;

    @ConfigProperty(name = "stripe.secret-key")
    String stripeSecretKey;

    public RefundResult refundFully(PaymentRecord payment) throws StripeException {
        if (payment == null) {
            throw new IllegalArgumentException("Payment is required.");
        }

        String invoiceId = payment.getStripeInvoiceId();
        if (invoiceId == null || invoiceId.isBlank()) {
            throw new IllegalStateException("Payment has no Stripe invoice ID.");
        }

        RequestOptions options = stripeRequestOptions();

        InvoicePaymentListParams params = InvoicePaymentListParams.builder()
                .setInvoice(invoiceId)
                .setStatus(InvoicePaymentListParams.Status.PAID)
                .setLimit(100L)
                .build();

        var invoicePayments = InvoicePayment.list(params, options);
        Set<String> chargeIds = new LinkedHashSet<>();

        for (InvoicePayment invoicePayment : invoicePayments.autoPagingIterable()) {
            String chargeId = resolveChargeId(invoicePayment, options);
            if (chargeId != null && !chargeId.isBlank()) {
                chargeIds.add(chargeId);
            }
        }

        if (chargeIds.isEmpty()) {
            throw new IllegalStateException(
                    "No refundable Stripe charge was found for this invoice."
            );
        }

        int refundsCreated = 0;
        List<String> processedCharges = new ArrayList<>(chargeIds);

        for (String chargeId : processedCharges) {
            Charge charge = Charge.retrieve(chargeId, options);

            long amount = charge.getAmount() == null
                    ? 0L
                    : Math.max(0L, charge.getAmount());

            long alreadyRefunded = charge.getAmountRefunded() == null
                    ? 0L
                    : Math.max(0L, charge.getAmountRefunded());

            long remaining = Math.max(0L, amount - alreadyRefunded);
            if (remaining == 0L) {
                continue;
            }

            RefundCreateParams refundParams = RefundCreateParams.builder()
                    .setCharge(chargeId)
                    .setAmount(remaining)
                    .build();

            Refund.create(
                    refundParams,
                    refundRequestOptions(invoiceId, chargeId)
            );
            refundsCreated++;
        }

        boolean fullyRefunded = true;

        for (String chargeId : processedCharges) {
            Charge refreshedCharge = Charge.retrieve(chargeId, options);
            if (!Boolean.TRUE.equals(refreshedCharge.getRefunded())) {
                fullyRefunded = false;
                break;
            }
        }

        if (fullyRefunded) {
            paymentRecordRepository.markRefunded(invoiceId);
        }

        return new RefundResult(fullyRefunded, refundsCreated);
    }

    private String resolveChargeId(
            InvoicePayment invoicePayment,
            RequestOptions options
    ) throws StripeException {
        if (invoicePayment == null || invoicePayment.getPayment() == null) {
            return null;
        }

        String chargeId = invoicePayment.getPayment().getCharge();
        if (chargeId != null && !chargeId.isBlank()) {
            return chargeId;
        }

        String paymentIntentId = invoicePayment.getPayment().getPaymentIntent();
        if (paymentIntentId == null || paymentIntentId.isBlank()) {
            return null;
        }

        PaymentIntent paymentIntent = PaymentIntent.retrieve(
                paymentIntentId,
                options
        );

        return paymentIntent.getLatestCharge();
    }

    private RequestOptions stripeRequestOptions() {
        if (stripeSecretKey == null || stripeSecretKey.isBlank()) {
            throw new IllegalStateException("Stripe secret key is not configured.");
        }

        return RequestOptions.builder()
                .setApiKey(stripeSecretKey)
                .build();
    }

    private RequestOptions refundRequestOptions(
            String invoiceId,
            String chargeId
    ) {
        return RequestOptions.builder()
                .setApiKey(stripeSecretKey)
                .setIdempotencyKey(
                        "teacherhelper-full-refund-" + invoiceId + "-" + chargeId
                )
                .build();
    }

    public record RefundResult(
            boolean fullyRefunded,
            int refundsCreated
    ) {
    }
}
